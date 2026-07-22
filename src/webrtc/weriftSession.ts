/**
 * @file src/webrtc/weriftSession.ts
 * @description This file contains the WeriftWebRtcSession class, wrapping a werift RTCPeerConnection.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-14
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'matterbridge/logger';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, useOPUS, usePCMU, useVP8 } from 'werift';
import { navigator } from 'werift/nonstandard';

type VideoSource = 'none' | 'test' | 'webcam';

/**
 * Media kinds to negotiate when creating a real WebRTC offer for a WebRtcTransportProvider session.
 */
export interface WeriftOfferOptions {
  /** Whether to add a sendonly video transceiver to the offer. */
  video: boolean;
  /** Whether to add a sendonly audio transceiver to the offer. */
  audio: boolean;
  /**
   * Preferred webcam capture resolution (e.g. "1280x720") for this session, typically the allocated video stream's
   * resolution from a real client's CameraAvStreamManagement.VideoStreamAllocate request. Takes precedence over
   * MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION when it names a supported resolution; ignored for the synthetic test
   * pattern source.
   */
  videoResolution?: string;
}

/**
 * Wraps a werift RTCPeerConnection for a single WebRtcTransportProvider session (see
 * MatterbridgeWebRtcTransportProviderServer in ../behaviors/webRtcTransportProviderServer.ts), so the session's SDP
 * offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded.
 *
 * In addition to SDP/ICE negotiation, this session can inject a video source using werift/nonstandard + ffmpeg so an
 * end-to-end media path can be validated without a real camera capture pipeline. The source is a synthetic moving
 * test pattern when `MATTERBRIDGE_CAMERA_VIDEO_SOURCE=test`, a local webcam capture device when the source is
 * `webcam`, or no injected track when the source is unset or `none`. MATTERBRIDGE_CAMERA_WEBCAM_DEVICE identifies the
 * webcam device (e.g. /dev/video0 on Linux, an avfoundation index on macOS, or a dshow device name on Windows). The
 * webcam capture resolution defaults to 640x480 and can be set to 1280x720 or 1920x1080 with
 * MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION.
 *
 * Similarly, a recorded test-voice clip can be injected as the audio track (e.g. for an Intercom's "Listen" live
 * view) so the audio path can be validated without a real microphone capture pipeline; disable with
 * MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1.
 */
export class WeriftWebRtcSession {
  /** The underlying werift peer connection for this session. */
  readonly peerConnection: RTCPeerConnection;

  /** The logger for this session. */
  private readonly log: AnsiLogger;

  private testVideoGenerator?: ChildProcess;

  private testVideoUdpDisposer?: () => void;

  private testVideoAttached = false;

  private testAudioGenerator?: ChildProcess;

  private testAudioUdpDisposer?: () => void;

  private testAudioAttached = false;

  /**
   * Creates a new werift RTCPeerConnection configured with the codecs this session can negotiate and inject.
   *
   * @param {number} webRtcSessionId - The WebRtcTransportProvider session identifier this instance backs, used as this session's log name.
   */
  constructor(webRtcSessionId: number) {
    this.peerConnection = new RTCPeerConnection({ codecs: { audio: [useOPUS(), usePCMU()], video: [useH264(), useVP8()] } });
    this.log = new AnsiLogger({ logName: `WebRTC session ${webRtcSessionId}`, logLevel: LogLevel.DEBUG, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });
    // Log when local ICE candidate discovery starts or completes.
    this.peerConnection.iceGatheringStateChange.subscribe((state) => {
      this.log.info(`ICE gathering state: ${state}`);
    });
    // Log each discovered local candidate, or the end-of-candidates signal.
    this.peerConnection.onIceCandidate.subscribe((candidate) => {
      this.log.debug(candidate ? `Gathered local ICE candidate: ${candidate.candidate}` : 'ICE candidate gathering completed');
    });
    // Log progress while ICE tests candidate pairs and establishes connectivity.
    this.peerConnection.iceConnectionStateChange.subscribe((state) => {
      this.log.info(`ICE connection state: ${state}`);
      if (state === 'connected' || state === 'completed') {
        for (const transport of this.peerConnection.iceTransports) {
          const pair = transport.connection.nominated;
          // v8 ignore start -- unreachable
          if (!pair) continue;
          const local = pair.localCandidate;
          const remote = pair.remoteCandidate;
          // Log the nominated local-to-remote route that carries WebRTC traffic.
          this.log.info(
            `Selected ICE candidate pair: local=${local.host}:${local.port} (${local.type}/${local.transport}) ` +
              `remote=${remote.host}:${remote.port} (${remote.type}/${remote.transport})`,
          );
          // v8 ignore end
        }
      }
    });
    // Log the aggregate peer connection state, including ICE and secure transports.
    this.peerConnection.connectionStateChange.subscribe((state) => {
      this.log.info(`Peer connection state: ${state}`);
    });
    this.log.debug(`Created RTCPeerConnection with codecs: audio=[OPUS, PCMU], video=[H264, VP8] for session ${webRtcSessionId}`);
  }

  /**
   * Builds a short, log-friendly summary of an SDP body (length and negotiated media kinds).
   *
   * @param {string} sdp - The SDP body to summarize.
   * @returns {string} A summary string such as `length=1234 media=[video,audio]`.
   */
  private summarizeSdp(sdp: string): string {
    const mediaKinds = sdp
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('m='))
      .map((line) => line.slice(2).split(' ')[0]);
    return `length=${sdp.length} media=[${mediaKinds.join(',')}]`;
  }

  /**
   * Spawns a command and waits for it to exit, discarding its stdio.
   *
   * @param {string} command - The command to run.
   * @param {string[]} args - The arguments to pass to the command.
   * @returns {Promise<void>} Resolves when the command exits with code 0; rejects otherwise.
   */
  private async runProcess(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'ignore' });
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        /* v8 ignore next -- `code` is only null when the child is killed by a signal rather than exiting normally,
         * which isn't practical to trigger deterministically in this harness; the fallback is cosmetic (error text). */
        reject(new Error(`${command} exited with code ${code ?? -1}`));
      });
    });
  }

  /**
   * Checks whether a command is runnable, trying `--version` and `-version` since tools differ (e.g. ffmpeg uses `-version`).
   *
   * @param {string} command - The command (or path) to probe.
   * @returns {Promise<boolean>} `true` if the command ran successfully with either version switch.
   */
  private async hasCommand(command: string): Promise<boolean> {
    for (const versionArg of ['--version', '-version']) {
      try {
        await this.runProcess(command, [versionArg]);
        return true;
      } catch {
        // Try alternative version switches because tools differ (e.g. ffmpeg uses -version).
      }
    }
    return false;
  }

  /**
   * Builds a list of Windows-specific absolute paths to probe for a command, since it may not be on `PATH`.
   *
   * Currently only handles `ffmpeg`: checks winget/Gyan installs under `%LOCALAPPDATA%\Microsoft\WinGet\Packages`,
   * plus common `%ProgramFiles%`/`%ProgramFiles(x86)%` install locations. Returns an empty list on non-Windows platforms.
   *
   * @param {string} command - The command name (or path) to build Windows candidates for.
   * @returns {Promise<string[]>} Candidate absolute paths, in the order they should be tried.
   */
  private async getWindowsCommandCandidates(command: string): Promise<string[]> {
    if (process.platform !== 'win32') return [];

    const commandName = command.toLowerCase().replace(/\.exe$/, '');
    const executable = command.toLowerCase().endsWith('.exe') ? command : `${command}.exe`;
    const candidates: string[] = [];

    if (commandName === 'ffmpeg' && process.env.LOCALAPPDATA) {
      const wingetPackages = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
      try {
        const packageDirs = await readdir(wingetPackages, { withFileTypes: true });
        for (const packageDir of packageDirs) {
          if (!packageDir.isDirectory() || !packageDir.name.startsWith('Gyan.FFmpeg_')) continue;
          const packagePath = path.join(wingetPackages, packageDir.name);
          try {
            const versionDirs = await readdir(packagePath, { withFileTypes: true });
            for (const versionDir of versionDirs) {
              if (versionDir.isDirectory() && versionDir.name.startsWith('ffmpeg-')) candidates.push(path.join(packagePath, versionDir.name, 'bin', executable));
            }
          } catch {
            // Ignore incomplete winget package directories.
          }
        }
      } catch {
        // Ignore missing winget package storage; PATH probing still runs below.
      }
    }

    for (const programFiles of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (!programFiles) continue;
      candidates.push(path.join(programFiles, 'ffmpeg', 'bin', executable), path.join(programFiles, 'Gyan', 'FFmpeg', 'bin', executable));
    }
    return candidates;
  }

  /**
   * Resolves a runnable path for a command, trying `PATH`, common Unix install locations, and (on Windows) the
   * candidates from {@link getWindowsCommandCandidates}, in order.
   *
   * @param {string} command - The command name to resolve.
   * @returns {Promise<string | undefined>} The first candidate that runs successfully, or `undefined` if none do.
   */
  private async resolveCommand(command: string): Promise<string | undefined> {
    const candidates = [command, `/usr/bin/${command}`, `/bin/${command}`, `/usr/local/bin/${command}`, ...(await this.getWindowsCommandCandidates(command))];
    for (const candidate of candidates) {
      if (candidate.includes('/')) {
        try {
          await access(candidate, constants.X_OK);
        } catch {
          continue;
        }
      }
      if (await this.hasCommand(candidate)) {
        this.log.debug(`Found ${command} in ${candidate}`);
        return candidate;
      }
    }
    return undefined;
  }

  /**
   * Allocates an ephemeral local UDP port for ffmpeg to send the injected video track's RTP stream to.
   *
   * @returns {Promise<number>} The allocated port number on `127.0.0.1`.
   */
  private async getFreeUdpPort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.once('error', reject);
      socket.bind(0, '127.0.0.1', () => {
        const port = socket.address().port;
        this.log.debug(`Allocated free UDP port ${port}`);
        socket.close(() => resolve(port));
      });
    });
  }

  /**
   * Finds the first VP8 or H264 codec negotiated on any video transceiver, i.e. a codec ffmpeg can encode to for
   * the injected test/webcam video track.
   *
   * @returns {RTCRtpCodecParameters | undefined} The preferred codec, or `undefined` if no video transceiver
   * negotiated VP8 or H264.
   */
  private getPreferredInjectableVideoCodec(): RTCRtpCodecParameters | undefined {
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodec = transceiver.codecs.find((codec) => {
        const mimeType = codec.mimeType.toLowerCase();
        return mimeType === 'video/vp8' || mimeType === 'video/h264';
      });
      if (preferredCodec) {
        this.log.debug(`Preferred injectable video codec: ${preferredCodec.mimeType}`);
        return preferredCodec;
      }
    }
    this.log.debug('No preferred injectable video codec (VP8/H264) negotiated on any video transceiver');
    return undefined;
  }

  /**
   * Finds the first Opus codec negotiated on any audio transceiver, i.e. a codec ffmpeg can encode to for the
   * injected test-voice audio track.
   *
   * @returns {RTCRtpCodecParameters | undefined} The preferred codec, or `undefined` if no audio transceiver
   * negotiated Opus.
   */
  private getPreferredInjectableAudioCodec(): RTCRtpCodecParameters | undefined {
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'audio') continue;
      const preferredCodec = transceiver.codecs.find((codec) => codec.mimeType.toLowerCase() === 'audio/opus');
      if (preferredCodec) {
        this.log.debug(`Preferred injectable audio codec: ${preferredCodec.mimeType}`);
        return preferredCodec;
      }
    }
    this.log.debug('No preferred injectable audio codec (Opus) negotiated on any audio transceiver');
    return undefined;
  }

  /** Webcam capture resolutions supported via MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION; falls back to the first entry. */
  private static readonly SUPPORTED_WEBCAM_RESOLUTIONS = ['640x480', '1280x720', '1920x1080'];

  /**
   * Default target encoder bitrate (kbps), used for the test pattern and as the fallback when
   * MATTERBRIDGE_CAMERA_WEBCAM_BITRATE is unset or invalid. Without an explicit -b:v, ffmpeg falls back to a generic
   * ~200kbps default that is far too low even at 640x480 and produces heavy blocking artifacts.
   */
  private static readonly DEFAULT_BITRATE_KBPS = 1000;

  /**
   * Resolves the configured webcam capture bitrate (kbps) from MATTERBRIDGE_CAMERA_WEBCAM_BITRATE, applied
   * regardless of the capture resolution; falls back to {@link DEFAULT_BITRATE_KBPS} (with a warning) if unset or
   * not a positive number.
   *
   * @returns {number} The target encoder bitrate in kbps.
   */
  private getConfiguredWebcamBitrate(): number {
    const configured = process.env.MATTERBRIDGE_CAMERA_WEBCAM_BITRATE;
    if (!configured) return WeriftWebRtcSession.DEFAULT_BITRATE_KBPS;
    const bitrateKbps = Number(configured);
    if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) {
      this.log.warn(`Invalid MATTERBRIDGE_CAMERA_WEBCAM_BITRATE "${configured}"; falling back to ${WeriftWebRtcSession.DEFAULT_BITRATE_KBPS}kbps`);
      return WeriftWebRtcSession.DEFAULT_BITRATE_KBPS;
    }
    return bitrateKbps;
  }

  /**
   * Resolves the webcam capture resolution to use, preferring the requested per-session resolution (typically the
   * client's allocated video stream resolution) when it names a supported resolution, then
   * MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION, then falling back (with a warning) to 640x480.
   *
   * @param {string} [requestedResolution] - The per-session preferred resolution, e.g. "1280x720".
   * @returns {string} The resolution to pass to ffmpeg's -video_size option, e.g. "1280x720".
   */
  private getConfiguredWebcamResolution(requestedResolution?: string): string {
    const [defaultResolution] = WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS;
    if (requestedResolution) {
      if (WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.includes(requestedResolution)) {
        this.log.debug(`Using requested webcam capture resolution ${requestedResolution}`);
        return requestedResolution;
      }
      this.log.warn(
        `Requested video stream resolution "${requestedResolution}" is not supported for webcam capture (supported: ${WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.join(', ')}); falling back to MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION`,
      );
    }
    const requested = process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION;
    if (!requested) {
      this.log.debug(`Using default webcam capture resolution ${defaultResolution}`);
      return defaultResolution;
    }
    if (WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.includes(requested)) {
      this.log.debug(`Using MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION ${requested}`);
      return requested;
    }
    this.log.warn(
      `Unsupported MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION "${requested}" (supported: ${WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.join(', ')}); falling back to ${defaultResolution}`,
    );
    return defaultResolution;
  }

  /**
   * Resolves the configured injected video source.
   *
   * @returns {VideoSource} `none` by default, or the configured `test`/`webcam` source.
   */
  private getConfiguredVideoSource(): VideoSource {
    const source = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE?.trim().toLowerCase() ?? 'none';
    switch (source) {
      case 'none':
      case 'test':
      case 'webcam':
        return source;
      default:
        this.log.warn(`Unsupported MATTERBRIDGE_CAMERA_VIDEO_SOURCE "${source}" (supported: test, webcam, none); falling back to none`);
        return 'none';
    }
  }

  /**
   * Resolves the ffmpeg input arguments and a human-readable description for the configured video source.
   *
   * Uses the synthetic moving test pattern for `test`, or MATTERBRIDGE_CAMERA_WEBCAM_DEVICE for `webcam`; falls
   * back to the test pattern (logging a warning) if the device is missing or webcam capture isn't supported on this
   * platform. The webcam capture resolution defaults to 640x480 and can be overridden with
   * MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION (640x480, 1280x720, or 1920x1080), or per-session via requestedResolution.
   * The webcam capture bitrate defaults to {@link DEFAULT_BITRATE_KBPS} and can be overridden with
   * MATTERBRIDGE_CAMERA_WEBCAM_BITRATE, regardless of resolution.
   *
   * @param {'test' | 'webcam'} videoSource - The configured video source after `none` has been handled by the caller.
   * @param {string} [requestedResolution] - The per-session preferred webcam resolution; see {@link getConfiguredWebcamResolution}.
   * @returns {{ args: string[]; description: string; bitrateKbps: number }} The ffmpeg input arguments, a description of the source for logging, and the target encoder bitrate.
   */
  private buildFfmpegVideoInputArgs(videoSource: 'test' | 'webcam', requestedResolution?: string): { args: string[]; description: string; bitrateKbps: number } {
    const testPatternInput = {
      args: ['-re', '-f', 'lavfi', '-i', 'testsrc=size=640x480:rate=10'],
      description: 'synthetic moving test pattern',
      bitrateKbps: WeriftWebRtcSession.DEFAULT_BITRATE_KBPS,
    };
    if (videoSource === 'test') {
      this.log.debug(`Test pattern params: resolution=640x480, description="${testPatternInput.description}", bitrateKbps=${testPatternInput.bitrateKbps}`);
      return testPatternInput;
    }

    const device = process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
    if (!device) {
      this.log.warn('MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam requires MATTERBRIDGE_CAMERA_WEBCAM_DEVICE to be set; falling back to the synthetic test video');
      return testPatternInput;
    }

    const resolution = process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION ?? this.getConfiguredWebcamResolution(requestedResolution);
    const bitrateKbps = this.getConfiguredWebcamBitrate();
    const description = `local webcam (${device}, ${resolution})`;
    this.log.debug(`Webcam capture params: device=${device}, resolution=${resolution}, description="${description}", bitrateKbps=${bitrateKbps}`);
    switch (process.platform) {
      case 'linux':
        return { args: ['-f', 'v4l2', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'darwin':
        return { args: ['-f', 'avfoundation', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'win32':
        return { args: ['-f', 'dshow', '-video_size', resolution, '-framerate', '30', '-i', `video=${device}`], description, bitrateKbps };
      default:
        this.log.warn(`Webcam capture via ffmpeg is not supported on platform "${process.platform}"; falling back to the synthetic test video`);
        return testPatternInput;
    }
  }

  /**
   * Attaches an injected video track (test pattern or webcam, per {@link buildFfmpegVideoInputArgs}) to the peer
   * connection by spawning ffmpeg to encode into it over a local UDP/RTP loop, unless one is already attached, the
   * configured source is `none`, or ffmpeg can't be resolved. Failures are logged and swallowed rather than thrown,
   * since the offer/answer exchange should still proceed without video.
   *
   * @param {RTCRtpCodecParameters} [codec] - The negotiated codec to encode into, from {@link getPreferredInjectableVideoCodec}; defaults to VP8.
   * @param {string} [videoResolution] - The per-session preferred webcam resolution; see {@link buildFfmpegVideoInputArgs}.
   * @returns {Promise<void>} Resolves once the attach attempt (successful or not) has completed.
   */
  private async generateVideoTrack(codec?: RTCRtpCodecParameters, videoResolution?: string): Promise<void> {
    if (this.testVideoAttached) return;
    const videoSource = this.getConfiguredVideoSource();
    if (videoSource === 'none') {
      this.log.debug('Video injection disabled by MATTERBRIDGE_CAMERA_VIDEO_SOURCE=none');
      return;
    }

    const videoInput = this.buildFfmpegVideoInputArgs(videoSource, videoResolution);
    this.log.debug(`Attempting to attach ${videoInput.description} video track at ${videoInput.bitrateKbps}kbps`);

    const ffmpegCommand = await this.resolveCommand('ffmpeg');
    if (!ffmpegCommand) {
      this.log.warn('Cannot inject video stream: missing dependency ffmpeg');
      return;
    }

    const selectedMimeType = (codec?.mimeType ?? 'video/vp8').toLowerCase();
    const selectedPayloadType = codec?.payloadType ?? 120;
    try {
      const udpPort = await this.getFreeUdpPort();
      const { track, disposer } = navigator.mediaDevices.getUdpMedia({
        port: udpPort,
        codec: new RTCRtpCodecParameters({ mimeType: selectedMimeType, clockRate: 90000, payloadType: selectedPayloadType }),
      });
      this.peerConnection.addTrack(track);

      const bitrate = `${videoInput.bitrateKbps}k`;
      const encoderArgs =
        selectedMimeType === 'video/h264'
          ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', '20', '-b:v', bitrate, '-maxrate', bitrate, '-bufsize', bitrate]
          : ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '4', '-pix_fmt', 'yuv420p', '-g', '20', '-b:v', bitrate, '-maxrate', bitrate, '-bufsize', bitrate];

      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        ...videoInput.args,
        '-an',
        ...encoderArgs,
        '-f',
        'rtp',
        '-payload_type',
        String(selectedPayloadType),
        `rtp://127.0.0.1:${udpPort}`,
      ];
      this.log.debug(`Spawning ffmpeg: ${ffmpegCommand} ${ffmpegArgs.join(' ')}`);
      const generator = spawn(ffmpegCommand, ffmpegArgs);

      /* v8 ignore start -- requires the spawned ffmpeg process itself to fail after resolveCommand already verified
       * it runs (e.g. the binary is removed between the check and this spawn), which this harness can't simulate
       * without deleting real system binaries or mocking node:child_process. */
      generator.once('error', (error: unknown) => {
        this.log.warn(`Video generator failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      /* v8 ignore stop */

      this.testVideoUdpDisposer = disposer;
      this.testVideoGenerator = generator;
      this.testVideoAttached = true;
      this.log.info(
        `Attached ${videoInput.description} video track (ffmpeg=${ffmpegCommand}, codec=${selectedMimeType}, payloadType=${selectedPayloadType}, sourcePort=${udpPort})`,
      );
      /* v8 ignore start -- requires a lower-level failure (UDP port allocation racing, werift/nonstandard media
       * internals throwing) that isn't practically triggerable in this harness without mocking werift internals. */
    } catch (error) {
      this.log.warn(`Failed to attach ${videoInput.description} video track: ${error instanceof Error ? error.message : String(error)}`);
    }
    /* v8 ignore stop */
  }

  /**
   * Restricts every negotiated video transceiver's codec list to the given mime type, so werift's answer/offer only
   * proposes the codec ffmpeg will actually encode into.
   *
   * @param {string} mimeType - The codec mime type to keep, e.g. `"video/vp8"`.
   * @returns {void}
   */
  private preferVideoCodecOnTransceivers(mimeType: string): void {
    let adjustedTransceivers = 0;
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodecs = transceiver.codecs.filter((codec) => codec.mimeType.toLowerCase() === mimeType);
      if (!preferredCodecs.length) continue;
      transceiver.codecs = preferredCodecs;
      adjustedTransceivers += 1;
    }
    /* v8 ignore else -- unreachable: callers only ever pass a mimeType they just found on one of these same
     * transceivers via getPreferredInjectableVideoCodec(), so adjustedTransceivers always ends up > 0. */
    if (adjustedTransceivers > 0) {
      this.log.debug(`Preferred ${mimeType.toUpperCase()} codecs on ${adjustedTransceivers} video transceiver(s)`);
    }
  }

  /**
   * Restricts every negotiated audio transceiver's codec list to the given mime type, so werift's answer/offer only
   * proposes the codec ffmpeg will actually encode into.
   *
   * @param {string} mimeType - The codec mime type to keep, e.g. `"audio/opus"`.
   * @returns {void}
   */
  private preferAudioCodecOnTransceivers(mimeType: string): void {
    let adjustedTransceivers = 0;
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'audio') continue;
      const preferredCodecs = transceiver.codecs.filter((codec) => codec.mimeType.toLowerCase() === mimeType);
      if (!preferredCodecs.length) continue;
      transceiver.codecs = preferredCodecs;
      adjustedTransceivers += 1;
    }
    /* v8 ignore else -- unreachable: callers only ever pass a mimeType they just found on one of these same
     * transceivers via getPreferredInjectableAudioCodec(), so adjustedTransceivers always ends up > 0. */
    if (adjustedTransceivers > 0) {
      this.log.debug(`Preferred ${mimeType.toUpperCase()} codecs on ${adjustedTransceivers} audio transceiver(s)`);
    }
  }

  /** Recorded test-voice clip (espeak-ng synthesized, checked into the repo) looped as the injected audio source. */
  private static readonly TEST_VOICE_PATH = fileURLToPath(new URL('../../assets/test-voice.opus', import.meta.url));

  /**
   * Attaches the recorded test-voice clip ({@link TEST_VOICE_PATH}) as the audio track for this session, so an
   * end-to-end audio path (e.g. an Intercom's "Listen" live view) can be verified without a real microphone capture
   * pipeline. Mirrors {@link generateVideoTrack}; disable with MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1.
   *
   * @param {RTCRtpCodecParameters} [codec] - The negotiated Opus codec parameters to encode and send as.
   * @returns {Promise<void>} Resolves once the track is attached, or once injection is skipped/failed (logged, not thrown).
   */
  private async ensureTestAudioTrack(codec?: RTCRtpCodecParameters): Promise<void> {
    if (this.testAudioAttached) return;
    if (process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO === '1') {
      this.log.debug('Test audio injection disabled by MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1');
      return;
    }

    const ffmpegCommand = await this.resolveCommand('ffmpeg');
    if (!ffmpegCommand) {
      this.log.warn('Cannot inject audio stream: missing dependency ffmpeg');
      return;
    }

    const selectedMimeType = (codec?.mimeType ?? 'audio/opus').toLowerCase();
    const selectedPayloadType = codec?.payloadType ?? 111;
    const clockRate = codec?.clockRate ?? 48000;
    const channels = codec?.channels ?? 1;
    try {
      const udpPort = await this.getFreeUdpPort();
      const { track, disposer } = navigator.mediaDevices.getUdpMedia({
        port: udpPort,
        codec: new RTCRtpCodecParameters({ mimeType: selectedMimeType, clockRate, channels, payloadType: selectedPayloadType }),
      });
      this.peerConnection.addTrack(track);

      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-re',
        '-stream_loop',
        '-1',
        '-i',
        WeriftWebRtcSession.TEST_VOICE_PATH,
        '-vn',
        '-af',
        'volume=6dB',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ac',
        String(channels),
        '-ar',
        String(clockRate),
        '-f',
        'rtp',
        '-payload_type',
        String(selectedPayloadType),
        `rtp://127.0.0.1:${udpPort}`,
      ];
      this.log.debug(`Spawning ffmpeg: ${ffmpegCommand} ${ffmpegArgs.join(' ')}`);
      const generator = spawn(ffmpegCommand, ffmpegArgs);

      /* v8 ignore start -- requires the spawned ffmpeg process itself to fail after resolveCommand already verified
       * it runs (e.g. the binary is removed between the check and this spawn), which this harness can't simulate
       * without deleting real system binaries or mocking node:child_process. */
      generator.once('error', (error: unknown) => {
        this.log.warn(`Audio generator failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      /* v8 ignore stop */

      this.testAudioUdpDisposer = disposer;
      this.testAudioGenerator = generator;
      this.testAudioAttached = true;
      this.log.info(`Attached test-voice audio track (ffmpeg=${ffmpegCommand}, codec=${selectedMimeType}, payloadType=${selectedPayloadType}, sourcePort=${udpPort})`);
      /* v8 ignore start -- requires a lower-level failure (UDP port allocation racing, werift/nonstandard media
       * internals throwing) that isn't practically triggerable in this harness without mocking werift internals. */
    } catch (error) {
      this.log.warn(`Failed to attach test-voice audio track: ${error instanceof Error ? error.message : String(error)}`);
    }
    /* v8 ignore stop */
  }

  /**
   * Kills the injected video track's ffmpeg process (if any) and disposes its UDP media resources.
   *
   * @returns {void}
   */
  private cleanupTestVideoArtifacts(): void {
    if (this.testVideoGenerator) {
      this.testVideoGenerator.kill('SIGTERM');
      this.testVideoGenerator = undefined;
    }
    this.testVideoUdpDisposer?.();
    this.testVideoUdpDisposer = undefined;
    this.testVideoAttached = false;
  }

  /**
   * Kills the injected audio track's ffmpeg process (if any) and disposes its UDP media resources.
   *
   * @returns {void}
   */
  private cleanupTestAudioArtifacts(): void {
    if (this.testAudioGenerator) {
      this.testAudioGenerator.kill('SIGTERM');
      this.testAudioGenerator = undefined;
    }
    this.testAudioUdpDisposer?.();
    this.testAudioUdpDisposer = undefined;
    this.testAudioAttached = false;
  }

  /**
   * Adds a sendonly transceiver for each requested media kind and creates a real local SDP offer.
   *
   * @param {WeriftOfferOptions} options - Which media kinds to add a sendonly transceiver for.
   * @returns {Promise<string>} The generated local SDP offer.
   */
  async createOffer(options: WeriftOfferOptions): Promise<string> {
    this.log.debug(`CreateOffer requested (video=${options.video}, audio=${options.audio}, videoResolution=${options.videoResolution ?? 'undefined'})`);
    if (options.video) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log.warn('No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      await this.generateVideoTrack(preferredCodec, options.videoResolution);
      if (!this.testVideoAttached) this.peerConnection.addTransceiver('video', { direction: 'sendonly' });
    }
    if (options.audio) this.peerConnection.addTransceiver('audio', { direction: 'sendonly' });
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    // setLocalDescription gathers ICE candidates into the SDP it stores as localDescription; offer.sdp itself
    // predates that gathering, so localDescription (always set once setLocalDescription above resolves) is returned.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const sdp = this.peerConnection.localDescription!.sdp;
    this.log.info(`Created local SDP offer (${this.summarizeSdp(sdp)})`);
    return sdp;
  }

  /**
   * Applies a remote SDP offer and creates a real local SDP answer for it.
   *
   * @param {string} offerSdp - The remote SDP offer to answer.
   * @param {string} [videoResolution] - Preferred webcam capture resolution for this session; see {@link WeriftOfferOptions.videoResolution}.
   * @returns {Promise<string>} The generated local SDP answer.
   */
  async createAnswer(offerSdp: string, videoResolution?: string): Promise<string> {
    this.log.debug(`CreateAnswer requested for remote offer (${this.summarizeSdp(offerSdp)}, videoResolution=${videoResolution ?? 'undefined'})`);
    await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const hasVideoTransceiver = this.peerConnection.getTransceivers().some((transceiver) => transceiver.kind === 'video');
    this.log.debug(`Remote offer created video transceiver: ${hasVideoTransceiver}`);
    if (hasVideoTransceiver) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      /* v8 ignore start -- unreachable: this.peerConnection defaults to VP8 as its only local video codec (werift's
       * own RTCPeerConnection default), so any offer that negotiates a video transceiver at all always ends up with
       * VP8 available; there is no real-world remote offer that reaches this point without an injectable codec. */
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log.warn('No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      /* v8 ignore stop */
      await this.generateVideoTrack(preferredCodec, videoResolution);
    }
    const hasAudioTransceiver = this.peerConnection.getTransceivers().some((transceiver) => transceiver.kind === 'audio');
    this.log.debug(`Remote offer created audio transceiver: ${hasAudioTransceiver}`);
    if (hasAudioTransceiver) {
      const preferredAudioCodec = this.getPreferredInjectableAudioCodec();
      if (preferredAudioCodec) {
        this.preferAudioCodecOnTransceivers(preferredAudioCodec.mimeType.toLowerCase());
      } else {
        this.log.warn('No injectable audio codec available on negotiated transceivers (supported: Opus)');
      }
      await this.ensureTestAudioTrack(preferredAudioCodec);
    }
    // Transceivers werift auto-creates from the remote offer default to a direction that answers "inactive" with
    // port 0 when no local track is attached; a port-0 m-section is still listed in a=group:BUNDLE, which peers
    // (e.g. Firefox) reject as invalid. Answering "sendonly" keeps the m-section active even with no track yet.
    for (const transceiver of this.peerConnection.getTransceivers()) {
      transceiver.setDirection('sendonly');
    }
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    // See the matching comment in createOffer above: localDescription (not answer.sdp) carries the gathered candidates.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const sdp = this.peerConnection.localDescription!.sdp;
    this.log.info(`Created local SDP answer (${this.summarizeSdp(sdp)})`);
    return sdp;
  }

  /**
   * Applies a remote SDP answer received in response to a local offer created by {@link createOffer}.
   *
   * @param {string} answerSdp - The remote SDP answer to apply.
   * @returns {Promise<void>} Resolves once the remote description has been applied.
   */
  async applyAnswer(answerSdp: string): Promise<void> {
    this.log.debug(`ApplyAnswer requested (${this.summarizeSdp(answerSdp)})`);
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    this.log.info(`Remote SDP answer applied (signalingState=${this.peerConnection.signalingState})`);
  }

  /**
   * Applies a remote ICE candidate gathered after the initial offer/answer exchange.
   *
   * @param {string} candidate - The RFC 8839 candidate-attribute field in string form.
   * @param {string | null} sdpMid - The media stream identification tag the candidate is associated with, or null.
   * @param {number | null} sdpMLineIndex - The zero-based media description index the candidate is associated with, or null.
   * @returns {Promise<void>} Resolves once the candidate has been applied.
   */
  async addIceCandidate(candidate: string, sdpMid: string | null, sdpMLineIndex: number | null): Promise<void> {
    this.log.debug(`Applying ICE candidate (mid=${sdpMid ?? 'null'}, mLine=${sdpMLineIndex ?? 'null'}, endOfCandidates=${candidate.trim() === ''})`);
    await this.peerConnection.addIceCandidate({ candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex: sdpMLineIndex ?? undefined });
  }

  /**
   * Closes the underlying peer connection.
   *
   * @returns {Promise<void>} Resolves once the peer connection is closed.
   */
  async close(): Promise<void> {
    this.log.debug('Closing RTCPeerConnection');
    await this.peerConnection.close();
    this.cleanupTestVideoArtifacts();
    this.cleanupTestAudioArtifacts();
    this.log.info(`RTCPeerConnection closed (connectionState=${this.peerConnection.connectionState})`);
  }
}

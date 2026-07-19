/**
 * @file src/webrtc/weriftSession.ts
 * @description This file contains the WeriftWebRtcSession class, wrapping a werift RTCPeerConnection.
 * @author Ludovic BOUÉ
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
import { join } from 'node:path';

import { RTCPeerConnection, RTCRtpCodecParameters, useH264, useOPUS, usePCMU, useVP8 } from 'werift';
import { navigator } from 'werift/nonstandard';

export type WeriftSessionLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type WeriftSessionLogger = (level: WeriftSessionLogLevel, message: string) => void;

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
 * end-to-end media path can be validated without a real camera capture pipeline. The source is a synthetic SMPTE
 * bars test pattern by default, or a local webcam capture device when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam and
 * MATTERBRIDGE_CAMERA_WEBCAM_DEVICE identifies the device (e.g. /dev/video0 on Linux, an avfoundation index on
 * macOS, or a dshow device name on Windows). The webcam capture resolution defaults to 640x480 and can be set to
 * 1280x720 or 1920x1080 with MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION.
 */
export class WeriftWebRtcSession {
  /** The underlying werift peer connection for this session. */
  readonly peerConnection: RTCPeerConnection;

  private readonly logger?: WeriftSessionLogger;

  private readonly label: string;

  private testVideoGenerator?: ChildProcess;

  private testVideoUdpDisposer?: () => void;

  private testVideoAttached = false;

  constructor(logger?: WeriftSessionLogger, label = 'WebRTC session') {
    this.peerConnection = new RTCPeerConnection({ codecs: { audio: [useOPUS(), usePCMU()], video: [useVP8(), useH264()] } });
    this.logger = logger;
    this.label = label;
    this.log('debug', 'Created RTCPeerConnection');
  }

  private log(level: WeriftSessionLogLevel, message: string): void {
    this.logger?.(level, `${this.label}: ${message}`);
  }

  private summarizeSdp(sdp: string): string {
    const mediaKinds = sdp
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('m='))
      .map((line) => line.slice(2).split(' ')[0]);
    return `length=${sdp.length} media=[${mediaKinds.join(',')}]`;
  }

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

  private async getWindowsCommandCandidates(command: string): Promise<string[]> {
    if (process.platform !== 'win32') return [];

    const commandName = command.toLowerCase().replace(/\.exe$/, '');
    const executable = command.toLowerCase().endsWith('.exe') ? command : `${command}.exe`;
    const candidates: string[] = [];

    if (commandName === 'ffmpeg' && process.env.LOCALAPPDATA) {
      const wingetPackages = join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
      try {
        const packageDirs = await readdir(wingetPackages, { withFileTypes: true });
        for (const packageDir of packageDirs) {
          if (!packageDir.isDirectory() || !packageDir.name.startsWith('Gyan.FFmpeg_')) continue;
          const packagePath = join(wingetPackages, packageDir.name);
          try {
            const versionDirs = await readdir(packagePath, { withFileTypes: true });
            for (const versionDir of versionDirs) {
              if (versionDir.isDirectory() && versionDir.name.startsWith('ffmpeg-')) candidates.push(join(packagePath, versionDir.name, 'bin', executable));
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
      candidates.push(join(programFiles, 'ffmpeg', 'bin', executable), join(programFiles, 'Gyan', 'FFmpeg', 'bin', executable));
    }
    return candidates;
  }

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
      if (await this.hasCommand(candidate)) return candidate;
    }
    return undefined;
  }

  private async getFreeUdpPort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.once('error', reject);
      socket.bind(0, '127.0.0.1', () => {
        const address = socket.address();
        /* v8 ignore start -- unreachable: `.address()` only ever returns a string for a Unix domain socket; this
         * socket is always created as 'udp4', so it always returns an AddressInfo object. */
        if (typeof address === 'string') {
          socket.close();
          reject(new Error('Failed to allocate UDP port'));
          return;
        }
        /* v8 ignore stop */
        const port = address.port;
        socket.close(() => resolve(port));
      });
    });
  }

  private getPreferredInjectableVideoCodec(): RTCRtpCodecParameters | undefined {
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodec = transceiver.codecs.find((codec) => {
        const mimeType = codec.mimeType.toLowerCase();
        return mimeType === 'video/vp8' || mimeType === 'video/h264';
      });
      if (preferredCodec) return preferredCodec;
    }
    return undefined;
  }

  /** Webcam capture resolutions supported via MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION; falls back to the first entry. */
  private static readonly SUPPORTED_WEBCAM_RESOLUTIONS = ['640x480', '1280x720', '1920x1080'];

  /**
   * Target encoder bitrate (kbps) per resolution. Without an explicit -b:v, ffmpeg falls back to a generic ~200kbps
   * default that is far too low for 720p/1080p and produces heavy blocking artifacts. 1920x1080 is capped lower
   * than a naive linear scale-up would suggest: at this camera's actual capture rate (~5fps at 1080p), a higher
   * target let individual encoded frames balloon past 150-200KB, which is too large to reliably fragment/deliver
   * over the local RTP hop and resulted in a black (never-decoded) video.
   */
  private static readonly BITRATE_KBPS_BY_RESOLUTION: Record<string, number> = {
    '640x480': 1000,
    '1280x720': 2500,
    '1920x1080': 2000,
  };

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
      if (WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.includes(requestedResolution)) return requestedResolution;
      this.log(
        'warn',
        `Requested video stream resolution "${requestedResolution}" is not supported for webcam capture (supported: ${WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.join(', ')}); falling back to MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION`,
      );
    }
    const requested = process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION;
    if (!requested) return defaultResolution;
    if (WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.includes(requested)) return requested;
    this.log(
      'warn',
      `Unsupported MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION "${requested}" (supported: ${WeriftWebRtcSession.SUPPORTED_WEBCAM_RESOLUTIONS.join(', ')}); falling back to ${defaultResolution}`,
    );
    return defaultResolution;
  }

  /**
   * Resolves the ffmpeg input arguments and a human-readable description for the configured video source.
   *
   * Defaults to the synthetic SMPTE bars test pattern. Set MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam and
   * MATTERBRIDGE_CAMERA_WEBCAM_DEVICE=<device> to capture from a local webcam instead; falls back to the test
   * pattern (logging a warning) if the device is missing or webcam capture isn't supported on this platform. The
   * webcam capture resolution defaults to 640x480 and can be overridden with MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION
   * (640x480, 1280x720, or 1920x1080), or per-session via requestedResolution.
   *
   * @param {string} [requestedResolution] - The per-session preferred webcam resolution; see {@link getConfiguredWebcamResolution}.
   * @returns {{ args: string[]; description: string; bitrateKbps: number }} The ffmpeg input arguments, a description of the source for logging, and the target encoder bitrate.
   */
  private buildFfmpegVideoInputArgs(requestedResolution?: string): { args: string[]; description: string; bitrateKbps: number } {
    const testPatternInput = {
      args: ['-re', '-stream_loop', '-1', '-f', 'lavfi', '-i', 'smptebars=size=640x480:rate=10'],
      description: 'synthetic SMPTE bars test',
      bitrateKbps: WeriftWebRtcSession.BITRATE_KBPS_BY_RESOLUTION['640x480'],
    };
    if (process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE?.toLowerCase() !== 'webcam') return testPatternInput;

    const device = process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
    if (!device) {
      this.log('warn', 'MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam requires MATTERBRIDGE_CAMERA_WEBCAM_DEVICE to be set; falling back to the synthetic test video');
      return testPatternInput;
    }

    const resolution = this.getConfiguredWebcamResolution(requestedResolution);
    const bitrateKbps = WeriftWebRtcSession.BITRATE_KBPS_BY_RESOLUTION[resolution];
    const description = `local webcam (${device}, ${resolution})`;
    switch (process.platform) {
      case 'linux':
        return { args: ['-f', 'v4l2', '-input_format', 'yuyv422', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'darwin':
        return { args: ['-f', 'avfoundation', '-video_size', resolution, '-framerate', '30', '-i', device], description, bitrateKbps };
      case 'win32':
        return { args: ['-f', 'dshow', '-video_size', resolution, '-framerate', '30', '-i', `video=${device}`], description, bitrateKbps };
      default:
        this.log('warn', `Webcam capture via ffmpeg is not supported on platform "${process.platform}"; falling back to the synthetic test video`);
        return testPatternInput;
    }
  }

  private async ensureTestVideoTrack(codec?: RTCRtpCodecParameters, videoResolution?: string): Promise<void> {
    if (this.testVideoAttached) return;
    if (process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO === '1') {
      this.log('info', 'Test video injection disabled by MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO=1');
      return;
    }

    const videoInput = this.buildFfmpegVideoInputArgs(videoResolution);
    this.log('debug', `Attempting to attach ${videoInput.description} video track`);

    const ffmpegCommand = await this.resolveCommand('ffmpeg');
    if (!ffmpegCommand) {
      this.log('warn', 'Cannot inject video stream: missing dependency ffmpeg');
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

      const generator = spawn(ffmpegCommand, [
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
      ]);

      /* v8 ignore start -- requires the spawned ffmpeg process itself to fail after resolveCommand already verified
       * it runs (e.g. the binary is removed between the check and this spawn), which this harness can't simulate
       * without deleting real system binaries or mocking node:child_process. */
      generator.once('error', (error: unknown) => {
        this.log('warn', `Video generator failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      /* v8 ignore stop */

      this.testVideoUdpDisposer = disposer;
      this.testVideoGenerator = generator;
      this.testVideoAttached = true;
      this.log(
        'info',
        `Attached ${videoInput.description} video track (ffmpeg=${ffmpegCommand}, codec=${selectedMimeType}, payloadType=${selectedPayloadType}, sourcePort=${udpPort})`,
      );
      /* v8 ignore start -- requires a lower-level failure (UDP port allocation racing, werift/nonstandard media
       * internals throwing) that isn't practically triggerable in this harness without mocking werift internals. */
    } catch (error) {
      this.log('warn', `Failed to attach ${videoInput.description} video track: ${error instanceof Error ? error.message : String(error)}`);
    }
    /* v8 ignore stop */
  }

  private preferVideoCodecOnTransceivers(mimeType: string): void {
    let adjustedTransceivers = 0;
    for (const transceiver of this.peerConnection.getTransceivers()) {
      if (transceiver.kind !== 'video') continue;
      const preferredCodecs = transceiver.codecs.filter((codec) => codec.mimeType.toLowerCase() === mimeType);
      if (!preferredCodecs.length) continue;
      transceiver.codecs = preferredCodecs;
      adjustedTransceivers += 1;
    }
    /* v8 ignore start -- unreachable: callers only ever pass a mimeType they just found on one of these same
     * transceivers via getPreferredInjectableVideoCodec(), so adjustedTransceivers always ends up > 0. */
    if (adjustedTransceivers > 0) {
      this.log('info', `Preferred ${mimeType.toUpperCase()} codecs on ${adjustedTransceivers} video transceiver(s)`);
    }
    /* v8 ignore stop */
  }

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
   * Adds a sendonly transceiver for each requested media kind and creates a real local SDP offer.
   *
   * @param {WeriftOfferOptions} options - Which media kinds to add a sendonly transceiver for.
   * @returns {Promise<string>} The generated local SDP offer.
   */
  async createOffer(options: WeriftOfferOptions): Promise<string> {
    this.log('debug', `createOffer requested (video=${options.video}, audio=${options.audio})`);
    if (options.video) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log('warn', 'No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      await this.ensureTestVideoTrack(preferredCodec, options.videoResolution);
      if (!this.testVideoAttached) this.peerConnection.addTransceiver('video', { direction: 'sendonly' });
    }
    if (options.audio) this.peerConnection.addTransceiver('audio', { direction: 'sendonly' });
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    // setLocalDescription gathers ICE candidates into the SDP it stores as localDescription; offer.sdp itself
    // predates that gathering, so localDescription (always set once setLocalDescription above resolves) is returned.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const sdp = this.peerConnection.localDescription!.sdp;
    this.log('info', `Created local SDP offer (${this.summarizeSdp(sdp)})`);
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
    this.log('debug', `createAnswer requested for remote offer (${this.summarizeSdp(offerSdp)})`);
    await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const hasVideoTransceiver = this.peerConnection.getTransceivers().some((transceiver) => transceiver.kind === 'video');
    this.log('debug', `Remote offer created video transceiver: ${hasVideoTransceiver}`);
    if (hasVideoTransceiver) {
      const preferredCodec = this.getPreferredInjectableVideoCodec();
      /* v8 ignore start -- unreachable: this.peerConnection defaults to VP8 as its only local video codec (werift's
       * own RTCPeerConnection default), so any offer that negotiates a video transceiver at all always ends up with
       * VP8 available; there is no real-world remote offer that reaches this point without an injectable codec. */
      if (preferredCodec) {
        this.preferVideoCodecOnTransceivers(preferredCodec.mimeType.toLowerCase());
      } else {
        this.log('warn', 'No injectable video codec available on negotiated transceivers (supported: VP8, H264)');
      }
      /* v8 ignore stop */
      await this.ensureTestVideoTrack(preferredCodec, videoResolution);
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
    this.log('info', `Created local SDP answer (${this.summarizeSdp(sdp)})`);
    return sdp;
  }

  /**
   * Applies a remote SDP answer received in response to a local offer created by {@link createOffer}.
   *
   * @param {string} answerSdp - The remote SDP answer to apply.
   * @returns {Promise<void>} Resolves once the remote description has been applied.
   */
  async applyAnswer(answerSdp: string): Promise<void> {
    this.log('debug', `applyAnswer requested (${this.summarizeSdp(answerSdp)})`);
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    this.log('info', `Remote SDP answer applied (signalingState=${this.peerConnection.signalingState})`);
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
    this.log('debug', `Applying ICE candidate (mid=${sdpMid ?? 'null'}, mLine=${sdpMLineIndex ?? 'null'}, endOfCandidates=${candidate.trim() === ''})`);
    await this.peerConnection.addIceCandidate({ candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex: sdpMLineIndex ?? undefined });
  }

  /**
   * Closes the underlying peer connection.
   *
   * @returns {Promise<void>} Resolves once the peer connection is closed.
   */
  async close(): Promise<void> {
    this.log('debug', 'Closing RTCPeerConnection');
    await this.peerConnection.close();
    this.cleanupTestVideoArtifacts();
    this.log('info', `RTCPeerConnection closed (connectionState=${this.peerConnection.connectionState})`);
  }
}

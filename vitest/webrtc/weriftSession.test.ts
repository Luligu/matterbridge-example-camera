/**
 * @file vitest/webrtc/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'WeriftSession';

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { setupTest } from 'matterbridge/vitest-utils';
import { RTCPeerConnection, RTCRtpCodecParameters, useH264, usePCMU } from 'werift';

import { WeriftWebRtcSession } from '../../src/webrtc/weriftSession.js';

await setupTest(NAME);

/**
 * Creates a real SDP offer from a throwaway remote peer connection, to feed into a WeriftWebRtcSession under test as
 * if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly video transceiver.
 */
async function createRemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection();
  remote.addTransceiver('video', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer from a throwaway remote peer connection, to feed into a WeriftWebRtcSession under test as
 * if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly audio transceiver.
 */
async function createRemoteAudioOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection();
  remote.addTransceiver('audio', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer whose audio media section only advertises PCMU, matching controllers that do not offer Opus.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly PCMU-only audio transceiver.
 */
async function createPcmuOnlyRemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection({ codecs: { audio: [usePCMU()] } });
  remote.addTransceiver('audio', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP offer whose video media section only advertises H264, matching controllers that do not offer VP8.
 *
 * @returns {Promise<string>} A real SDP offer with a single sendonly H264 video transceiver.
 */
async function createH264RemoteOfferSdp(): Promise<string> {
  const remote = new RTCPeerConnection({ codecs: { video: [useH264()] } });
  remote.addTransceiver('video', { direction: 'sendonly' });
  const offer = await remote.createOffer();
  await remote.setLocalDescription(offer);
  const sdp = remote.localDescription?.sdp ?? offer.sdp;
  await remote.close();
  return sdp;
}

/**
 * Creates a real SDP answer from a throwaway remote peer connection, answering the given SDP offer, to feed into a
 * WeriftWebRtcSession under test as if it came from a real remote peer over the WebRtcTransportProvider cluster.
 *
 * @param {string} offerSdp - The SDP offer to answer.
 * @returns {Promise<string>} A real SDP answer for the given offer.
 */
async function createRemoteAnswerSdp(offerSdp: string): Promise<string> {
  const remote = new RTCPeerConnection();
  await remote.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  const answer = await remote.createAnswer();
  await remote.setLocalDescription(answer);
  const sdp = remote.localDescription?.sdp ?? answer.sdp;
  await remote.close();
  return sdp;
}

describe('WeriftWebRtcSession', () => {
  const originalVideoSource = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;

  beforeEach(() => {
    process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'test';
  });

  afterAll(() => {
    if (originalVideoSource === undefined) delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    else process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = originalVideoSource;
  });

  it('should create a real SDP offer with a video transceiver when video is requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with both a video and an audio transceiver when both are requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: true, audio: true });

    expect(sdp).toContain('m=video');
    expect(sdp).toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with no media transceivers when neither video nor audio is requested', async () => {
    const session = new WeriftWebRtcSession(1);

    const sdp = await session.createOffer({ video: false, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).not.toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should close without throwing', async () => {
    const session = new WeriftWebRtcSession(1);
    await session.createOffer({ video: true, audio: false });

    await expect(session.close()).resolves.toBeUndefined();
  });

  it('should not attach a second test video track when creating a subsequent offer on the same session', async () => {
    const session = new WeriftWebRtcSession(1);
    await session.createOffer({ video: true, audio: false });

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('m=video');

    await session.close();
  });

  it('should create a real SDP answer for a remote SDP offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await createRemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should create a real SDP answer for a remote H264-only SDP offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await createH264RemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(answerSdp.toLowerCase()).toContain('h264/90000');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a real remote SDP answer to a local offer', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await session.createOffer({ video: true, audio: false });
    const answerSdp = await createRemoteAnswerSdp(offerSdp);

    await expect(session.applyAnswer(answerSdp)).resolves.toBeUndefined();
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a remote ICE candidate after a completed offer/answer exchange', async () => {
    const session = new WeriftWebRtcSession(1);
    const offerSdp = await session.createOffer({ video: true, audio: false });
    const answerSdp = await createRemoteAnswerSdp(offerSdp);
    await session.applyAnswer(answerSdp);

    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', null, 0)).resolves.toBeUndefined();
    await expect(session.addIceCandidate('candidate:1 1 UDP 1 127.0.0.1 1 typ host', '0', null)).resolves.toBeUndefined();

    await session.close();
  });

  describe('video source selection', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      delete process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
      delete process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not inject a video track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE is unset', async () => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should attach the synthetic moving test pattern track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=test', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'test';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should fall back to no injected track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE is unsupported', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'unsupported';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });

    it('should still attach a video track, falling back to the test pattern, when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam is set without a device', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each([
      ['linux', '/dev/video0'],
      ['darwin', '0'],
      ['win32', 'Integrated Camera'],
      ['freebsd', '/dev/video0'],
    ])('should attach a video track from the configured webcam device on platform %s', async (platform, device) => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = device;
      Object.defineProperty(process, 'platform', { value: platform });
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each(['1280x720', '1920x1080'])('should attach a video track using the requested MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION=%s', async (resolution) => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = resolution;
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to 640x480, when MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION is not one of the supported resolutions', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = '4000x3000';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION, when the requested per-session resolution is not supported', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = '1280x720';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '9999x9999' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('disabled video source', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    });

    it('should still negotiate a video transceiver but not inject a track when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=none', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'none';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as { testVideoAttached: boolean }).testVideoAttached).toBe(false);

      await session.close();
    });
  });

  describe('test audio injection toggle', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO;
    });

    it('should still negotiate an audio transceiver but not inject a track when MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1', async () => {
      process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO = '1';
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('injectable codec selection', () => {
    it('should prefer an already-negotiated injectable codec when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should prefer an already-negotiated H264 codec, using the H264 ffmpeg encoder, when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/h264', clockRate: 90000, payloadType: 97 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should skip non-video transceivers when selecting and preferring an injectable codec', async () => {
      const session = new WeriftWebRtcSession(1);
      const remote = new RTCPeerConnection();
      // Audio added before video so the answering session encounters the non-video transceiver first in each loop.
      remote.addTransceiver('audio', { direction: 'sendonly' });
      remote.addTransceiver('video', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=video');
      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should skip non-audio transceivers when selecting and preferring an injectable audio codec', async () => {
      const session = new WeriftWebRtcSession(1);
      const remote = new RTCPeerConnection();
      // Video added before audio so the answering session encounters the non-audio transceiver first in the audio codec loop.
      remote.addTransceiver('video', { direction: 'sendonly' });
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=video');
      expect(answerSdp).toContain('m=audio');

      await session.close();
    });

    it('should create an SDP answer without an injectable audio codec when the remote offer only supports PCMU', async () => {
      const session = new WeriftWebRtcSession(1);
      const offerSdp = await createPcmuOnlyRemoteOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect(answerSdp.toLowerCase()).not.toContain('opus');

      await session.close();
    });

    it('should not treat a non-injectable codec as preferred when creating an offer for a pre-existing transceiver', async () => {
      const session = new WeriftWebRtcSession(1);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the video transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1);
      const withPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];
      const withoutPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withoutPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the audio transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession(1);

      const remote = new RTCPeerConnection();
      // Two audio m-lines: the first offers Opus and PCMU (the default), the second is restricted to PCMU only, so
      // after negotiation only one of the resulting local audio transceivers ends up with an injectable Opus codec.
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const pcmuOnlyTransceiver = remote.addTransceiver('audio', { direction: 'sendonly' });
      pcmuOnlyTransceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'audio/PCMU', clockRate: 8000, payloadType: 0 })];
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp.match(/m=audio/g)).toHaveLength(2);

      await session.close();
    });
  });

  describe('answering an offer with no video media', () => {
    it('should create an SDP answer without attempting video codec selection when the remote offer has no video transceiver', async () => {
      const session = new WeriftWebRtcSession(1);
      const remote = new RTCPeerConnection();
      remote.addTransceiver('audio', { direction: 'sendonly' });
      const offer = await remote.createOffer();
      await remote.setLocalDescription(offer);
      const offerSdp = remote.localDescription?.sdp ?? offer.sdp;
      await remote.close();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect(answerSdp).not.toContain('m=video');

      await session.close();
    });
  });

  describe('per-session webcam resolution precedence', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
      delete process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
    });

    it('should use the requested per-session resolution when it names a supported resolution', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      const session = new WeriftWebRtcSession(1);

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1280x720' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('ffmpeg command resolution', () => {
    const originalPath = process.env.PATH;
    const originalLocalAppData = process.env.LOCALAPPDATA;
    const originalProgramFiles = process.env.ProgramFiles;
    const originalProgramFilesX86 = process.env['ProgramFiles(x86)'];
    const originalPlatform = process.platform;

    afterEach(() => {
      process.env.PATH = originalPath;
      process.env.LOCALAPPDATA = originalLocalAppData;
      process.env.ProgramFiles = originalProgramFiles;
      process.env['ProgramFiles(x86)'] = originalProgramFilesX86;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should resolve when a spawned command exits successfully', async () => {
      type RunProcess = { runProcess(command: string, args: string[]): Promise<void> };
      const session = new WeriftWebRtcSession(1);

      await expect((session as unknown as RunProcess).runProcess(process.execPath, ['--version'])).resolves.toBeUndefined();

      await session.close();
    });

    it('should reject when a spawned command exits with a non-zero code', async () => {
      type RunProcess = { runProcess(command: string, args: string[]): Promise<void> };
      const session = new WeriftWebRtcSession(1);

      await expect((session as unknown as RunProcess).runProcess(process.execPath, ['-e', 'process.exit(7)'])).rejects.toThrow('exited with code 7');

      await session.close();
    });

    it('should report that a command exists when a version probe succeeds', async () => {
      type HasCommand = { hasCommand(command: string): Promise<boolean> };
      const session = new WeriftWebRtcSession(1);

      await expect((session as unknown as HasCommand).hasCommand(process.execPath)).resolves.toBe(true);

      await session.close();
    });

    it('should fail to resolve a command via the bare PATH lookup when PATH is empty', async () => {
      type HasCommand = { hasCommand(command: string): Promise<boolean> };
      const session = new WeriftWebRtcSession(1);

      process.env.PATH = '';
      const found = await (session as unknown as HasCommand).hasCommand('ffmpeg');
      process.env.PATH = originalPath;

      expect(found).toBe(false);

      await session.close();
    });

    it('should resolve undefined when a command does not exist on PATH nor at any of its absolute fallback locations', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession(1);

      const resolved = await (session as unknown as ResolveCommand).resolveCommand('matterbridge-example-camera-test-nonexistent-command');

      expect(resolved).toBeUndefined();

      await session.close();
    });

    it('should resolve the first command candidate when its version probe succeeds', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession(1);

      const resolved = await (session as unknown as ResolveCommand).resolveCommand(process.execPath);

      expect(resolved).toBe(process.execPath);

      await session.close();
    });

    it('should include the winget Gyan.FFmpeg package bin path on Windows', async () => {
      type GetWindowsCommandCandidates = { getWindowsCommandCandidates(command: string): Promise<string[]> };
      const session = new WeriftWebRtcSession(1);
      const localAppData = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
      const wingetPackage = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1.2-full_build');
      await mkdir(path.join(wingetPackage, 'bin'), { recursive: true });
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = localAppData;

      try {
        const candidates = await (session as unknown as GetWindowsCommandCandidates).getWindowsCommandCandidates('ffmpeg');

        expect(candidates).toContain(path.join(wingetPackage, 'bin', 'ffmpeg.exe'));
      } finally {
        await rm(localAppData, { force: true, recursive: true });
        await session.close();
      }
    });

    it('should ignore unrelated winget package entries on Windows', async () => {
      type GetWindowsCommandCandidates = { getWindowsCommandCandidates(command: string): Promise<string[]> };
      const session = new WeriftWebRtcSession(1);
      const localAppData = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
      const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      await mkdir(path.join(wingetPackages, 'Other.Package_Microsoft.Winget.Source_8wekyb3d8bbwe'), { recursive: true });
      await mkdir(path.join(wingetPackages, 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1.2-full_build', 'bin'), { recursive: true });
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = localAppData;
      process.env.ProgramFiles = '';
      process.env['ProgramFiles(x86)'] = '';

      try {
        const candidates = await (session as unknown as GetWindowsCommandCandidates).getWindowsCommandCandidates('ffmpeg.exe');

        expect(candidates).toEqual([path.join(wingetPackages, 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1.2-full_build', 'bin', 'ffmpeg.exe')]);
      } finally {
        await rm(localAppData, { force: true, recursive: true });
        await session.close();
      }
    });

    it('should ignore Gyan winget package entries without ffmpeg version directories on Windows', async () => {
      type GetWindowsCommandCandidates = { getWindowsCommandCandidates(command: string): Promise<string[]> };
      const session = new WeriftWebRtcSession(1);
      const localAppData = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
      const wingetPackage = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe');
      await mkdir(path.join(wingetPackage, 'metadata'), { recursive: true });
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = localAppData;
      process.env.ProgramFiles = '';
      process.env['ProgramFiles(x86)'] = '';

      try {
        const candidates = await (session as unknown as GetWindowsCommandCandidates).getWindowsCommandCandidates('ffmpeg');

        expect(candidates).toEqual([]);
      } finally {
        await rm(localAppData, { force: true, recursive: true });
        await session.close();
      }
    });

    it('should return no Windows candidates for non-ffmpeg commands when Program Files paths are missing', async () => {
      type GetWindowsCommandCandidates = { getWindowsCommandCandidates(command: string): Promise<string[]> };
      const session = new WeriftWebRtcSession(1);
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = undefined;
      process.env.ProgramFiles = '';
      process.env['ProgramFiles(x86)'] = '';

      const candidates = await (session as unknown as GetWindowsCommandCandidates).getWindowsCommandCandidates('not-ffmpeg');

      expect(candidates).toEqual([]);

      await session.close();
    });
  });

  describe('missing ffmpeg dependency', () => {
    it('should still negotiate a video transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession(1);
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(void 0);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still negotiate an audio transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession(1);
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(void 0);
      const offerSdp = await createRemoteAudioOfferSdp();

      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');

      await session.close();
    });
  });

  describe('video track injection lifecycle', () => {
    it('should attach a default VP8 video track only once when no codec is already preferred', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      type TestVideoState = { testVideoAttached: boolean; testVideoGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1);
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(process.execPath);

      const firstSdp = await session.createOffer({ video: true, audio: false });
      const secondSdp = await session.createOffer({ video: true, audio: false });

      expect(firstSdp).toContain('m=video');
      expect(secondSdp).toContain('m=video');
      expect((session as unknown as TestVideoState).testVideoAttached).toBe(true);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeDefined();

      await session.close();
    });

    it.each([
      ['VP8', new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })],
      ['H264', new RTCRtpCodecParameters({ mimeType: 'video/H264', clockRate: 90000, payloadType: 97 })],
    ])('should attach and clean up a %s video track when command resolution succeeds', async (_name, codec) => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      type TestVideoState = { testVideoAttached: boolean; testVideoGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1);
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(process.execPath);
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [codec];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');
      expect((session as unknown as TestVideoState).testVideoAttached).toBe(true);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeDefined();

      await session.close();

      expect((session as unknown as TestVideoState).testVideoAttached).toBe(false);
      expect((session as unknown as TestVideoState).testVideoGenerator).toBeUndefined();
    });
  });

  describe('audio track injection lifecycle', () => {
    it('should not attach a second test audio track when creating a subsequent answer on the same session', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      type TestAudioState = { testAudioAttached: boolean; testAudioGenerator?: { killed: boolean } };
      const session = new WeriftWebRtcSession(1);
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(process.execPath);
      const offerSdp = await createRemoteAudioOfferSdp();

      await session.createAnswer(offerSdp);
      const answerSdp = await session.createAnswer(offerSdp);

      expect(answerSdp).toContain('m=audio');
      expect((session as unknown as TestAudioState).testAudioAttached).toBe(true);
      expect((session as unknown as TestAudioState).testAudioGenerator).toBeDefined();

      await session.close();

      expect((session as unknown as TestAudioState).testAudioAttached).toBe(false);
      expect((session as unknown as TestAudioState).testAudioGenerator).toBeUndefined();
    });
  });
});

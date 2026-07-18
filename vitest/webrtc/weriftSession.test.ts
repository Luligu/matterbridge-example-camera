/**
 * @file vitest/webrtc/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Ludovic BOUÉ
 */

import { RTCPeerConnection, RTCRtpCodecParameters } from 'werift';

import { WeriftWebRtcSession } from '../../src/webrtc/weriftSession.js';

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
  it('should create a real SDP offer with a video transceiver when video is requested', async () => {
    const session = new WeriftWebRtcSession();

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with both a video and an audio transceiver when both are requested', async () => {
    const session = new WeriftWebRtcSession();

    const sdp = await session.createOffer({ video: true, audio: true });

    expect(sdp).toContain('m=video');
    expect(sdp).toContain('m=audio');

    await session.close();
  });

  it('should create a real SDP offer with no media transceivers when neither video nor audio is requested', async () => {
    const session = new WeriftWebRtcSession();

    const sdp = await session.createOffer({ video: false, audio: false });

    expect(sdp).toContain('v=0');
    expect(sdp).not.toContain('m=video');
    expect(sdp).not.toContain('m=audio');

    await session.close();
  });

  it('should close without throwing', async () => {
    const session = new WeriftWebRtcSession();
    await session.createOffer({ video: true, audio: false });

    await expect(session.close()).resolves.toBeUndefined();
  });

  it('should not attach a second test video track when creating a subsequent offer on the same session', async () => {
    const session = new WeriftWebRtcSession();
    await session.createOffer({ video: true, audio: false });

    const sdp = await session.createOffer({ video: true, audio: false });

    expect(sdp).toContain('m=video');

    await session.close();
  });

  it('should create a real SDP answer for a remote SDP offer', async () => {
    const session = new WeriftWebRtcSession();
    const offerSdp = await createRemoteOfferSdp();

    const answerSdp = await session.createAnswer(offerSdp);

    expect(answerSdp).toContain('v=0');
    expect(answerSdp).toContain('m=video');
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a real remote SDP answer to a local offer', async () => {
    const session = new WeriftWebRtcSession();
    const offerSdp = await session.createOffer({ video: true, audio: false });
    const answerSdp = await createRemoteAnswerSdp(offerSdp);

    await expect(session.applyAnswer(answerSdp)).resolves.toBeUndefined();
    expect(session.peerConnection.signalingState).toBe('stable');

    await session.close();
  });

  it('should apply a remote ICE candidate after a completed offer/answer exchange', async () => {
    const session = new WeriftWebRtcSession();
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

    it('should still attach a video track, falling back to the test pattern, when MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam is set without a device', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      const session = new WeriftWebRtcSession();

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
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it.each(['1280x720', '1920x1080'])('should attach a video track using the requested MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION=%s', async (resolution) => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = resolution;
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to 640x480, when MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION is not one of the supported resolutions', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = '4000x3000';
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should still attach a video track, falling back to MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION, when the requested per-session resolution is not supported', async () => {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = '/dev/video0';
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = '1280x720';
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '9999x9999' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('test video injection toggle', () => {
    afterEach(() => {
      delete process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO;
    });

    it('should still negotiate a video transceiver but not inject a track when MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO=1', async () => {
      process.env.MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO = '1';
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('injectable codec selection', () => {
    it('should prefer an already-negotiated injectable codec when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession();
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should prefer an already-negotiated H264 codec, using the H264 ffmpeg encoder, when creating a subsequent offer', async () => {
      const session = new WeriftWebRtcSession();
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/h264', clockRate: 90000, payloadType: 97 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should skip non-video transceivers when selecting and preferring an injectable codec', async () => {
      const session = new WeriftWebRtcSession();
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

    it('should not treat a non-injectable codec as preferred when creating an offer for a pre-existing transceiver', async () => {
      const session = new WeriftWebRtcSession();
      const transceiver = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      transceiver.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });

    it('should only adjust the video transceiver(s) that actually have the preferred codec available', async () => {
      const session = new WeriftWebRtcSession();
      const withPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP8', clockRate: 90000, payloadType: 96 })];
      const withoutPreferredCodec = session.peerConnection.addTransceiver('video', { direction: 'sendonly' });
      withoutPreferredCodec.codecs = [new RTCRtpCodecParameters({ mimeType: 'video/VP9', clockRate: 90000, payloadType: 98 })];

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('answering an offer with no video media', () => {
    it('should create an SDP answer without attempting video codec selection when the remote offer has no video transceiver', async () => {
      const session = new WeriftWebRtcSession();
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
      const session = new WeriftWebRtcSession();

      const sdp = await session.createOffer({ video: true, audio: false, videoResolution: '1280x720' });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });

  describe('ffmpeg command resolution', () => {
    const originalPath = process.env.PATH;

    afterEach(() => {
      process.env.PATH = originalPath;
    });

    it('should fail to resolve a command via the bare PATH lookup when PATH is empty', async () => {
      type HasCommand = { hasCommand(command: string): Promise<boolean> };
      const session = new WeriftWebRtcSession();

      process.env.PATH = '';
      const found = await (session as unknown as HasCommand).hasCommand('ffmpeg');
      process.env.PATH = originalPath;

      expect(found).toBe(false);

      await session.close();
    });

    it('should resolve undefined when a command does not exist on PATH nor at any of its absolute fallback locations', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession();

      const resolved = await (session as unknown as ResolveCommand).resolveCommand('matterbridge-example-camera-test-nonexistent-command');

      expect(resolved).toBeUndefined();

      await session.close();
    });
  });

  describe('missing ffmpeg dependency', () => {
    it('should still negotiate a video transceiver but not inject a track when ffmpeg cannot be resolved', async () => {
      type ResolveCommand = { resolveCommand(command: string): Promise<string | undefined> };
      const session = new WeriftWebRtcSession();
      vi.spyOn(session as unknown as ResolveCommand, 'resolveCommand').mockResolvedValue(void 0);

      const sdp = await session.createOffer({ video: true, audio: false });

      expect(sdp).toContain('m=video');

      await session.close();
    });
  });
});

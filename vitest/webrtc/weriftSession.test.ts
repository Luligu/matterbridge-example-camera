/**
 * @file vitest/webrtc/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Ludovic BOUÉ
 */

import { WeriftWebRtcSession } from '../../src/webrtc/weriftSession.js';

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
});

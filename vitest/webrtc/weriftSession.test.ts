/**
 * @file vitest/webrtc/weriftSession.test.ts
 * @description This file contains the tests for the WeriftWebRtcSession class.
 * @author Ludovic BOUÉ
 */

import { RTCPeerConnection } from 'werift';

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

    await session.close();
  });
});

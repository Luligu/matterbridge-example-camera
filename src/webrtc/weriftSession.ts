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

import { RTCPeerConnection } from 'werift';

/**
 * Media kinds to negotiate when creating a real WebRTC offer for a WebRtcTransportProvider session.
 */
export interface WeriftOfferOptions {
  /** Whether to add a sendonly video transceiver to the offer. */
  video: boolean;
  /** Whether to add a sendonly audio transceiver to the offer. */
  audio: boolean;
}

/**
 * Wraps a werift RTCPeerConnection for a single WebRtcTransportProvider session (see
 * MatterbridgeWebRtcTransportProviderServer in ../behaviors/webRtcTransportProviderServer.ts), so the session's SDP
 * offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded.
 *
 * This currently only covers SDP/ICE negotiation and connection teardown: it does not yet attach an encoded media
 * track to the negotiated transceivers, so no RTP flows once negotiated. Attaching a real encoder is a follow-up
 * step once this negotiation slice has been validated end to end.
 */
export class WeriftWebRtcSession {
  /** The underlying werift peer connection for this session. */
  readonly peerConnection: RTCPeerConnection;

  constructor() {
    this.peerConnection = new RTCPeerConnection();
  }

  /**
   * Adds a sendonly transceiver for each requested media kind and creates a real local SDP offer.
   *
   * @param {WeriftOfferOptions} options - Which media kinds to add a sendonly transceiver for.
   * @returns {Promise<string>} The generated local SDP offer.
   */
  async createOffer(options: WeriftOfferOptions): Promise<string> {
    if (options.video) this.peerConnection.addTransceiver('video', { direction: 'sendonly' });
    if (options.audio) this.peerConnection.addTransceiver('audio', { direction: 'sendonly' });
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    // setLocalDescription gathers ICE candidates into the SDP it stores as localDescription; offer.sdp itself
    // predates that gathering, so localDescription (always set once setLocalDescription above resolves) is returned.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    return this.peerConnection.localDescription!.sdp;
  }

  /**
   * Applies a remote SDP offer and creates a real local SDP answer for it.
   *
   * @param {string} offerSdp - The remote SDP offer to answer.
   * @returns {Promise<string>} The generated local SDP answer.
   */
  async createAnswer(offerSdp: string): Promise<string> {
    await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    // See the matching comment in createOffer above: localDescription (not answer.sdp) carries the gathered candidates.
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    return this.peerConnection.localDescription!.sdp;
  }

  /**
   * Applies a remote SDP answer received in response to a local offer created by {@link createOffer}.
   *
   * @param {string} answerSdp - The remote SDP answer to apply.
   * @returns {Promise<void>} Resolves once the remote description has been applied.
   */
  async applyAnswer(answerSdp: string): Promise<void> {
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
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
    await this.peerConnection.addIceCandidate({ candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex: sdpMLineIndex ?? undefined });
  }

  /**
   * Closes the underlying peer connection.
   *
   * @returns {Promise<void>} Resolves once the peer connection is closed.
   */
  async close(): Promise<void> {
    await this.peerConnection.close();
  }
}

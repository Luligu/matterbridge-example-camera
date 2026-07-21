/**
 * @file vitest/werift.test.ts
 * @description This file tests a complete local client/server WebRTC flow with werift.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { RTCPeerConnection } from 'werift';

const connectionTimeout = 10_000;
const mediaChunkSize = 16 * 1024;
const cameraMp4Url = new URL('../assets/test-camera.mp4', import.meta.url);

describe('werift client/server flow', () => {
  it('should negotiate, exchange ICE candidates, transfer data, and close both peers', async () => {
    // SDP — Session Description Protocol: describes the media session, including codecs, formats, transport parameters, and how each peer expects to communicate. The controller sends an SDP offer and the camera returns an SDP answer.
    // ICE — Interactive Connectivity Establishment: discovers and tests possible network paths between the peers. ICE candidates contain addresses and ports that may be used to establish the direct WebRTC connection.
    // DTLS — Datagram Transport Layer Security: authenticates the peers and encrypts communication over the selected UDP network path.
    // SCTP — Stream Control Transmission Protocol: transports WebRTC data-channel messages over the secure DTLS connection.

    // The client represents the Matter controller and initiates negotiation. The server represents the camera device.
    const client = new RTCPeerConnection();
    const server = new RTCPeerConnection();

    // In a real Matter flow, each candidate would be transported to the other peer through the WebRTC Transport
    // Provider/Requestor clusters. This local test collects them first and forwards them after the remote SDP is set.
    const clientCandidates: Parameters<RTCPeerConnection['addIceCandidate']>[0][] = [];
    const serverCandidates: Parameters<RTCPeerConnection['addIceCandidate']>[0][] = [];

    client.onIceCandidate.subscribe((candidate) => {
      if (candidate) clientCandidates.push(candidate);
    });
    server.onIceCandidate.subscribe((candidate) => {
      if (candidate) serverCandidates.push(candidate);
    });

    // Register all asynchronous observers before negotiation. Werift can connect quickly on localhost, so registering
    // them later could miss a state transition and make the test wait until its timeout.
    const serverChannelPromise = server.onDataChannel.asPromise(connectionTimeout);
    const clientChannel = client.createDataChannel('camera-control');
    const clientConnectedPromise = client.connectionStateChange.watch((state) => state === 'connected', connectionTimeout);
    const serverConnectedPromise = server.connectionStateChange.watch((state) => state === 'connected', connectionTimeout);
    const clientChannelOpenPromise = clientChannel.stateChanged.watch((state) => state === 'open', connectionTimeout);

    try {
      // 1. The controller creates its SDP offer. setLocalDescription starts ICE candidate gathering on the client.
      const offer = await client.createOffer();
      await client.setLocalDescription(offer);
      expect(client.localDescription?.type).toBe('offer');
      expect(clientCandidates.length).toBeGreaterThan(0);

      // 2. The camera applies the controller's offer and receives the controller's gathered ICE candidates.
      await server.setRemoteDescription(offer);
      for (const candidate of clientCandidates) await server.addIceCandidate(candidate);

      // 3. The camera creates its SDP answer. Its local description starts server-side ICE candidate gathering.
      const answer = await server.createAnswer();
      await server.setLocalDescription(answer);
      expect(server.localDescription?.type).toBe('answer');
      expect(serverCandidates.length).toBeGreaterThan(0);

      // 4. The controller applies the answer and receives the camera's ICE candidates. Both peers now have enough
      // signaling information to select an ICE pair, perform DTLS, and establish the SCTP data transport.
      await client.setRemoteDescription(answer);
      for (const candidate of serverCandidates) await client.addIceCandidate(candidate);

      // 5. Wait until ICE/DTLS negotiation has connected both peer connections.
      await Promise.all([clientConnectedPromise, serverConnectedPromise]);

      // The channel is created by the controller and appears asynchronously on the camera as a remote data channel.
      const [serverChannel] = await serverChannelPromise;
      if (serverChannel.readyState !== 'open') await serverChannel.stateChanged.watch((state) => state === 'open', connectionTimeout);
      await clientChannelOpenPromise;

      // 6. Model a controller request to start the camera live view.
      const requestPromise = serverChannel.onMessage.asPromise(connectionTimeout);
      clientChannel.send('start-live-view');
      await expect(requestPromise).resolves.toEqual(['start-live-view']);

      // 7. Model the camera acknowledging that its live view has started.
      const responsePromise = clientChannel.onMessage.asPromise(connectionTimeout);
      serverChannel.send('live-view-started');
      await expect(responsePromise).resolves.toEqual(['live-view-started']);

      // 8. Read the camera fixture and stream it from the camera/server to the controller/client in binary SCTP
      // messages. An MP4 is a file container rather than a WebRTC media payload, so this verifies reliable encrypted
      // file transport over the established data channel. A true video-track test must demux H.264 and packetize RTP.
      const cameraMp4 = await readFile(cameraMp4Url);
      const receivedMediaChunks: Buffer[] = [];
      let receivedMediaLength = 0;
      const mediaReceivedPromise = clientChannel.onMessage.watch((message) => {
        if (typeof message === 'string') return false;
        const chunk = Buffer.from(message);
        receivedMediaChunks.push(chunk);
        receivedMediaLength += chunk.length;
        return receivedMediaLength === cameraMp4.length;
      }, connectionTimeout);

      for (let offset = 0; offset < cameraMp4.length; offset += mediaChunkSize) {
        serverChannel.send(cameraMp4.subarray(offset, Math.min(offset + mediaChunkSize, cameraMp4.length)));
      }
      await mediaReceivedPromise;

      const receivedCameraMp4 = Buffer.concat(receivedMediaChunks);
      expect(receivedCameraMp4.length).toBe(cameraMp4.length);
      expect(createHash('sha256').update(receivedCameraMp4).digest('hex')).toBe(createHash('sha256').update(cameraMp4).digest('hex'));

      // Verify both the transport state and werift's per-channel message accounting.
      const mediaChunkCount = Math.ceil(cameraMp4.length / mediaChunkSize);
      expect(client.connectionState).toBe('connected');
      expect(server.connectionState).toBe('connected');
      expect(clientChannel.messagesSent).toBe(1);
      expect(serverChannel.messagesReceived).toBe(1);
      expect(serverChannel.messagesSent).toBe(1 + mediaChunkCount);
      expect(clientChannel.messagesReceived).toBe(1 + mediaChunkCount);
    } finally {
      // Always release UDP sockets and DTLS/SCTP resources, including when an assertion or negotiation step fails.
      await Promise.all([client.close(), server.close()]);
    }

    // 9. Confirm that teardown completed on both sides.
    expect(client.connectionState).toBe('closed');
    expect(server.connectionState).toBe('closed');
  }, 15_000);
});

/**
 * @file vitest/behaviors/webRtcTransportProviderServer.test.ts
 * @description This file contains the tests for the MatterbridgeWebRtcTransportProviderServer behavior.
 * @author Ludovic BOUÉ
 */

const NAME = 'WebRtcTransportProviderServerBehavior';
const MATTER_PORT = 6005;
const MATTER_CREATE_ONLY = true;

import { camera, MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { Identify, WebRtcTransportDefinitions, WebRtcTransportProvider, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage } from 'matterbridge/matter/types';
import { loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from 'matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from 'matterbridge/vitest-utils/matter';

import {
  addWebRtcTransportRequestorClient,
  createDefaultWebRtcTransportProviderClusterServer,
  MatterbridgeWebRtcTransportProviderServer,
} from '../../src/behaviors/webRtcTransportProviderServer.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('MatterbridgeWebRtcTransportProviderServer', () => {
  let device: Camera;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create and register a camera device using the MatterbridgeWebRtcTransportProviderServer behavior', async () => {
    device = new Camera('WebRtc Behavior', 'WEBRTC-BEHAVIOR');
    expect(device.behaviors.has(MatterbridgeWebRtcTransportProviderServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should reject solicitOffer without videoStreams or audioStreams', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).rejects.toThrow('solicitOffer requires at least one of videoStreams or audioStreams; automatic stream assignment is not implemented');
  });

  it('should solicit an offer and record a deferred session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Solicited a WebRTC offer for session 0'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(0);
    expect(currentSessions[0].streamUsage).toBe(StreamUsage.LiveView);
  });

  it('should solicit a second offer with an incremented session id', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.Recording,
        originatingEndpointId: EndpointNumber(1),
        audioStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Solicited a WebRTC offer for session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(1);
  });

  it('should end the second solicited session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 1, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(0);
  });

  it('should reject provideOffer for a new session without videoStreams or audioStreams', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'provideOffer requires at least one of videoStreams or audioStreams; automatic stream assignment is not implemented',
    );
  });

  it('should provide an offer for a new session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: null,
        sdp: 'v=0 o=- offer',
        streamUsage: StreamUsage.Recording,
        audioStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP offer for session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(1);
  });

  it('should provide an offer for a new session with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP offer for session 2'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].streamUsage).toBe(StreamUsage.LiveView);
  });

  it('should end the session created with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 2, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreamId: 0, audioStreamId: null }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP offer for session 2'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].videoStreams).toEqual([0]);
    expect(currentSessions[2].audioStreams).toBeUndefined();
  });

  it('should end the session created with the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 2, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated audioStreamId field', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', audioStreamId: 1 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP offer for session 2'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].audioStreams).toEqual([1]);
  });

  it('should end the session created with the deprecated audioStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 2, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should reject solicitOffer with only the deprecated audioStreamId field set to null', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreamId: null }),
    ).rejects.toThrow('solicitOffer requires at least one of videoStreams or audioStreams; automatic stream assignment is not implemented');
  });

  it('should provide an offer for an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: 0,
        sdp: 'v=0 o=- re-offer',
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP offer for session 0'));
  });

  it('should reject provideOffer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: 99, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'WebRTC session 99 is not present in currentSessions',
    );
  });

  it('should provide an answer for an existing session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 0, sdp: 'v=0 o=- answer' })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received an SDP answer for session 0'));
  });

  it('should reject provideAnswer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 99, sdp: 'v=0 o=- answer' })).rejects.toThrow(
      'WebRTC session 99 is not present in currentSessions',
    );
  });

  it('should provide ICE candidates for an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 0,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Received 1 ICE candidate(s) for session 0'));
  });

  it('should reject provideIceCandidates for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', { webRtcSessionId: 99, iceCandidates: [] })).rejects.toThrow(
      'WebRTC session 99 is not present in currentSessions',
    );
  });

  it('should reject endSession for an unknown session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 99, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).rejects.toThrow('WebRTC session 99 is not present in currentSessions');
  });

  it('should end an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Ended WebRTC session 0'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(1);
  });

  it('should not solicit an offer without a bound WebRtcTransportRequestor', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('No WebRtcTransportRequestor is bound yet'));
  });

  it('should not solicit an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('No WebRtcTransportRequestor is bound yet'));
  });

  it('should not provide an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcProvideOfferNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('No WebRtcTransportRequestor is bound yet'));
  });

  it('should not touch a real peer connection for a session restored from persisted state without one', async () => {
    // currentSessions is a replicated attribute (persisted across restarts); the werift peer connection in `internal`
    // is not. Seed a session directly, bypassing solicitOffer/provideOffer, to simulate that post-restart state.
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcOrphanSession' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await endpoint.setAttribute(WebRtcTransportProvider, 'currentSessions', [
      {
        id: 0,
        peerNodeId: NodeId(0),
        peerEndpointId: EndpointNumber(1),
        streamUsage: StreamUsage.LiveView,
        metadataEnabled: false,
        videoStreams: [0],
        audioStreams: undefined,
        fabricIndex: FabricIndex(1),
      },
    ]);

    await expect(endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 0, sdp: 'v=0 o=- answer' })).resolves.toBeUndefined();
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 0,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      }),
    ).resolves.toBeUndefined();
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();
  });

  it('should add addWebRtcTransportRequestorClient to an endpoint that already has it registered', () => {
    // The Camera constructor already calls addWebRtcTransportRequestorClient once; calling it again should return the
    // same endpoint without duplicating the clientList entry or the clientClusters mapping.
    expect(addWebRtcTransportRequestorClient(device)).toBe(device);
  });

  it('should add WebRtcTransportRequestor to an existing MatterbridgeBindingServer clientList', () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcRequestorClientMerge' });
    endpoint.behaviors.require(MatterbridgeBindingServer, { clientList: [Identify.id] });

    expect(addWebRtcTransportRequestorClient(endpoint)).toBe(endpoint);

    const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([Identify.id, WebRtcTransportRequestor.id]);
  });

  it('should add WebRtcTransportRequestor when an existing MatterbridgeBindingServer has no clientList option', () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcRequestorClientNoOptions' });
    endpoint.behaviors.require(MatterbridgeBindingServer);

    expect(addWebRtcTransportRequestorClient(endpoint)).toBe(endpoint);

    const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportRequestor.id]);
  });
});

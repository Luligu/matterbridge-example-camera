/**
 * @file vitest/behaviors/webRtcTransportProviderServer.test.ts
 * @description This file contains the tests for the MatterbridgeWebRtcTransportProviderServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'WebRtcTransportProviderServerBehavior';
const MATTER_PORT = 6005;
const MATTER_CREATE_ONLY = true;

import { camera, internalFor, MatterbridgeEndpoint } from 'matterbridge';
import { Node } from 'matterbridge/matter';
import { CameraAvStreamManagement, WebRtcTransportDefinitions, WebRtcTransportProvider } from 'matterbridge/matter/clusters';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage, ThreeLevelAuto } from 'matterbridge/matter/types';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from 'matterbridge/vitest-utils';
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

import { MatterbridgeCameraAvStreamManagementServer } from '../../src/behaviors/cameraAvStreamManagementServer.js';
import {
  allocateWebRtcSessionId,
  createDefaultWebRtcTransportProviderClusterServer,
  MatterbridgeWebRtcTransportProviderServer,
} from '../../src/behaviors/webRtcTransportProviderServer.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('MatterbridgeWebRtcTransportProviderServer', () => {
  const originalVideoSource = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;

  let device: Camera;

  function clearExpectedWarnings(...expectedMessages: string[]): void {
    const unexpectedWarnings = loggerWarnSpy.mock.calls.filter(([message]) => !expectedMessages.some((expectedMessage) => message.includes(expectedMessage)));
    expect(unexpectedWarnings).toEqual([]);
    loggerWarnSpy.mockClear();
  }

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
    process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'none';
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
    process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = originalVideoSource;
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

  it('should solicit an offer with automatically assigned video and audio streams when none are provided', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 0'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toEqual([0]);
    expect(currentSessions[0].audioStreams).toEqual([0]);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // Restores currentSessions to empty without resetting the monotonically increasing session id allocator.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should solicit an offer and record a deferred session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(1);
    expect(currentSessions[0].streamUsage).toBe(StreamUsage.LiveView);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
  });

  it('should solicit a second offer with an incremented session id', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.Recording,
        originatingEndpointId: EndpointNumber(1),
        audioStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 2'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(2);
  });

  it('should end the second solicited session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 2, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(1);
  });

  it('should provide an offer for a new session with automatically assigned video and audio streams', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 3'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].videoStreams).toEqual([0]);
    expect(currentSessions[1].audioStreams).toEqual([0]);

    // Restores currentSessions to the session created by the main flow.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 3, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
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

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 4'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(4);
  });

  it('should provide an offer for a new session with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 5'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].streamUsage).toBe(StreamUsage.LiveView);
  });

  it('should end the session created with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 5, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreamId: 0, audioStreamId: null }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 6'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].videoStreams).toEqual([0]);
    expect(currentSessions[2].audioStreams).toBeUndefined();
  });

  it('should end the session created with the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 6, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated audioStreamId field', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', audioStreamId: 1 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 7'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].audioStreams).toEqual([1]);
  });

  it('should end the session created with the deprecated audioStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 7, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should echo a null deprecated videoStreamId when no video stream was resolved for the request', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreamId: null, audioStreamId: 5 }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const session = currentSessions[currentSessions.length - 1];
    expect(session.videoStreams).toBeUndefined();
    expect(session.audioStreams).toEqual([5]);

    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: session.id, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should solicit an offer with only the deprecated audioStreamId field set to null, automatically assigning streams', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreamId: null }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const session = currentSessions[currentSessions.length - 1];
    expect(session.videoStreams).toEqual([0]);
    expect(session.audioStreams).toEqual([0]);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // Restores currentSessions to its pre-test state without resetting the session id allocator.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: session.id, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should provide an offer for an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: 1,
        sdp: 'v=0 o=- re-offer',
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 1'));
    clearExpectedWarnings();
  });

  it('should log a non-Error rejection reason when the peer WebRtcTransportRequestor endpoint cannot be resolved', async () => {
    vi.spyOn(Node, 'forEndpoint').mockImplementationOnce(() => {
      // oxlint-disable-next-line typescript/only-throw-error -- intentionally exercises the non-Error branch of the catch's error formatting.
      throw 'boom';
    });

    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: 1,
        sdp: 'v=0 o=- re-offer',
      }),
    ).resolves.toBeUndefined();

    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Could not resolve peer WebRtcTransportRequestor endpoint.*boom/));
    clearExpectedWarnings();
  });

  it('should reject provideOffer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: 99, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'WebRTC session 99 is not present in currentSessions',
    );
  });

  it('should provide an answer for an existing session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 1, sdp: 'v=0 o=- answer' })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideAnswer: received an SDP answer for session 1'));
  });

  it('should reject provideAnswer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 99, sdp: 'v=0 o=- answer' })).rejects.toThrow(
      'MatterbridgeWebRtcTransportProviderServer.provideAnswer: webRTC session 99 is not present in currentSessions',
    );
  });

  it('should provide ICE candidates for an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: received 1 ICE candidate(s) for session 1'),
    );
  });

  it('should apply mDNS host ICE candidates by delegating mDNS resolution to werift-ice', async () => {
    const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
    const webRtcPeer = internal?.sessions.get(1);
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
    const addIceCandidateSpy = vi.spyOn(webRtcPeer!, 'addIceCandidate').mockResolvedValueOnce();

    const candidate = 'candidate:1 1 UDP 1 8f4f3af1-a0a0-4f2c-9276-c6b423a3d2fd.local 54321 typ host';
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate, sdpMid: null, sdpmLineIndex: null }],
      }),
    ).resolves.toBeUndefined();

    expect(addIceCandidateSpy).toHaveBeenCalledWith(candidate, null, null);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applying ICE candidate 1/1'));
  });

  it('should log a warning when applying an ICE candidate fails', async () => {
    const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
    const webRtcPeer = internal?.sessions.get(1);
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
    vi.spyOn(webRtcPeer!, 'addIceCandidate').mockRejectedValueOnce(new Error('addIceCandidate failed'));

    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: null }],
      }),
    ).resolves.toBeUndefined();

    // The command response no longer waits on candidate application (see provideIceCandidates's doc comment), so
    // the warning is logged in the background and must be awaited rather than asserted immediately.
    await vi.waitFor(() => expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate')));
    loggerWarnSpy.mockClear();
  });

  it('should log a warning when applying an ICE candidate times out', async () => {
    vi.useFakeTimers();
    try {
      const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
      const webRtcPeer = internal?.sessions.get(1);
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
      vi.spyOn(webRtcPeer!, 'addIceCandidate').mockImplementationOnce(async () => new Promise(() => {}));

      const invocation = device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      });
      await vi.advanceTimersByTimeAsync(5000);

      await expect(invocation).resolves.toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('ICE candidate apply timeout after 5000ms'));
      loggerWarnSpy.mockClear();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should apply ICE candidates concurrently so one candidate timing out does not delay a sibling candidate', async () => {
    vi.useFakeTimers();
    try {
      const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
      const webRtcPeer = internal?.sessions.get(1);
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
      const peer = webRtcPeer!;
      const addIceCandidateSpy = vi
        .spyOn(peer, 'addIceCandidate')
        .mockImplementationOnce(async () => new Promise(() => {}))
        .mockResolvedValueOnce();

      const invocation = device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [
          { candidate: 'candidate:1 1 UDP 1 stuck-interface.local 1 typ host', sdpMid: null, sdpmLineIndex: 0 },
          { candidate: 'candidate:2 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 1 },
        ],
      });

      // Let both candidates start applying before the first one's timeout fires, proving they run concurrently
      // rather than the second one waiting for the first's 5s timeout to elapse first.
      await vi.advanceTimersByTimeAsync(0);
      expect(addIceCandidateSpy).toHaveBeenCalledTimes(2);
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applied ICE candidate 2/2'));

      await vi.advanceTimersByTimeAsync(5000);
      await expect(invocation).resolves.toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate 1/2'));
      loggerWarnSpy.mockClear();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reject provideIceCandidates for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', { webRtcSessionId: 99, iceCandidates: [] })).rejects.toThrow(
      'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: webRTC session 99 is not present in currentSessions',
    );
  });

  it('should reject endSession for an unknown session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 99, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).rejects.toThrow('MatterbridgeWebRtcTransportProviderServer.endSession: webRTC session 99 is not present in currentSessions');
  });

  it('should end an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 1, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.endSession: ended webRTC session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(4);
  });

  it('should allocate, wrap, skip active, and exhaust WebRTC session ids', () => {
    expect(allocateWebRtcSessionId(0, new Set())).toEqual({ webRtcSessionId: 0, nextCandidate: 1 });
    expect(allocateWebRtcSessionId(65534, new Set())).toEqual({ webRtcSessionId: 65534, nextCandidate: 0 });
    expect(allocateWebRtcSessionId(0, new Set([0]))).toEqual({ webRtcSessionId: 1, nextCandidate: 2 });

    const allSessionIds = new Set<number>();
    for (let id = 0; id <= 65534; id++) allSessionIds.add(id);
    expect(() => allocateWebRtcSessionId(0, allSessionIds)).toThrow('No WebRTC session identifier is available');
  });

  it('should use the allocated video stream resolution for the injected webcam capture, matching a real client resolution/quality picker', async () => {
    const originalVideoSource = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    const originalWebcamDevice = process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
    process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = 'webcam';
    process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = 'test-webcam-device';

    try {
      await device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1280, height: 720 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const allocatedVideoStreams = device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];
      const { videoStreamId } = allocatedVideoStreams[allocatedVideoStreams.length - 1];

      await expect(
        device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreams: [videoStreamId],
        }),
      ).resolves.toBeUndefined();

      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('local webcam (test-webcam-device, 1280x720)'));
      clearExpectedWarnings('No injectable video codec available on negotiated transceivers', 'Cannot inject video stream: missing dependency ffmpeg');

      const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
      await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
      await device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId });
    } finally {
      process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = originalVideoSource;
      process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = originalWebcamDevice;
    }
  });

  it('should resolve no webcam resolution when the requested video stream id has no matching allocated stream', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [999] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not solicit an offer without a bound WebRtcTransportRequestor', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not solicit an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    await endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not provide an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcProvideOfferNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.provideOffer: could not reach the peer's WebRtcTransportRequestor"),
    );

    // provideOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    await endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should reject solicitOffer without videoStreams or audioStreams when the endpoint has no CameraAvStreamManagement cluster', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoCameraAvStreamManagement' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).rejects.toThrow('solicitOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically');
  });

  it('should reject provideOffer without videoStreams or audioStreams when the endpoint has no CameraAvStreamManagement cluster', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcProvideOfferNoCameraAvStreamManagement' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'provideOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
    );
  });

  it('should auto-assign only an audio stream when the camera has no assignable video capability', async () => {
    const endpoint = new Camera('WebRtc No Video Capability', 'WEBRTC-NO-VIDEO-CAPABILITY', { rateDistortionTradeOffPoints: [] });
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toBeUndefined();
    expect(currentSessions[0].audioStreams).toEqual([0]);
  });

  it('should reject solicitOffer without videoStreams or audioStreams when the camera has no assignable video or audio capability', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoAssignableCapability' });
    endpoint.behaviors.require(
      MatterbridgeCameraAvStreamManagementServer.with(
        CameraAvStreamManagement.Feature.Video,
        CameraAvStreamManagement.Feature.Snapshot,
        CameraAvStreamManagement.Feature.ImageControl,
      ),
      {
        maxContentBufferSize: 4_194_304,
        maxNetworkBandwidth: 10_000_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 1920 * 1080 * 30,
        videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        minViewportResolution: { width: 640, height: 360 },
        rateDistortionTradeOffPoints: [],
        currentFrameRate: 30,
        viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
        snapshotCapabilities: [],
        allocatedSnapshotStreams: [],
        allocatedVideoStreams: [],
        hardPrivacyModeOn: false,
        statusLightEnabled: false,
        statusLightBrightness: ThreeLevelAuto.Auto,
        imageRotation: 0,
        imageFlipVertical: false,
        imageFlipHorizontal: false,
      },
    );
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).rejects.toThrow('solicitOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically');
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
});

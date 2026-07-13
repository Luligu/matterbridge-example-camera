/**
 * @file vitest/behaviors/videoCameraAvStreamManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeVideoCameraAvStreamManagementServer behavior.
 * @author Ludovic BOUÉ
 */

const NAME = 'VideoCameraAvStreamManagementServerBehavior';
const MATTER_PORT = 6004;
const MATTER_CREATE_ONLY = true;

import { CameraAvStreamManagement } from 'matterbridge/matter/clusters';
import { StreamUsage } from 'matterbridge/matter/types';
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

import { MatterbridgeVideoCameraAvStreamManagementServer } from '../../src/behaviors/videoCameraAvStreamManagementServer.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('MatterbridgeVideoCameraAvStreamManagementServer', () => {
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

  it('should create and register a camera device using the MatterbridgeVideoCameraAvStreamManagementServer behavior', async () => {
    device = new Camera('Camera Behavior', 'CAMERA-BEHAVIOR', {
      supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
    });
    expect(device.behaviors.has(MatterbridgeVideoCameraAvStreamManagementServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should reject setStreamPriorities with a duplicate stream usage', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', { streamPriorities: [StreamUsage.LiveView, StreamUsage.LiveView] })).rejects.toThrow(
      'streamPriorities shall not contain duplicate values',
    );
  });

  it('should reject setStreamPriorities with an unsupported stream usage', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', { streamPriorities: [StreamUsage.Analysis] })).rejects.toThrow(
      'streamPriorities shall only contain entries found in supportedStreamUsages',
    );
  });

  it('should set the stream priorities', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', { streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Setting stream priorities to [1, 3]'));
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.Recording, StreamUsage.LiveView]);
  });

  it('should reject videoStreamAllocate with an unsupported stream usage', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Analysis,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      }),
    ).rejects.toThrow('Stream usage 2 is not present in supportedStreamUsages');
  });

  it('should allocate a video stream', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Allocated video stream 0 for usage 3'));
    const allocatedVideoStreams = device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];
    expect(allocatedVideoStreams).toHaveLength(1);
    expect(allocatedVideoStreams[0].videoStreamId).toBe(0);
  });

  it('should allocate a second video stream with an incremented identifier', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      }),
    ).resolves.toBeUndefined();

    const allocatedVideoStreams = device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];
    expect(allocatedVideoStreams).toHaveLength(2);
    expect(allocatedVideoStreams[1].videoStreamId).toBe(1);
  });

  it('should reject setStreamPriorities while video streams are allocated', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', { streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording] }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while video streams are allocated');
  });

  it('should reject videoStreamDeallocate for an unknown video stream identifier', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 99 })).rejects.toThrow(
      'Video stream 99 is not present in allocatedVideoStreams',
    );
  });

  it('should deallocate a video stream', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Deallocated video stream 0'));
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toHaveLength(1);
  });
});

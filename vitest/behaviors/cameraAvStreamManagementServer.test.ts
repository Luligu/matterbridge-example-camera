/**
 * @file vitest/behaviors/cameraAvStreamManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeCameraAvStreamManagementServer behavior.
 * @author Luca Liguori
 */

const NAME = 'CameraAvStreamManagementServerBehavior';
const MATTER_PORT = 6003;
const MATTER_CREATE_ONLY = true;

import { CameraAvStreamManagement } from 'matterbridge/matter/clusters';
import { StreamUsage } from 'matterbridge/matter/types';
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
import { SnapshotCamera } from '../../src/devices/snapshotCamera.js';

await setupTest(NAME);

describe('MatterbridgeCameraAvStreamManagementServer', () => {
  let device: SnapshotCamera;

  beforeAll(async () => {
    await createTestEnvironment();
    await createServerNode(MATTER_PORT);
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    await destroyTestEnvironment();
    vi.restoreAllMocks();
  });

  it('should create and register a snapshot camera using the Camera AV Stream Management behavior', async () => {
    device = new SnapshotCamera('Snapshot Camera Behavior', 'CAMERA-BEHAVIOR', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
      allocatedSnapshotStreams: [
        {
          snapshotStreamId: 2,
          imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
          frameRate: 5,
          minResolution: { width: 320, height: 240 },
          maxResolution: { width: 640, height: 480 },
          quality: 75,
          referenceCount: 0,
          encodedPixels: false,
          hardwareEncoder: false,
        },
      ],
    });
    expect(device.behaviors.has(MatterbridgeCameraAvStreamManagementServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should replace stream usage priorities', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Setting stream priorities to 3, 1'));
  });

  it('should allocate a snapshot stream with the next available identifier', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', {
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        maxFrameRate: 10,
        minResolution: { width: 320, height: 240 },
        maxResolution: { width: 1280, height: 720 },
        quality: 90,
      }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toContainEqual({
      snapshotStreamId: 3,
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      frameRate: 10,
      minResolution: { width: 320, height: 240 },
      maxResolution: { width: 1280, height: 720 },
      quality: 90,
      referenceCount: 0,
      encodedPixels: false,
      hardwareEncoder: false,
    });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Allocated snapshot stream 3'));
  });

  it('should deallocate an existing snapshot stream', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 3 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).not.toContainEqual(expect.objectContaining({ snapshotStreamId: 3 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Deallocated snapshot stream 3'));
  });

  it('should reject deallocation when the snapshot stream does not exist', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 99 })).rejects.toThrow(
      'Snapshot stream 99 is not present in allocatedSnapshotStreams',
    );
  });

  it('should capture a snapshot using the requested stream and resolution', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: 2,
        requestedResolution: { width: 640, height: 480 },
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Capturing snapshot 2'));
    expect(loggerDebugSpy).toHaveBeenCalledWith('MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId 2');
  });

  it('should capture a snapshot using automatic stream selection', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: null,
        requestedResolution: { width: 1280, height: 720 },
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Capturing snapshot auto'));
  });
});

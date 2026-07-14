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
import { Camera } from '../../src/devices/camera.js';
import { SnapshotCamera } from '../../src/devices/snapshotCamera.js';

await setupTest(NAME);

describe('MatterbridgeCameraAvStreamManagementServer', () => {
  let device: SnapshotCamera;
  let priorityDevice: SnapshotCamera;
  let camera: Camera;

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
    expect(
      device.behaviors.has(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot, CameraAvStreamManagement.Feature.ImageControl)),
    ).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should reject setting stream priorities while a snapshot stream is allocated', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
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

  it('should create and register a snapshot camera with no allocated streams for setStreamPriorities validation', async () => {
    priorityDevice = new SnapshotCamera('Snapshot Camera Priorities', 'CAMERA-PRIORITIES', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
    });
    expect(await addDevice(aggregator, priorityDevice)).toBeTruthy();
  });

  it('should reject setting stream priorities with an unsupported stream usage', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Analysis],
      }),
    ).rejects.toThrow('streamPriorities shall only contain entries found in supportedStreamUsages');
  });

  it('should reject setting stream priorities with duplicate values', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.Recording],
      }),
    ).rejects.toThrow('streamPriorities shall not contain duplicate values');
  });

  it('should replace stream usage priorities', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      }),
    ).resolves.toBeUndefined();

    expect(priorityDevice.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Setting stream priorities to [3, 1]'));
  });

  it('should create and register a camera using the Camera AV Stream Management behavior', async () => {
    camera = new Camera('Camera Behavior', 'CAMERA-AV-BEHAVIOR');
    expect(await addDevice(aggregator, camera)).toBeTruthy();
  });

  it('should reject allocating a video stream with an unsupported stream usage', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Analysis,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('Stream usage 2 is not present in supportedStreamUsages');
  });

  it('should allocate a video stream with the next available identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toContainEqual(
      expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Allocated video stream 0 for usage 3'));
  });

  it('should allocate a second video stream with an incremented identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toContainEqual(
      expect.objectContaining({ videoStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }),
    );
  });

  it('should reject deallocating a video stream that does not exist', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 99 })).rejects.toThrow(
      'Video stream 99 is not present in allocatedVideoStreams',
    );
  });

  it('should deallocate an existing video stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 1 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).not.toContainEqual(expect.objectContaining({ videoStreamId: 1 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Deallocated video stream 1'));
  });

  it('should reject allocating an audio stream with an unsupported stream usage', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.Analysis,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).rejects.toThrow('Stream usage 2 is not present in supportedStreamUsages');
  });

  it('should allocate an audio stream with the next available identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toContainEqual(
      expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Allocated audio stream 0 for usage 3'));
  });

  it('should allocate a second audio stream with an incremented identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toContainEqual(
      expect.objectContaining({ audioStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }),
    );
  });

  it('should deallocate the second audio stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 1 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).not.toContainEqual(expect.objectContaining({ audioStreamId: 1 }));
  });

  it('should reject deallocating an audio stream that does not exist', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 99 })).rejects.toThrow(
      'Audio stream 99 is not present in allocatedAudioStreams',
    );
  });

  it('should deallocate an existing audio stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).not.toContainEqual(expect.objectContaining({ audioStreamId: 0 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Deallocated audio stream 0'));
  });

  it('should reject setting stream priorities while a video stream is allocated', async () => {
    const videoOnlyCamera = new Camera('Camera Video Priorities', 'CAMERA-VIDEO-PRIORITIES');
    expect(await addDevice(aggregator, videoOnlyCamera)).toBeTruthy();

    await expect(
      videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    await expect(
      videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
  });

  it('should reject setting stream priorities while an audio stream is allocated', async () => {
    const audioOnlyCamera = new Camera('Camera Audio Priorities', 'CAMERA-AUDIO-PRIORITIES');
    expect(await addDevice(aggregator, audioOnlyCamera)).toBeTruthy();

    await expect(
      audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    await expect(
      audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
  });
});

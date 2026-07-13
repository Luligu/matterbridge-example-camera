/**
 * @file vitest/devices/camera.test.ts
 * @description This file contains the tests for the Camera device.
 * @author Ludovic BOUÉ
 */

const NAME = 'CameraDevice';
const MATTER_PORT = 6003;
const MATTER_CREATE_ONLY = true;

import { CameraAvStreamManagement, Identify } from 'matterbridge/matter/clusters';
import { StreamUsage } from 'matterbridge/matter/types';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from 'matterbridge/vitest-utils';
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

import { createDefaultCameraAvStreamManagementClusterServer } from '../../src/behaviors/videoCameraAvStreamManagementServer.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('Camera', () => {
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

  it('should create a camera device with default options', async () => {
    const device = new Camera('Camera Default', 'CAMERA-DEFAULT');
    expect(device.id).toBe('CameraDefault-CAMERA-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'videoSensorParams')).toEqual({ sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 });
    expect(device.getAttribute(CameraAvStreamManagement, 'viewport')).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([]);
  });

  it('should create a camera device with identify enabled', async () => {
    const device = new Camera('Camera Identify', 'CAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should create a camera device with custom stream usages', async () => {
    const device = new Camera('Camera Custom', 'CAMERA-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView],
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
  });

  it('should add createDefaultCameraAvStreamManagementClusterServer to an endpoint', () => {
    const device = new Camera('Camera Helper', 'CAMERA-HELPER');
    // The constructor already creates the CameraAvStreamManagement cluster server; calling the helper again should return the same endpoint.
    expect(
      createDefaultCameraAvStreamManagementClusterServer(device, {
        maxContentBufferSize: 4_194_304,
        maxNetworkBandwidth: 10_000_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 1920 * 1080 * 30,
        videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        minViewportResolution: { width: 640, height: 360 },
        rateDistortionTradeOffPoints: [{ codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 }],
        currentFrameRate: 30,
        viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
        imageRotation: 0,
        imageFlipHorizontal: false,
        imageFlipVertical: false,
        microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      }),
    ).toBe(device);
  });
});

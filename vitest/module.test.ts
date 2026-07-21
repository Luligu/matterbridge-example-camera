/**
 * @file vitest/module.test.ts
 * @description This file contains the tests for the ExampleMatterbridgeCameraPlatform.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'Platform';
const MATTER_PORT = 6000;
const MATTER_CREATE_ONLY = true;

import type { PlatformMatterbridge } from 'matterbridge';
import { log, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setDebug, setupTest } from 'matterbridge/vitest-utils';
import {
  addMatterbridge,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  startServerNode,
  stopServerNode,
} from 'matterbridge/vitest-utils/matter';

import initializePlugin, { type CameraPlatformConfig, ExampleMatterbridgeCameraPlatform } from '../src/module.js';

await setupTest(NAME);

describe('TestPlatform', () => {
  const originalVideoSource = process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
  const originalWebcamDevice = process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
  const originalWebcamResolution = process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION;

  let matterbridge: PlatformMatterbridge;
  let platform: ExampleMatterbridgeCameraPlatform;

  const config: CameraPlatformConfig = {
    name: 'matterbridge-example-camera',
    type: 'DynamicPlatform',
    version: '1.0.0',
    whiteList: [],
    blackList: [],
    generator: 'none',
    webcamResolution: '640x480',
    animationInterval: 0,
    debug: false,
    unregisterOnShutdown: false,
  };

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);
    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
    matterbridge = getMatterbridge();
  });

  beforeEach(() => {
    // Reset the mock calls before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
    // Clear debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
    if (originalVideoSource === undefined) delete process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE;
    else process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE = originalVideoSource;
    if (originalWebcamDevice === undefined) delete process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE;
    else process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE = originalWebcamDevice;
    if (originalWebcamResolution === undefined) delete process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION;
    else process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION = originalWebcamResolution;
  });

  it('should throw error in load when version is not valid', () => {
    expect(() => initializePlugin({ ...matterbridge, matterbridgeVersion: '1.0.0' }, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.10.0". Please update Matterbridge to the latest version in the frontend.',
    );
  });

  it('should add empty selection lists when the config omits them', async () => {
    const emptyConfig = { ...config, whiteList: undefined, blackList: undefined, webcam: undefined } as unknown as CameraPlatformConfig;
    const emptyConfigPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, emptyConfig);
    addMatterbridge(emptyConfigPlatform);
    vi.spyOn(emptyConfigPlatform, 'registerDevice').mockResolvedValue();

    try {
      await emptyConfigPlatform.onStart();

      expect(emptyConfigPlatform.config.whiteList).toEqual([]);
      expect(emptyConfigPlatform.config.blackList).toEqual([]);
      expect(emptyConfigPlatform.config.generator).toBe('none');
      expect(emptyConfigPlatform.config.webcam).toBeUndefined();
      expect(emptyConfigPlatform.config.webcamResolution).toBe('640x480');
      expect(process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE).toBe('none');
      expect(process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE).toBeUndefined();
      expect(process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION).toBe('640x480');
      expect(emptyConfigPlatform.getSelectDevices()).toHaveLength(8);
    } finally {
      await emptyConfigPlatform.onShutdown();
    }
  });

  it.each(['none', 'test', 'webcam'] as const)('should apply the configured %s video generator', (generator) => {
    const generatorPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, generator });

    expect(generatorPlatform.config.generator).toBe(generator);
    expect(process.env.MATTERBRIDGE_CAMERA_VIDEO_SOURCE).toBe(generator);
  });

  it.each(['640x480', '1280x720', '1920x1080'] as const)('should apply the configured %s webcam resolution', (webcamResolution) => {
    const webcamPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, {
      ...config,
      generator: 'webcam',
      webcam: 'Integrated Camera',
      webcamResolution,
    });

    expect(webcamPlatform.config.webcam).toBe('Integrated Camera');
    expect(webcamPlatform.config.webcamResolution).toBe(webcamResolution);
    expect(process.env.MATTERBRIDGE_CAMERA_WEBCAM_DEVICE).toBe('Integrated Camera');
    expect(process.env.MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION).toBe(webcamResolution);
  });

  it('should not create devices when none match the whitelist', async () => {
    const filteredPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, whiteList: ['No devices'] });
    addMatterbridge(filteredPlatform);

    try {
      await filteredPlatform.onStart();

      expect(filteredPlatform.size()).toBe(0);
    } finally {
      await filteredPlatform.onShutdown();
    }
  });

  it('should initialize platform with config name', () => {
    platform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
    addMatterbridge(platform);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Initializing platform ${config.name}...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} initialized successfully`);
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting platform ${config.name} with reason: Test reason...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} started successfully`);
    expect(platform.getDeviceById('Chime-CHIME-001')).toBeDefined();
    expect(platform.getDeviceById('Doorbell-DOORBELL-001')).toBeDefined();
    expect(platform.getDeviceById('AudioDoorbell-AUDIODOORBELL-001')).toBeDefined();
    expect(platform.getDeviceById('SnapshotCamera-SNAPSHOTCAMERA-001')).toBeDefined();
    expect(platform.getDeviceById('Camera-CAMERA-001')).toBeDefined();
    expect(platform.getDeviceById('FloodlightCamera-FLOODLIGHTCAMERA-001')).toBeDefined();
    expect(platform.getDeviceById('ServerChime-SERVER-CHIME-001')).toBeDefined();
    expect(platform.getDeviceById('ServerDoorbell-SERVER-DOORBELL-001')).toBeDefined();
    expect(platform.size()).toBe(8);
  });

  it('should call onConfigure', async () => {
    await platform.onConfigure();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Configuring platform ${config.name}...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} configured successfully`);
  });

  it('should call onShutdown with reason', async () => {
    await platform.onShutdown('Test reason');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Shutting down platform ${config.name} with reason: Test reason...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} shut down successfully`);
    // Remove the devices for the next test
    await platform.unregisterAllDevices();
  });

  it('should restart and unregister devices if configured', async () => {
    platform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
    addMatterbridge(platform);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Initializing platform ${config.name}...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} initialized successfully`);

    await platform.onStart();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting platform ${config.name} with reason: No reason provided...`);

    const unregisterSpy = vi.spyOn(platform, 'unregisterAllDevices').mockResolvedValue();
    platform.config.unregisterOnShutdown = true;
    await platform.onShutdown();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Shutting down platform ${config.name} with reason: No reason provided...`);

    // The device re-registered above was assigned a new endpoint number, so onShutdown's checkEndpointNumbers() warns about the change
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Endpoint number for device'));
    loggerWarnSpy.mockClear();
    expect(unregisterSpy).toHaveBeenCalled();
  });

  it('should run animationHandler on the configured interval and clear it on shutdown', async () => {
    vi.useFakeTimers();
    try {
      // The previous test left unregisterAllDevices mocked as a no-op on the shared platform; restore it and
      // clean up its devices for real before registering a fresh set under this test's own config.
      vi.mocked(platform.unregisterAllDevices).mockRestore();
      await platform.unregisterAllDevices();

      const animatedConfig: CameraPlatformConfig = { ...config, animationInterval: 5 };
      platform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, animatedConfig);
      addMatterbridge(platform);
      await platform.onStart();
      await platform.onConfigure();

      // Advance past the phase wraparound (phase > 10 resets to 0) to cover both branches
      for (let i = 0; i < 12; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('animation phase: 10'));
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('animation phase: 0'));

      await platform.onShutdown();
      // The devices were re-registered above with new endpoint numbers, so onShutdown's checkEndpointNumbers() warns about the change
      loggerWarnSpy.mockClear();
      loggerInfoSpy.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('animation phase'));

      await platform.unregisterAllDevices();
    } finally {
      vi.useRealTimers();
    }
  });
});

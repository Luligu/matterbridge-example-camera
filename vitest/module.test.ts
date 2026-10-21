/**
 * @file vitest/module.test.ts
 * @description This file contains the tests for the ExampleMatterbridgeCameraPlatform.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'Platform';
const MATTER_PORT = 6000;
const MATTER_CREATE_ONLY = true;

import type { MatterbridgeEndpoint, PlatformMatterbridge } from 'matterbridge';
import { Chime as ChimeCluster } from 'matterbridge/matter/clusters';
import {
  addMatterbridge,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  log,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerInfoSpy,
  loggerWarnSpy,
  setDebug,
  setupTest,
  startServerNode,
  stopServerNode,
} from 'matterbridge/test-utils/vitest';
import { parseVersionString } from 'matterbridge/utils';

import initializePlugin, { type CameraPlatformConfig, ExampleMatterbridgeCameraPlatform } from '../src/module.js';

const behaviors = vi.hoisted(() => ({
  hasFfmpeg: vi.fn(() => true),
  installFfmpeg: vi.fn(async () => true),
}));

vi.mock('matterbridge/behaviors', async (importOriginal) => ({ ...(await importOriginal<typeof import('matterbridge/behaviors')>()), ...behaviors }));

const utils = vi.hoisted(() => ({
  isDocker: vi.fn(() => false),
}));

vi.mock('matterbridge/utils', async (importOriginal) => ({ ...(await importOriginal<typeof import('matterbridge/utils')>()), ...utils }));

await setupTest(NAME);

describe('TestPlatform', () => {
  let matterbridge: PlatformMatterbridge;
  let platform: ExampleMatterbridgeCameraPlatform;

  const config: CameraPlatformConfig = {
    name: 'matterbridge-example-camera',
    type: 'DynamicPlatform',
    version: '1.0.0',
    whiteList: [],
    blackList: [],
    autoInstallFfmpeg: true,
    videoGenerator: 'none',
    videoResolution: '640x480',
    videoBitrate: 1000,
    audioGenerator: 'none',
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
    // Bridge mode adds bridgedNode to the bridged devices, so devices of the same type under the aggregator need no tagList
    Object.assign(matterbridge, { bridgeMode: 'bridge' });
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
  });

  it('should throw error in load when version is not valid', () => {
    expect(() => initializePlugin({ ...matterbridge, matterbridgeVersion: '1.0.0' }, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.10.15". Please update Matterbridge to the latest version in the frontend.',
    );
  });

  it('should add empty selection lists when the config omits them', async () => {
    const emptyConfig = { ...config, whiteList: undefined, blackList: undefined, autoInstallFfmpeg: undefined, videoSource: undefined } as unknown as CameraPlatformConfig;
    const emptyConfigPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, emptyConfig);
    addMatterbridge(emptyConfigPlatform);
    vi.spyOn(emptyConfigPlatform, 'registerDevice').mockResolvedValue();

    try {
      await emptyConfigPlatform.onStart();

      expect(emptyConfigPlatform.config.whiteList).toEqual([]);
      expect(emptyConfigPlatform.config.blackList).toEqual([]);
      expect(emptyConfigPlatform.config.autoInstallFfmpeg).toBe(true);
      expect(emptyConfigPlatform.config.videoGenerator).toBe('none');
      expect(emptyConfigPlatform.config.videoSource).toBeUndefined();
      expect(emptyConfigPlatform.config.videoResolution).toBe('640x480');
      expect(emptyConfigPlatform.config.audioGenerator).toBe('none');
      expect(emptyConfigPlatform.weriftOfferOptions).toEqual({
        offerVideo: true,
        offerAudio: true,
        videoSource: 'none',
        videoSourceDevice: undefined,
        videoResolution: '640x480',
        videoBitrate: 1000,
        audioSource: 'none',
        audioSourceDevice: undefined,
      });
      expect(emptyConfigPlatform.getSelectDevices()).toHaveLength(13);
    } finally {
      await emptyConfigPlatform.onShutdown();
    }
  });

  it.each(['none', 'test', 'webcam', 'rtsp'] as const)('should apply the configured %s video generator', (videoGenerator) => {
    const generatorPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, videoGenerator });

    expect(generatorPlatform.config.videoGenerator).toBe(videoGenerator);
    expect(generatorPlatform.weriftOfferOptions.videoSource).toBe(videoGenerator);
  });

  it.each(['none', 'test', 'microphone', 'rtsp'] as const)('should apply the configured %s audio generator', (audioGenerator) => {
    const generatorPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, audioGenerator });

    expect(generatorPlatform.config.audioGenerator).toBe(audioGenerator);
    expect(generatorPlatform.weriftOfferOptions.audioSource).toBe(audioGenerator);
  });

  it('should apply the configured microphone audioSource', () => {
    const microphonePlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, audioGenerator: 'microphone', audioSource: 'hw:0,0' });

    expect(microphonePlatform.config.audioSource).toBe('hw:0,0');
    expect(microphonePlatform.weriftOfferOptions.audioSourceDevice).toBe('hw:0,0');
  });

  it('should default videoGenerator and audioGenerator to test when the config omits them', () => {
    const defaultGeneratorConfig = { ...config, videoGenerator: undefined, audioGenerator: undefined } as unknown as CameraPlatformConfig;
    const defaultGeneratorPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, defaultGeneratorConfig);

    expect(defaultGeneratorPlatform.config.videoGenerator).toBe('test');
    expect(defaultGeneratorPlatform.config.audioGenerator).toBe('test');
    expect(defaultGeneratorPlatform.weriftOfferOptions.videoSource).toBe('test');
    expect(defaultGeneratorPlatform.weriftOfferOptions.audioSource).toBe('test');
  });

  it('should default videoResolution to auto and pass it as unset when the config omits it', () => {
    const defaultResolutionConfig = { ...config, videoResolution: undefined } as unknown as CameraPlatformConfig;
    const defaultResolutionPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, defaultResolutionConfig);

    expect(defaultResolutionPlatform.config.videoResolution).toBe('auto');
    // auto is passed as unset, so each session follows the resolution of its allocated video stream
    expect(defaultResolutionPlatform.weriftOfferOptions.videoResolution).toBeUndefined();
  });

  it.each([
    ['auto', undefined],
    ['640x480', '640x480'],
    ['1280x720', '1280x720'],
    ['1920x1080', '1920x1080'],
  ] as const)('should apply the configured %s webcam resolution', (videoResolution, expectedResolution) => {
    const webcamPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, {
      ...config,
      videoGenerator: 'webcam',
      videoSource: 'Integrated Camera',
      videoResolution,
    });

    expect(webcamPlatform.config.videoSource).toBe('Integrated Camera');
    expect(webcamPlatform.config.videoResolution).toBe(videoResolution);
    expect(webcamPlatform.weriftOfferOptions.videoSourceDevice).toBe('Integrated Camera');
    expect(webcamPlatform.weriftOfferOptions.videoResolution).toBe(expectedResolution);
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

  it.each([
    ['none', undefined],
    ['test', 'test'],
    ['rtsp', 'rtsp'],
  ] as const)('should capture the Snapshot Camera snapshots from the %s video generator', async (videoGenerator, expectedSource) => {
    const snapshotPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, {
      ...config,
      whiteList: ['Snapshot Camera'],
      videoGenerator,
      videoSource: 'rtsp://camera/stream',
    });
    addMatterbridge(snapshotPlatform);
    // The device is not registered, so it does not collide with the Snapshot Camera registered by the other tests
    const registerSpy = vi.spyOn(snapshotPlatform, 'registerDevice').mockResolvedValue();

    try {
      await snapshotPlatform.onStart();

      const snapshotCamera = registerSpy.mock.calls.map(([device]) => device).find((device) => device.deviceName === 'Snapshot Camera');
      if (!snapshotCamera) throw new Error('Snapshot Camera not registered');
      // The initial state of the CameraAvStreamManagement cluster, read from the device that is not registered
      const avsmOptions: { snapshotSource?: string; snapshotSourceDevice?: string } | undefined = snapshotCamera.behaviors.optionsFor(
        snapshotCamera.behaviors.supported.cameraAvStreamManagement,
      );
      expect(avsmOptions?.snapshotSource).toBe(expectedSource);
      expect(avsmOptions?.snapshotSourceDevice).toBe('rtsp://camera/stream');
    } finally {
      await snapshotPlatform.onShutdown();
    }
  });

  it('should install ffmpeg on start when running in a container without the docker parameter and ffmpeg is missing', async () => {
    const containerPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config, whiteList: ['No devices'] });
    addMatterbridge(containerPlatform);
    vi.spyOn(containerPlatform, 'wssSendSnackbarMessage').mockImplementation(() => {});
    behaviors.hasFfmpeg.mockReturnValue(false);
    utils.isDocker.mockReturnValueOnce(true);

    try {
      await containerPlatform.onStart();
      expect(behaviors.installFfmpeg).toHaveBeenCalledTimes(1);
      expect(loggerInfoSpy).toHaveBeenCalledWith('ffmpeg installed successfully');

      behaviors.installFfmpeg.mockClear();
      await containerPlatform.onStart();
      expect(behaviors.installFfmpeg).not.toHaveBeenCalled();
    } finally {
      behaviors.hasFfmpeg.mockReturnValue(true);
      await containerPlatform.onShutdown();
    }
  });

  it('should install ffmpeg on start when running in docker and ffmpeg is missing', async () => {
    const dockerMatterbridge = { ...matterbridge, restartMode: 'docker' } as PlatformMatterbridge;
    const dockerPlatform = new ExampleMatterbridgeCameraPlatform(dockerMatterbridge, log, { ...config, whiteList: ['No devices'] });
    addMatterbridge(dockerPlatform);
    const snackbarSpy = vi.spyOn(dockerPlatform, 'wssSendSnackbarMessage').mockImplementation(() => {});
    behaviors.hasFfmpeg.mockReturnValue(false);

    try {
      await dockerPlatform.onStart();
      expect(behaviors.installFfmpeg).toHaveBeenCalledTimes(1);
      expect(loggerInfoSpy).toHaveBeenCalledWith('ffmpeg installed successfully');
      expect(snackbarSpy).toHaveBeenCalledWith('Installing ffmpeg...', 10, 'info');
      expect(snackbarSpy).toHaveBeenCalledWith('ffmpeg installed successfully', 10, 'success');

      snackbarSpy.mockClear();
      behaviors.installFfmpeg.mockResolvedValueOnce(false);
      await dockerPlatform.onStart();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to install ffmpeg: install it manually in the container');
      expect(snackbarSpy).toHaveBeenCalledWith('Failed to install ffmpeg: install it manually in the container', 0, 'error');
      loggerErrorSpy.mockClear();
    } finally {
      behaviors.hasFfmpeg.mockReturnValue(true);
      await dockerPlatform.onShutdown();
    }
  });

  it('should skip automatic installation outside Docker or when disabled or already installed', async () => {
    for (const [restartMode, autoInstallFfmpeg, hasFfmpeg] of [
      ['service', true, false],
      ['docker', false, false],
      ['docker', true, true],
    ] as const) {
      behaviors.hasFfmpeg.mockReturnValue(hasFfmpeg);
      const skipPlatform = new ExampleMatterbridgeCameraPlatform({ ...matterbridge, restartMode }, log, { ...config, whiteList: ['No devices'], autoInstallFfmpeg });
      addMatterbridge(skipPlatform);
      try {
        await skipPlatform.onStart();
        expect(behaviors.installFfmpeg).not.toHaveBeenCalled();
      } finally {
        await skipPlatform.onShutdown();
      }
    }
    behaviors.hasFfmpeg.mockReturnValue(true);
  });

  it('should report an existing ffmpeg installation without installing again', async () => {
    const actionPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config });
    const snackbarSpy = vi.spyOn(actionPlatform, 'wssSendSnackbarMessage').mockImplementation(() => {});
    behaviors.hasFfmpeg.mockReturnValue(true);

    await actionPlatform.onAction('installFfmpeg', 'true', 'root_installFfmpeg');

    expect(loggerInfoSpy).toHaveBeenCalledWith('Received action installFfmpeg with true for schema root_installFfmpeg');
    expect(behaviors.installFfmpeg).not.toHaveBeenCalled();
    expect(snackbarSpy).toHaveBeenCalledWith('ffmpeg is already installed', 10, 'info');
  });

  it('should install ffmpeg on demand and report success or failure', async () => {
    const actionPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config });
    const snackbarSpy = vi.spyOn(actionPlatform, 'wssSendSnackbarMessage').mockImplementation(() => {});
    behaviors.hasFfmpeg.mockReturnValue(false);
    behaviors.installFfmpeg.mockResolvedValueOnce(true);

    try {
      await actionPlatform.onAction('installFfmpeg');

      expect(behaviors.installFfmpeg).toHaveBeenCalledTimes(1);
      expect(snackbarSpy).toHaveBeenCalledWith('Installing ffmpeg...', 10, 'info');
      expect(snackbarSpy).toHaveBeenCalledWith('ffmpeg installed successfully', 10, 'success');

      behaviors.installFfmpeg.mockResolvedValueOnce(false);
      await actionPlatform.onAction('installFfmpeg');

      const message = 'Failed to install ffmpeg: requires Linux, root privileges or passwordless sudo, and apk or apt-get. See the logs for details.';
      expect(behaviors.installFfmpeg).toHaveBeenCalledTimes(2);
      expect(loggerErrorSpy).toHaveBeenCalledWith(message);
      expect(snackbarSpy).toHaveBeenCalledWith(message, 0, 'error');
      loggerErrorSpy.mockClear();
    } finally {
      behaviors.hasFfmpeg.mockReturnValue(true);
    }
  });

  it('should ignore unknown actions', async () => {
    const actionPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, { ...config });

    await actionPlatform.onAction('unknown');

    expect(loggerInfoSpy).toHaveBeenCalledWith('Received action unknown');
    expect(behaviors.installFfmpeg).not.toHaveBeenCalled();
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
    const exampleCamera = platform.getDeviceById('Camera-CAMERA-001');
    expect(exampleCamera).toBeDefined();
    expect(platform.getDeviceById('PTZCamera-PTZCAMERA-001')).toBeDefined();
    expect(platform.getDeviceById('FloodlightCamera-FLOODLIGHTCAMERA-001')).toBeDefined();
    expect(platform.getDeviceById('Intercom-INTERCOM-001')).toBeDefined();
    expect(platform.getDeviceById('VideoDoorbell-VIDEODOORBELL-001')).toBeDefined();
    const serverChime = platform.getDeviceById('ServerChime-SERVER-CHIME-001');
    expect(serverChime).toBeDefined();
    expect(platform.getDeviceById('ServerDoorbell-SERVER-DOORBELL-001')).toBeDefined();
    expect(platform.getDeviceById('ServerIntercom1-SERVER-INTERCOM1-001')).toBeDefined();
    expect(platform.getDeviceById('ServerIntercom2-SERVER-INTERCOM2-001')).toBeDefined();
    expect(platform.size()).toBe(13);

    // Bridged and server-mode devices alike should carry the plugin version as software version
    // and the Matterbridge version as hardware version, set by addDevice() before registration.
    for (const device of [exampleCamera, serverChime]) {
      expect(device?.softwareVersion).toBe(parseVersionString(platform.version));
      expect(device?.softwareVersionString).toBe(platform.version);
      expect(device?.hardwareVersion).toBe(parseVersionString(matterbridge.matterbridgeVersion));
      expect(device?.hardwareVersionString).toBe(matterbridge.matterbridgeVersion);
    }

    // Toggle the enabled attribute to trigger the subscribeAttribute listener
    await serverChime?.setAttribute(ChimeCluster, 'enabled', false, serverChime.log);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Server Chime enabled attribute changed from true to false`);
    await serverChime?.setAttribute(ChimeCluster, 'enabled', true, serverChime.log);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Server Chime enabled attribute changed from false to true`);
  });

  it('should leave softwareVersion/hardwareVersion undefined when they cannot be parsed as valid numbers', async () => {
    const invalidVersionPlatform = new ExampleMatterbridgeCameraPlatform({ ...matterbridge, matterbridgeVersion: '99999.10.0' }, log, config);
    addMatterbridge(invalidVersionPlatform);
    invalidVersionPlatform.version = '';
    const registeredDevices: MatterbridgeEndpoint[] = [];
    vi.spyOn(invalidVersionPlatform, 'registerDevice').mockImplementation(async (device) => {
      registeredDevices.push(device);
    });

    try {
      await invalidVersionPlatform.onStart();

      const exampleCamera = registeredDevices.find((device) => device.deviceName === 'Camera');
      expect(exampleCamera).toBeDefined();
      // this.version is '': parseVersionString() rejects it, so softwareVersion is dropped.
      expect(exampleCamera?.softwareVersion).toBeUndefined();
      expect(exampleCamera?.softwareVersionString).toBe('Unknown');
      // matterbridgeVersion's major component (99999) exceeds parseVersionString()'s 99 cap, so hardwareVersion is dropped.
      expect(exampleCamera?.hardwareVersion).toBeUndefined();
      expect(exampleCamera?.hardwareVersionString).toBe('99999.10.0');
    } finally {
      await invalidVersionPlatform.onShutdown();
    }
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
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting platform ${config.name} with reason: no reason provided...`);

    const unregisterSpy = vi.spyOn(platform, 'unregisterAllDevices').mockResolvedValue();
    platform.config.unregisterOnShutdown = true;
    await platform.onShutdown();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Shutting down platform ${config.name} with reason: no reason provided...`);

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

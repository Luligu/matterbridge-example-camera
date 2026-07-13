/**
 * @file vitest/module.test.ts
 * @description This file contains the tests for the ExampleMatterbridgeCameraPlatform.
 * @author Luca Liguori
 */

const NAME = 'Platform';
const MATTER_PORT = 6000;
const MATTER_CREATE_ONLY = true;

import type { PlatformConfig, PlatformMatterbridge } from 'matterbridge';
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

import { Chime } from '../src/devices/chime.js';
import initializePlugin, { ExampleMatterbridgeCameraPlatform } from '../src/module.js';

await setupTest(NAME);

describe('TestPlatform', () => {
  let matterbridge: PlatformMatterbridge;
  let platform: ExampleMatterbridgeCameraPlatform;

  const config: PlatformConfig = {
    name: 'matterbridge-example-camera',
    type: 'DynamicPlatform',
    version: '1.0.0',
    debug: false,
    unregisterOnShutdown: false,
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createTestEnvironment();
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
    // Destroy Matterbridge environment
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should throw error in load when version is not valid', () => {
    expect(() => initializePlugin({ ...matterbridge, matterbridgeVersion: '1.0.0' }, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.9.0". Please update Matterbridge to the latest version in the frontend.',
    );
  });

  it('should initialize platform with config name', () => {
    platform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
    addMatterbridge(platform);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Initializing platform ${config.name}...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} initialized successfully`);
  });

  it('should throw error in onConfigure when the chime device is not registered', async () => {
    const unconfiguredPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
    addMatterbridge(unconfiguredPlatform);

    await expect(unconfiguredPlatform.onConfigure()).rejects.toThrow('Chime device not found. Please ensure the device is registered before configuration.');
  });

  it('should throw error in onConfigure when the snapshot camera device is not registered', async () => {
    const unconfiguredPlatform = new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
    const chime = new Chime('Chime', 'CHIME-001');
    vi.spyOn(chime, 'setCluster').mockResolvedValue(true);
    vi.spyOn(chime, 'setAttribute').mockResolvedValue(true);
    vi.spyOn(unconfiguredPlatform, 'getDeviceById').mockImplementation((id) => (id === 'Chime-CHIME-001' ? chime : undefined));
    addMatterbridge(unconfiguredPlatform);

    await expect(unconfiguredPlatform.onConfigure()).rejects.toThrow('Snapshot camera device not found. Please ensure the device is registered before configuration.');
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting platform ${config.name} with reason: Test reason...`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Platform ${config.name} started successfully`);
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
  });

  it('should restart and unregister devices if configured', async () => {
    // Remove the device left behind by the previous onShutdown (unregisterOnShutdown was false) before restarting
    await platform.unregisterAllDevices();
    loggerWarnSpy.mockClear();

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
});

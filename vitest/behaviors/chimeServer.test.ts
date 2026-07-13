/**
 * @file vitest/behaviors/chimeServer.test.ts
 * @description This file contains the tests for the MatterbridgeChimeServer behavior.
 * @author Luca Liguori
 */

const NAME = 'ChimeServerBehavior';
const MATTER_PORT = 6002;
const MATTER_CREATE_ONLY = true;

import { Chime as ChimeCluster } from 'matterbridge/matter/clusters';
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

import { MatterbridgeChimeServer } from '../../src/behaviors/chimeServer.js';
import { Chime } from '../../src/devices/chime.js';

await setupTest(NAME);

describe('MatterbridgeChimeServer', () => {
  let device: Chime;

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

  it('should create and register a chime device using the MatterbridgeChimeServer behavior', async () => {
    device = new Chime('Chime Behavior', 'CHIME-BEHAVIOR', {
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
      ],
      selectedChime: 0,
      enabled: true,
    });
    expect(device.behaviors.has(MatterbridgeChimeServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should play the selected chime sound when no chimeId is provided', async () => {
    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', {})).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Playing chime sound 0'));
    expect(loggerDebugSpy).toHaveBeenCalledWith('MatterbridgeChimeServer: playChimeSound called with chimeId 0');
  });

  it('should play the requested chime sound when a chimeId is provided', async () => {
    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', { chimeId: 1 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Playing chime sound 1'));
    expect(loggerDebugSpy).toHaveBeenCalledWith('MatterbridgeChimeServer: playChimeSound called with chimeId 1');
  });
});

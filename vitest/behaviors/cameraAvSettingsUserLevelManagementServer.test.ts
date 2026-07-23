/**
 * @file vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeCameraAvSettingsUserLevelManagementServer behavior.
 * @author Ludovic BOUÉ
 */

const NAME = 'CameraAvSettingsUserLevelManagementServerBehavior';
const MATTER_PORT = 6011;
const MATTER_CREATE_ONLY = true;

import { CameraAvSettingsUserLevelManagement } from 'matterbridge/matter/clusters';
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

import { MatterbridgeCameraAvSettingsUserLevelManagementServer } from '../../src/behaviors/cameraAvSettingsUserLevelManagementServer.js';
import { PtzCamera } from '../../src/devices/ptzCamera.js';

await setupTest(NAME);

describe('MatterbridgeCameraAvSettingsUserLevelManagementServer', () => {
  let device: PtzCamera;

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

  it('should create and register a PTZ camera using the Camera AV Settings User Level Management behavior', async () => {
    device = new PtzCamera('Ptz Camera Behavior', 'PTZ-CAMERA-BEHAVIOR');
    expect(
      device.behaviors.has(
        MatterbridgeCameraAvSettingsUserLevelManagementServer.with(
          CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
          CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
          CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
        ),
      ),
    ).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'movementState')).toBe(CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle);
  });

  it('should reject setting an absolute pan position outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: 200 })).rejects.toThrow(
      'Pan 200 is outside of the supported range [-170, 170]',
    );
  });

  it('should reject setting an absolute tilt position outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { tilt: 100 })).rejects.toThrow(
      'Tilt 100 is outside of the supported range [-20, 90]',
    );
  });

  it('should reject setting an absolute zoom position outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { zoom: 11 })).rejects.toThrow(
      'Zoom 11 is outside of the supported range [1, 10]',
    );
  });

  it('should set an absolute pan, tilt and zoom position', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: 45, tilt: 10, zoom: 5 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 45, tilt: 10, zoom: 5 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Set mechanical PTZ position to pan 45°, tilt 10°, zoom 5'));
  });

  it('should leave fields not present in the request unchanged', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { zoom: 2 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 45, tilt: 10, zoom: 2 });
  });

  it('should move by a relative pan, tilt and zoom delta', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { panDelta: -5, tiltDelta: 5, zoomDelta: 100 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 40, tilt: 15, zoom: 4 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Moved mechanical PTZ position by pan -5°, tilt 5°, zoom 100% to pan 40°, tilt 15°, zoom 4'));
  });

  it('should clamp a relative move at the pan, tilt and zoom limits', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { panDelta: 1000, tiltDelta: 1000, zoomDelta: -1000 }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 170, tilt: 90, zoom: 1 });
  });

  it('should ignore fields not present in a relative move request', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', {})).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 170, tilt: 90, zoom: 1 });
  });
});

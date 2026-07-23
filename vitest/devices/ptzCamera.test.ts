/**
 * @file vitest/devices/ptzCamera.test.ts
 * @description This file contains the tests for the PtzCamera device.
 * @author Ludovic BOUÉ
 */

const NAME = 'PtzCameraDevice';
const MATTER_PORT = 6012;
const MATTER_CREATE_ONLY = true;

import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { CameraAvSettingsUserLevelManagement, CameraAvStreamManagement, Identify, PowerSource, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
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

import { createDefaultCameraAvSettingsUserLevelManagementClusterServer, PtzCamera } from '../../src/devices/ptzCamera.js';

await setupTest(NAME);

describe('PtzCamera', () => {
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

  it('should create a PTZ camera device with default options', async () => {
    const device = new PtzCamera('Ptz Camera Default', 'PTZCAMERA-DEFAULT');
    expect(device.id).toBe('PtzCameraDefault-PTZCAMERA-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvSettingsUserLevelManagement.id)).toBeTruthy();

    // The required WebRtcTransportRequestor client cluster is added automatically and should not trigger a "no
    // client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportRequestor.id]);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMin')).toBe(-170);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMax')).toBe(170);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMin')).toBe(-20);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMax')).toBe(90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'zoomMax')).toBe(10);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'movementState')).toBe(CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle);
  });

  it('should create a PTZ camera device with identify enabled', async () => {
    const device = new PtzCamera('Ptz Camera Identify', 'PTZCAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a PTZ camera device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new PtzCamera(`Ptz Camera ${powerSourceType}`, `PTZCAMERA-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a PTZ camera device with no power source', async () => {
    const device = new PtzCamera('Ptz Camera None', 'PTZCAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create a PTZ camera device with custom pan, tilt and zoom ranges', async () => {
    const device = new PtzCamera('Ptz Camera Custom', 'PTZCAMERA-CUSTOM', {
      panMin: -90,
      panMax: 90,
      tiltMin: -10,
      tiltMax: 45,
      zoomMax: 4,
      mptzPosition: { pan: 10, tilt: 5, zoom: 2 },
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMin')).toBe(-90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMax')).toBe(90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMin')).toBe(-10);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMax')).toBe(45);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'zoomMax')).toBe(4);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 10, tilt: 5, zoom: 2 });
  });

  it('should add createDefaultCameraAvSettingsUserLevelManagementClusterServer to an endpoint', () => {
    const device = new PtzCamera('Ptz Camera Helper', 'PTZCAMERA-HELPER');
    // The constructor already creates the CameraAvSettingsUserLevelManagement cluster server; calling the helper again should return the same endpoint.
    expect(
      createDefaultCameraAvSettingsUserLevelManagementClusterServer(device, {
        panMin: -170,
        panMax: 170,
        tiltMin: -20,
        tiltMax: 90,
        zoomMax: 10,
        mptzPosition: { pan: 0, tilt: 0, zoom: 1 },
      }),
    ).toBe(device);
  });
});

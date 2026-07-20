/**
 * @file vitest/devices/intercom.test.ts
 * @description This file contains the tests for the Intercom device.
 * @author Ludovic BOUÉ
 */

const NAME = 'IntercomDevice';
const MATTER_PORT = 6010;
const MATTER_CREATE_ONLY = true;

import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { ChimeClient, WebRtcTransportProviderClient, WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { CameraAvStreamManagement, Chime, Identify, PowerSource, WebRtcTransportProvider, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
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

import { Intercom } from '../../src/devices/intercom.js';

await setupTest(NAME);

describe('Intercom', () => {
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

  it('should create an intercom device with default options', async () => {
    const device = new Intercom('Intercom Default', 'INTERCOM-DEFAULT');
    expect(device.id).toBe('IntercomDefault-INTERCOM-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();
    expect(device.hasClusterServer(WebRtcTransportProvider.id)).toBeTruthy();
    expect(device.hasClusterServer(WebRtcTransportRequestor.id)).toBeTruthy();

    // The required WebRtcTransportProvider/WebRtcTransportRequestor and optional Chime client clusters are added
    // automatically and should not trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportProvider.id, WebRtcTransportRequestor.id, Chime.id]);
    expect(device.type.clientClusters['webRtcTransportProvider']).toBe(WebRtcTransportProviderClient);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(65_536);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(128_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([]);
    expect(device.getAttribute(CameraAvStreamManagement, 'microphoneCapabilities')).toEqual({
      maxNumberOfChannels: 1,
      supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus],
      supportedSampleRates: [48000],
      supportedBitDepths: [16],
    });
    expect(device.getAttribute(WebRtcTransportProvider, 'currentSessions')).toEqual([]);
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it('should create an intercom device with custom identify options', async () => {
    const device = new Intercom('Intercom Identify', 'INTERCOM-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create an intercom device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new Intercom(`Intercom ${powerSourceType}`, `INTERCOM-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create an intercom device with no power source', async () => {
    const device = new Intercom('Intercom None', 'INTERCOM-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create an intercom device with custom stream usages', async () => {
    const device = new Intercom('Intercom Custom', 'INTERCOM-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });
});

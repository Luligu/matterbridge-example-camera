/**
 * @file vitest/rootNode.test.ts
 * @description This file contains the tests for the addRootNodeCamera() helper.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'RootNode';
const MATTER_PORT = 6007;
const MATTER_CREATE_ONLY = true;

import type { MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgePowerSourceServer } from 'matterbridge/behaviors';
import { Camera } from 'matterbridge/devices/camera';
import { PowerSourceServer, TlsCertificateManagementServer, TlsClientManagementServer } from 'matterbridge/matter/behaviors';
import { PowerSource, TimeSynchronization } from 'matterbridge/matter/clusters';
import {
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from 'matterbridge/test-utils/vitest';

import { addRootNodeCamera } from '../src/rootNode.js';
import { MATTER_EPOCH_US, MatterbridgeTimeSynchronizationServer } from '../src/timeSynchronizationServer.js';
import { MatterbridgeTlsCertificateManagementServer } from '../src/tlsCertificateManagementServer.js';
import { MatterbridgeTlsClientManagementServer } from '../src/tlsClientManagementServer.js';

await setupTest(NAME);

describe('addRootNodeCamera', () => {
  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node acting as the Camera device's own Root Node
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

  it('should throw if device.serverNode is not set', async () => {
    const device = new Camera('Root Node Camera No Server', 'ROOTNODE-NOSERVER');
    expect(device.serverNode).toBeUndefined();
    await expect(addRootNodeCamera(device)).rejects.toThrow(
      `addRootNodeCamera requires device.serverNode to be set: register the device with mode: 'server' before calling this helper.`,
    );
  });

  it('should keep the Power Source that Matterbridge already added to the Root Node', async () => {
    // Matterbridge adds a Wired Power Source to the Root Node of every server node with --root-power-source or MATTERBRIDGE_CHIP_TEST
    const require = vi.fn();
    const device = new Camera('Root Node Camera Power Source', 'ROOTNODE-POWERSOURCE');
    device.serverNode = { behaviors: { supported: { powerSource: PowerSourceServer.with(PowerSource.Feature.Wired) }, require } } as unknown as MatterbridgeEndpoint['serverNode'];

    expect(await addRootNodeCamera(device)).toBe(device);

    expect(require.mock.calls.map(([type]) => type)).toEqual([
      MatterbridgeTimeSynchronizationServer,
      MatterbridgeTlsCertificateManagementServer,
      MatterbridgeTlsClientManagementServer,
    ]);
  });

  it('should configure the Root Node of a mode: server Camera device', async () => {
    const device = new Camera('Root Node Camera', 'ROOTNODE-CAMERA');
    device.serverNode = server;

    expect(await addRootNodeCamera(device)).toBe(device);

    // KNOWN ISSUE: dynamically requiring MatterbridgePowerSourceServer on an already-installed ServerNode currently
    // crashes in the installed matter.js version: PowerSourceServer.initialize() synchronously writes to the
    // Descriptor's deviceTypeList, which races the Descriptor's own reactor triggered by the same late-activation
    // and throws `synchronous-transaction-conflict`. Until that's resolved upstream, only check that the behavior
    // was required with the correct options, without forcing full construction.
    expect(server.behaviors.has(MatterbridgePowerSourceServer.with(PowerSource.Feature.Wired))).toBe(true);
    expect(server.behaviors.optionsFor(MatterbridgePowerSourceServer)).toEqual({
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: 'AC Power',
      endpointList: [],
      wiredCurrentType: PowerSource.WiredCurrentType.Ac,
    });

    // Force construction of the dynamically required behaviors: root.behaviors.require() only builds their backing
    // immediately when the type is `early`; otherwise construction is deferred until something accesses the behavior.
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTimeSynchronizationServer);
      await agent.load(MatterbridgeTlsCertificateManagementServer);
      await agent.load(MatterbridgeTlsClientManagementServer);
      expect(agent.get(MatterbridgeTlsCertificateManagementServer)).toBeInstanceOf(MatterbridgeTlsCertificateManagementServer);
      expect(agent.get(MatterbridgeTlsCertificateManagementServer)).toBeInstanceOf(TlsCertificateManagementServer);
      expect(agent.get(MatterbridgeTlsClientManagementServer)).toBeInstanceOf(MatterbridgeTlsClientManagementServer);
      expect(agent.get(MatterbridgeTlsClientManagementServer)).toBeInstanceOf(TlsClientManagementServer);
    });

    // The Time Synchronization server reports the host clock
    const timeSyncState = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(timeSyncState.utcTime).not.toBeNull();
    expect(timeSyncState.granularity).toBe(TimeSynchronization.Granularity.MillisecondsGranularity);
    expect(timeSyncState.timeSource).toBe(TimeSynchronization.TimeSource.Unknown);
    expect(timeSyncState.timeZoneDatabase).toBe(TimeSynchronization.TimeZoneDatabase.None);
    expect(timeSyncState.timeZone).toEqual([{ offset: 0, validAt: MATTER_EPOCH_US }]);
    expect(timeSyncState.timeZoneListMaxSize).toBe(2);
    expect(timeSyncState.dstOffsetListMaxSize).toBe(2);

    const tlsCertificateState = server.stateOf(MatterbridgeTlsCertificateManagementServer);
    expect(tlsCertificateState.maxRootCertificates).toBe(5);
    expect(tlsCertificateState.maxClientCertificates).toBe(5);
    expect(tlsCertificateState.provisionedRootCertificates).toEqual([]);
    expect(tlsCertificateState.provisionedClientCertificates).toEqual([]);

    const tlsClientState = server.stateOf(MatterbridgeTlsClientManagementServer);
    expect(tlsClientState.maxProvisioned).toBe(5);
    expect(tlsClientState.provisionedEndpoints).toEqual([]);
  });
});

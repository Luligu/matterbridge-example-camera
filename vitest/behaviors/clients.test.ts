/**
 * @file vitest/behaviors/clients.test.ts
 * @description This file contains the tests for the addChimeClient/addWebRtcTransportRequestorClient helpers.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'ClientsBehavior';
const MATTER_PORT = 6009;
const MATTER_CREATE_ONLY = true;

import { doorbell, MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { ChimeClient, WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { Chime, Identify, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from 'matterbridge/vitest-utils';
import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, startServerNode, stopServerNode } from 'matterbridge/vitest-utils/matter';

import { addChimeClient, addWebRtcTransportRequestorClient } from '../../src/behaviors/clients.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('clients', () => {
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

  describe('addChimeClient', () => {
    it('should create MatterbridgeBindingServer when missing and register the Chime client', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'ChimeClientCreateBinding' });

      expect(endpoint.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
      expect(addChimeClient(endpoint)).toBe(endpoint);
      expect(endpoint.behaviors.has(MatterbridgeBindingServer)).toBeTruthy();

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([Chime.id]);
      expect(endpoint.type.clientClusters['chime']).toBe(ChimeClient);
    });

    it('should add Chime to an existing MatterbridgeBindingServer clientList', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'ChimeClientMerge' });
      endpoint.behaviors.require(MatterbridgeBindingServer, { clientList: [Identify.id] });

      expect(addChimeClient(endpoint)).toBe(endpoint);

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([Identify.id, Chime.id]);
    });

    it('should add Chime when an existing MatterbridgeBindingServer has no clientList option', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'ChimeClientNoOptions' });
      endpoint.behaviors.require(MatterbridgeBindingServer);

      expect(addChimeClient(endpoint)).toBe(endpoint);

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([Chime.id]);
    });

    it('should not duplicate the Chime entry when called on an endpoint that already has it registered', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'ChimeClientAlreadyRegistered' });
      addChimeClient(endpoint);

      expect(addChimeClient(endpoint)).toBe(endpoint);

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([Chime.id]);
    });
  });

  describe('addWebRtcTransportRequestorClient', () => {
    it('should create MatterbridgeBindingServer when missing and register the WebRtcTransportRequestor client', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'WebRtcRequestorClientCreateBinding' });

      expect(endpoint.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
      expect(addWebRtcTransportRequestorClient(endpoint)).toBe(endpoint);
      expect(endpoint.behaviors.has(MatterbridgeBindingServer)).toBeTruthy();

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([WebRtcTransportRequestor.id]);
      expect(endpoint.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);
    });

    it('should add WebRtcTransportRequestor to an existing MatterbridgeBindingServer clientList', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'WebRtcRequestorClientMerge' });
      endpoint.behaviors.require(MatterbridgeBindingServer, { clientList: [Identify.id] });

      expect(addWebRtcTransportRequestorClient(endpoint)).toBe(endpoint);

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([Identify.id, WebRtcTransportRequestor.id]);
    });

    it('should add WebRtcTransportRequestor when an existing MatterbridgeBindingServer has no clientList option', () => {
      const endpoint = new MatterbridgeEndpoint([doorbell], { id: 'WebRtcRequestorClientNoOptions' });
      endpoint.behaviors.require(MatterbridgeBindingServer);

      expect(addWebRtcTransportRequestorClient(endpoint)).toBe(endpoint);

      const clientList = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([WebRtcTransportRequestor.id]);
    });

    it('should add WebRtcTransportRequestor to an endpoint that already has it registered', () => {
      // The Camera constructor already calls addWebRtcTransportRequestorClient once; calling it again should return
      // the same endpoint without duplicating the clientList entry or the clientClusters mapping.
      const device = new Camera('Clients WebRtc', 'CLIENTS-WEBRTC');

      expect(addWebRtcTransportRequestorClient(device)).toBe(device);

      const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
      expect(clientList).toEqual([WebRtcTransportRequestor.id]);
    });
  });
});

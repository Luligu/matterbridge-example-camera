/**
 * @file src/rootNode.ts
 * @description This file contains the addRootNodeCamera() helper that configures the Root Node of a Camera device's own Matter server node.
 * @author Luca Liguori
 * @created 2026-07-14
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Matterbridge
import type { MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgePowerSourceServer } from 'matterbridge/behaviors';
import { TimeSynchronizationServer, TlsCertificateManagementServer, TlsClientManagementServer } from 'matterbridge/matter/behaviors';
import { PowerSource, TimeSynchronization } from 'matterbridge/matter/clusters';

/**
 * Configures the Root Node (endpoint 0) of a `mode: 'server'` Camera device's own Matter server node with the
 * clusters required by the Camera device type's Root Node Condition Requirements (Matter 1.6.0 Device Library
 * specification, clause 16.1.5 "Condition Requirements"): `TLSCertificatesCond`, `PowerSourceCond`,
 * `TimeSyncWithNTPCCond`, `TimeSyncWithClientCond`, `TimeSyncWithTZCond` and `TLSClientCond`.
 *
 * Per clause 2.1 "Root Node Device Type" (§2.1.5 "Cluster Requirements", §2.1.6 "Element Requirements"), these six
 * conditions resolve to:
 * - Power Source (0x0011) composed onto the Root Node itself (`PowerSourceCond`).
 * - Time Synchronization (0x0038) server with the TimeSyncClient, NtpClient and TimeZone features enabled
 *   (`TimeSyncWithClientCond`, `TimeSyncWithNTPCCond`, `TimeSyncWithTZCond`).
 * - TLS Certificate Management (0x0801) server (`TLSCertificatesCond`).
 * - TLS Client Management (0x0802) server (`TLSClientCond`).
 *
 * This only applies to a Camera running as its own independent server node: a bridged Camera's Root Node is
 * Matterbridge's shared aggregator node, which a plugin does not own and must not modify.
 *
 * @param {MatterbridgeEndpoint} device - A Camera device registered with `mode: 'server'`. Must be called after
 * `await this.registerDevice(device)` has resolved, since `device.serverNode` (the independent Matter server node
 * hosting the device's own Root Node) is only created as part of device registration.
 * @returns {Promise<MatterbridgeEndpoint>} The same device, for chaining.
 * @throws {Error} If `device.serverNode` is not set, i.e. the device was not registered with `mode: 'server'`.
 *
 * @remarks
 * `device.serverNode` is not a documented plugin API: Matterbridge does not currently expose a supported way for
 * plugin code to configure a `mode: 'server'` device's Root Node, so this helper reaches into the underlying
 * matter.js `ServerNode` directly. It may need to be revisited if Matterbridge core adds first-class support for this.
 */
// oxlint-disable-next-line typescript/require-await
export async function addRootNodeCamera(device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint> {
  if (!device.serverNode) {
    throw new Error(`addRootNodeCamera requires device.serverNode to be set: register the device with mode: 'server' before calling this helper.`);
  }
  const root = device.serverNode;

  // PowerSourceCond: Power Source shall be present on the Root Node.
  root.behaviors.require(MatterbridgePowerSourceServer.with(PowerSource.Feature.Wired), {
    status: PowerSource.PowerSourceStatus.Active,
    order: 0,
    description: 'AC Power',
    endpointList: [],
    wiredCurrentType: PowerSource.WiredCurrentType.Ac,
  });
  // PowerSourceServer.initialize() adds the Power Source (0x0011) device type to the Root Node's Descriptor
  // deviceTypeList automatically, alongside the Root Node (0x0016) entry matter.js already sets.

  // TimeSyncWithClientCond, TimeSyncWithNTPCCond, TimeSyncWithTZCond: Time Synchronization with the TimeSyncClient,
  // NtpClient and TimeZone features.
  root.behaviors.require(TimeSynchronizationServer.with(TimeSynchronization.Feature.TimeSyncClient, TimeSynchronization.Feature.NtpClient, TimeSynchronization.Feature.TimeZone), {
    utcTime: null,
    granularity: TimeSynchronization.Granularity.NoTimeGranularity,
    timeSource: TimeSynchronization.TimeSource.None,
    trustedTimeSource: null,
    defaultNtp: null,
    supportsDnsResolve: false,
    // validAt uses the epoch-us type, whose minimum valid value is the Matter epoch (2000-01-01): 0 is out of range.
    timeZone: [{ offset: 0, validAt: Date.now() * 1000 }],
    dstOffset: [],
    localTime: null,
    timeZoneDatabase: TimeSynchronization.TimeZoneDatabase.None,
    timeZoneListMaxSize: 1,
    dstOffsetListMaxSize: 1,
  });

  // TLSCertificatesCond: TLS Certificate Management shall be present on the Root Node.
  root.behaviors.require(TlsCertificateManagementServer, {
    maxRootCertificates: 5,
    provisionedRootCertificates: [],
    maxClientCertificates: 5,
    provisionedClientCertificates: [],
  });

  // TLSClientCond: TLS Client Management shall be present on the Root Node.
  root.behaviors.require(TlsClientManagementServer, {
    maxProvisioned: 5,
    provisionedEndpoints: [],
  });

  return device;
}

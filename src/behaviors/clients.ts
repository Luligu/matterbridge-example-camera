/**
 * @file src/behaviors/clients.ts
 * @description This file contains helpers that wire required cluster client behaviors (Chime, WebRtcTransportRequestor) onto a MatterbridgeEndpoint.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-20
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

import type { MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { ChimeClient, WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { Chime, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
import type { ClusterId } from 'matterbridge/matter/types';

/**
 * Adds a cluster id to the endpoint's MatterbridgeBindingServer clientList, so the Descriptor cluster's ClientList
 * declares it as required by the Matter specification. Safe to call multiple times or alongside other client
 * clusters: if MatterbridgeBindingServer has already been required (e.g. for another client cluster), the id is
 * merged into the existing clientList instead of overwriting it.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the client cluster id to.
 * @param {ClusterId} clusterId - The cluster id to add to the clientList.
 */
function addBindingClientListEntry(endpoint: MatterbridgeEndpoint, clusterId: ClusterId): void {
  if (endpoint.behaviors.has(MatterbridgeBindingServer)) {
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
    const existing = (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: ClusterId[] } | undefined)?.clientList ?? [];
    if (!existing.includes(clusterId)) {
      endpoint.behaviors.inject(MatterbridgeBindingServer, { clientList: [...existing, clusterId] });
    }
  } else {
    endpoint.behaviors.require(MatterbridgeBindingServer, { clientList: [clusterId] });
  }
}

/**
 * Registers the Chime client cluster on the given endpoint, so a bound Chime device can be triggered (e.g. when a
 * Doorbell or Audio Doorbell button is pressed).
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to register the Chime client cluster on.
 * @returns {MatterbridgeEndpoint} The endpoint with the Chime client cluster registered.
 */
export function addChimeClient(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  addBindingClientListEntry(endpoint, Chime.id);
  endpoint.type.clientClusters.chime ??= ChimeClient;
  return endpoint;
}

/**
 * Registers the WebRtcTransportRequestor client cluster on the given endpoint, so the Descriptor cluster's ClientList
 * declares it as required by the Matter specification. {@link MatterbridgeWebRtcTransportProviderServer} does not
 * resolve this client via a Binding at runtime — see
 * {@link MatterbridgeWebRtcTransportProviderServer.#resolvePeerRequestorEndpoint} — but the endpoint must still
 * declare the client cluster it invokes on peers.
 *
 * Matterbridge core does not map WebRtcTransportRequestor's client behavior type yet (see
 * getBehaviourTypeFromClusterClientId in matterbridgeEndpointHelpers.ts), so the generic addRequiredClusterClients()
 * only records the cluster id in MatterbridgeBindingServer's clientList (which is what populates the Descriptor's
 * ClientList) without wiring the actual WebRtcTransportRequestorClient behavior type into the endpoint. This helper
 * does that wiring directly, mirroring what addClusterClients does internally for clusters Matterbridge core already
 * maps.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to register the WebRtcTransportRequestor client cluster on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportRequestor client cluster registered.
 */
export function addWebRtcTransportRequestorClient(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  addBindingClientListEntry(endpoint, WebRtcTransportRequestor.id);
  endpoint.type.clientClusters.webRtcTransportRequestor ??= WebRtcTransportRequestorClient;
  return endpoint;
}

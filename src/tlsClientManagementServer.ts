/**
 * @file src/tlsClientManagementServer.ts
 * @description This file contains the MatterbridgeTlsClientManagementServer class, a TLS Client Management cluster server.
 * @author Luca Liguori
 * @created 2026-10-21
 * @version 2.0.0
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
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'matterbridge/logger';
import { Bytes } from 'matterbridge/matter';
import { TimeSynchronizationServer, TlsCertificateManagementServer, TlsClientManagementServer } from 'matterbridge/matter/behaviors';
import { TlsClientManagement } from 'matterbridge/matter/clusters';
import { FieldElement } from 'matterbridge/matter/model';
import { FabricIndex, Status, StatusResponseError } from 'matterbridge/matter/types';

import { allocateId } from './tlsCertificateManagementServer.js';

/** Largest TLSEndpointID, TLSCAID and TLSCCDID value. */
export const MAX_TLS_ENDPOINT_ID = 65534;

/** Shortest Hostname accepted, in octets: a single character, a dot and a two letters TLD (e.g. "a.bc"). */
export const MIN_HOSTNAME_BYTES = 4;

/** Longest Hostname accepted, in octets. */
export const MAX_HOSTNAME_BYTES = 253;

/** Module logger for the TLS Client Management server. */
const log = new AnsiLogger({ logName: 'TlsClient', logLevel: LogLevel.INFO, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/** Nonvolatile allocator of the TLS endpoint IDs, kept in a field of the behavior state that is not a cluster attribute. */
const TlsClientManagementSchema = TlsClientManagement.schema.extend(undefined, FieldElement({ name: 'NextEndpointId', type: 'uint16', quality: 'N' }));

/** matter.js base of {@link MatterbridgeTlsClientManagementServer}, with the persistent TLS endpoint ID allocator. */
const MatterbridgeTlsClientManagementServerBase = TlsClientManagementServer.for(TlsClientManagement, TlsClientManagementSchema);

/**
 * Checks whether two octet strings are equal.
 *
 * @param {Bytes} a - The first octet string.
 * @param {Bytes} b - The second octet string.
 * @returns {boolean} True if the octet strings are equal.
 */
function bytesEqual(a: Bytes, b: Bytes): boolean {
  return Buffer.from(Bytes.of(a)).equals(Buffer.from(Bytes.of(b)));
}

/**
 * TLS Client Management cluster server (0x0802, revision 1) for the Root Node of a Camera (`TLSClientCond`).
 *
 * The node stores, per fabric, up to MaxProvisioned TLS endpoints: a Hostname / Port pair with the root certificate
 * (CAID) that authenticates the server and the optional client certificate (CCDID) of the node, both provisioned
 * with the TLS Certificate Management cluster, which SHALL be present on the same endpoint. TLS endpoint IDs are unique on the node across
 * fabrics. The ReferenceCount of an endpoint counts the clusters using it: no cluster of this plugin uses TLS
 * endpoints, so it stays 0. matter.js removes the TLS endpoints of a fabric when the fabric is removed.
 *
 * Behavior follows the Matter 1.6.1 data model (data_model/1.6.1/clusters/TLSClientManagement.xml), the CHIP
 * v1.6.1.0 reference server and the TC-TLSCLIENT-x.x certification tests.
 */
export class MatterbridgeTlsClientManagementServer extends MatterbridgeTlsClientManagementServerBase {
  declare state: MatterbridgeTlsClientManagementServer.State;

  /**
   * Handles the ProvisionEndpoint command: provisions a new TLS endpoint (null EndpointID) or updates an existing TLS
   * endpoint of the accessing fabric.
   *
   * @param {TlsClientManagement.ProvisionEndpointRequest} request - The command request.
   * @returns {TlsClientManagement.ProvisionEndpointResponse} The EndpointID of the provisioned TLS endpoint.
   * @throws {StatusResponseError} ConstraintError if the Hostname is not 4 to 253 octets, the Port is 0 or an ID is
   * out of range, InvalidTime if the node has no UTC time to validate the certificates, RootCertificateNotFound or
   * ClientCertificateNotFound if the CAID or the CCDID does not exist on the fabric, EndpointAlreadyInstalled if
   * another TLS endpoint of the fabric has the same Hostname and Port, ResourceExhausted if the fabric has
   * MaxProvisioned TLS endpoints, NotFound if the EndpointID does not exist on the fabric.
   */
  override provisionEndpoint(request: TlsClientManagement.ProvisionEndpointRequest): TlsClientManagement.ProvisionEndpointResponse {
    const hostname = Bytes.of(request.hostname);
    const { port, caid, ccdid, endpointId } = request;
    const fabric = this.#accessingFabric();
    if (hostname.byteLength < MIN_HOSTNAME_BYTES || hostname.byteLength > MAX_HOSTNAME_BYTES) {
      throw new StatusResponseError(`ProvisionEndpoint: hostname of ${hostname.byteLength} octets is not ${MIN_HOSTNAME_BYTES} to ${MAX_HOSTNAME_BYTES}`, Status.ConstraintError);
    }
    if (port < 1) throw new StatusResponseError('ProvisionEndpoint: port 0 is not valid', Status.ConstraintError);
    if (caid > MAX_TLS_ENDPOINT_ID || (ccdid !== null && ccdid > MAX_TLS_ENDPOINT_ID) || (endpointId !== null && endpointId > MAX_TLS_ENDPOINT_ID)) {
      throw new StatusResponseError('ProvisionEndpoint: CAID, CCDID or EndpointID out of range', Status.ConstraintError);
    }
    // The InvalidTime status code: the certificates of a TLS endpoint cannot be validated before time synchronization.
    if (this.endpoint.behaviors.has(TimeSynchronizationServer) && this.endpoint.stateOf(TimeSynchronizationServer).utcTime === null) {
      throw new TlsClientManagement.InvalidTimeError('ProvisionEndpoint: time synchronization has not yet occurred');
    }
    const certificates = this.endpoint.stateOf(TlsCertificateManagementServer);
    if (!certificates.provisionedRootCertificates.some((entry) => entry.fabricIndex === fabric && entry.caid === caid)) {
      throw new TlsClientManagement.RootCertificateNotFoundError(`ProvisionEndpoint: CAID ${caid} not found`);
    }
    if (ccdid !== null && !certificates.provisionedClientCertificates.some((entry) => entry.fabricIndex === fabric && entry.ccdid === ccdid)) {
      throw new TlsClientManagement.ClientCertificateNotFoundError(`ProvisionEndpoint: CCDID ${ccdid} not found`);
    }
    const endpoints = this.state.provisionedEndpoints;
    const fabricEndpoints = endpoints.filter((endpoint) => endpoint.fabricIndex === fabric);
    if (fabricEndpoints.some((endpoint) => endpoint.port === port && bytesEqual(endpoint.hostname, hostname) && endpoint.endpointId !== endpointId)) {
      throw new TlsClientManagement.EndpointAlreadyInstalledError('ProvisionEndpoint: an endpoint with the same hostname and port is already installed');
    }
    if (endpointId === null) {
      if (fabricEndpoints.length >= this.state.maxProvisioned) {
        throw new StatusResponseError(`ProvisionEndpoint: fabric ${fabric} already has ${this.state.maxProvisioned} endpoints`, Status.ResourceExhausted);
      }
      const id = allocateId(new Set(endpoints.map((endpoint) => endpoint.endpointId)), this.state.nextEndpointId);
      this.state.nextEndpointId = (id + 1) % (MAX_TLS_ENDPOINT_ID + 1);
      this.state.provisionedEndpoints = [...endpoints, { endpointId: id, hostname, port, caid, ccdid, referenceCount: 0, fabricIndex: FabricIndex(fabric) }];
      log.info(`TLS endpoint ${id} provisioned on fabric ${fabric}`);
      return { endpointId: id };
    }
    const existing = fabricEndpoints.find((endpoint) => endpoint.endpointId === endpointId);
    if (existing === undefined) throw new StatusResponseError(`ProvisionEndpoint: EndpointID ${endpointId} not found`, Status.NotFound);
    // The ReferenceCount is kept: the clusters using the TLS endpoint still use it after the update.
    const { referenceCount } = existing;
    this.state.provisionedEndpoints = endpoints.map((endpoint) =>
      endpoint.fabricIndex === fabric && endpoint.endpointId === endpointId
        ? { endpointId, hostname, port, caid, ccdid, referenceCount, fabricIndex: FabricIndex(fabric) }
        : endpoint,
    );
    log.info(`TLS endpoint ${endpointId} updated on fabric ${fabric}`);
    return { endpointId };
  }

  /**
   * Handles the FindEndpoint command: returns the TLS endpoint of an EndpointID of the accessing fabric.
   *
   * @param {TlsClientManagement.FindEndpointRequest} request - The command request.
   * @returns {TlsClientManagement.FindEndpointResponse} The TLS endpoint.
   * @throws {StatusResponseError} ConstraintError if the EndpointID is out of range, NotFound if it does not exist on the fabric.
   */
  override findEndpoint(request: TlsClientManagement.FindEndpointRequest): TlsClientManagement.FindEndpointResponse {
    const { endpointId } = request;
    const fabric = this.#accessingFabric();
    if (endpointId > MAX_TLS_ENDPOINT_ID) throw new StatusResponseError(`FindEndpoint: EndpointID ${endpointId} out of range`, Status.ConstraintError);
    const endpoint = this.state.provisionedEndpoints.find((entry) => entry.fabricIndex === fabric && entry.endpointId === endpointId);
    if (endpoint === undefined) throw new StatusResponseError(`FindEndpoint: EndpointID ${endpointId} not found`, Status.NotFound);
    return { endpoint };
  }

  /**
   * Handles the RemoveEndpoint command: removes a TLS endpoint of the accessing fabric.
   *
   * @param {TlsClientManagement.RemoveEndpointRequest} request - The command request.
   * @throws {StatusResponseError} ConstraintError if the EndpointID is out of range, NotFound if it does not exist on
   * the fabric, EndpointInUse if its ReferenceCount is not 0.
   */
  override removeEndpoint(request: TlsClientManagement.RemoveEndpointRequest): void {
    const { endpointId } = request;
    const fabric = this.#accessingFabric();
    if (endpointId > MAX_TLS_ENDPOINT_ID) throw new StatusResponseError(`RemoveEndpoint: EndpointID ${endpointId} out of range`, Status.ConstraintError);
    const endpoints = this.state.provisionedEndpoints;
    const endpoint = endpoints.find((entry) => entry.fabricIndex === fabric && entry.endpointId === endpointId);
    if (endpoint === undefined) throw new StatusResponseError(`RemoveEndpoint: EndpointID ${endpointId} not found`, Status.NotFound);
    if (endpoint.referenceCount > 0) {
      throw new TlsClientManagement.EndpointInUseError(`RemoveEndpoint: EndpointID ${endpointId} is in use by ${endpoint.referenceCount} clusters`);
    }
    this.state.provisionedEndpoints = endpoints.filter((entry) => !(entry.fabricIndex === fabric && entry.endpointId === endpointId));
    log.info(`TLS endpoint ${endpointId} removed from fabric ${fabric}`);
  }

  /**
   * Returns the accessing fabric of the command. All the commands of the cluster are fabric scoped, and matter.js
   * rejects them with UnsupportedAccess when there is no accessing fabric.
   *
   * @returns {number} The accessing fabric index.
   * @throws {StatusResponseError} UnsupportedAccess if the command has no accessing fabric (undefined or NO_FABRIC).
   */
  #accessingFabric(): number {
    const fabric = this.context.fabric;
    if (fabric === undefined || fabric === FabricIndex.NO_FABRIC)
      throw new StatusResponseError('TLS Client Management commands require an accessing fabric', Status.UnsupportedAccess);
    return fabric;
  }
}

/**
 * matter.js's own Behavior subclasses declare State this way; it is how the framework resolves `this.state`'s type.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeTlsClientManagementServer {
  /**
   * State of {@link MatterbridgeTlsClientManagementServer}: the cluster attributes and the nonvolatile TLS endpoint ID allocator.
   */
  export class State extends MatterbridgeTlsClientManagementServerBase.State {
    /** The next TLS endpoint ID to allocate. */
    nextEndpointId = 0;
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
}

/**
 * @file src/tlsClientManagementServer.ts
 * @description This file contains the MatterbridgeTlsClientManagementServer class, a TLS Client Management cluster server placeholder.
 * @author Luca Liguori
 * @created 2026-10-21
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

/* oxlint-disable eslint/no-empty-function -- Command handlers are intentionally empty placeholders. */

import { TlsClientManagementServer } from 'matterbridge/matter/behaviors';
import { TlsClientManagement } from 'matterbridge/matter/clusters';

/**
 * TLS Client Management server for the Root Node of a Camera (`TLSClientCond`).
 * Commands are placeholders with empty typed responses and no endpoint management logic.
 */
export class MatterbridgeTlsClientManagementServer extends TlsClientManagementServer {
  /**
   * Handles ProvisionEndpoint with a placeholder response.
   *
   * @param {TlsClientManagement.ProvisionEndpointRequest} _request - The command request.
   * @returns {TlsClientManagement.ProvisionEndpointResponse} An empty typed response.
   */
  override provisionEndpoint(_request: TlsClientManagement.ProvisionEndpointRequest): TlsClientManagement.ProvisionEndpointResponse {
    return new TlsClientManagement.ProvisionEndpointResponse();
  }

  /**
   * Handles FindEndpoint with a placeholder response.
   *
   * @param {TlsClientManagement.FindEndpointRequest} _request - The command request.
   * @returns {TlsClientManagement.FindEndpointResponse} An empty typed response.
   */
  override findEndpoint(_request: TlsClientManagement.FindEndpointRequest): TlsClientManagement.FindEndpointResponse {
    return new TlsClientManagement.FindEndpointResponse();
  }

  /**
   * Handles RemoveEndpoint without changing state.
   *
   * @param {TlsClientManagement.RemoveEndpointRequest} _request - The command request.
   */
  override removeEndpoint(_request: TlsClientManagement.RemoveEndpointRequest): void {}
}

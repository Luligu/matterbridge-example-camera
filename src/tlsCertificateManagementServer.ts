/**
 * @file src/tlsCertificateManagementServer.ts
 * @description This file contains the MatterbridgeTlsCertificateManagementServer class, a TLS Certificate Management cluster server placeholder.
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

import { TlsCertificateManagementServer } from 'matterbridge/matter/behaviors';
import { TlsCertificateManagement } from 'matterbridge/matter/clusters';

/**
 * TLS Certificate Management server for the Root Node of a Camera (`TLSCertificatesCond`).
 * Commands are placeholders with empty typed responses and no certificate management logic.
 */
export class MatterbridgeTlsCertificateManagementServer extends TlsCertificateManagementServer {
  /**
   * Handles ProvisionRootCertificate with a placeholder response.
   *
   * @param {TlsCertificateManagement.ProvisionRootCertificateRequest} _request - The command request.
   * @returns {TlsCertificateManagement.ProvisionRootCertificateResponse} An empty typed response.
   */
  override provisionRootCertificate(_request: TlsCertificateManagement.ProvisionRootCertificateRequest): TlsCertificateManagement.ProvisionRootCertificateResponse {
    return new TlsCertificateManagement.ProvisionRootCertificateResponse();
  }

  /**
   * Handles FindRootCertificate with a placeholder response.
   *
   * @param {TlsCertificateManagement.FindRootCertificateRequest} _request - The command request.
   * @returns {TlsCertificateManagement.FindRootCertificateResponse} An empty typed response.
   */
  override findRootCertificate(_request: TlsCertificateManagement.FindRootCertificateRequest): TlsCertificateManagement.FindRootCertificateResponse {
    return new TlsCertificateManagement.FindRootCertificateResponse();
  }

  /**
   * Handles LookupRootCertificate with a placeholder response.
   *
   * @param {TlsCertificateManagement.LookupRootCertificateRequest} _request - The command request.
   * @returns {TlsCertificateManagement.LookupRootCertificateResponse} An empty typed response.
   */
  override lookupRootCertificate(_request: TlsCertificateManagement.LookupRootCertificateRequest): TlsCertificateManagement.LookupRootCertificateResponse {
    return new TlsCertificateManagement.LookupRootCertificateResponse();
  }

  /**
   * Handles RemoveRootCertificate without changing state.
   *
   * @param {TlsCertificateManagement.RemoveRootCertificateRequest} _request - The command request.
   */
  override removeRootCertificate(_request: TlsCertificateManagement.RemoveRootCertificateRequest): void {}

  /**
   * Handles ClientCSR with a placeholder response.
   *
   * @param {TlsCertificateManagement.ClientCsrRequest} _request - The command request.
   * @returns {TlsCertificateManagement.ClientCsrResponse} An empty typed response.
   */
  override clientCsr(_request: TlsCertificateManagement.ClientCsrRequest): TlsCertificateManagement.ClientCsrResponse {
    return new TlsCertificateManagement.ClientCsrResponse();
  }

  /**
   * Handles ProvisionClientCertificate without changing state.
   *
   * @param {TlsCertificateManagement.ProvisionClientCertificateRequest} _request - The command request.
   */
  override provisionClientCertificate(_request: TlsCertificateManagement.ProvisionClientCertificateRequest): void {}

  /**
   * Handles FindClientCertificate with a placeholder response.
   *
   * @param {TlsCertificateManagement.FindClientCertificateRequest} _request - The command request.
   * @returns {TlsCertificateManagement.FindClientCertificateResponse} An empty typed response.
   */
  override findClientCertificate(_request: TlsCertificateManagement.FindClientCertificateRequest): TlsCertificateManagement.FindClientCertificateResponse {
    return new TlsCertificateManagement.FindClientCertificateResponse();
  }

  /**
   * Handles LookupClientCertificate with a placeholder response.
   *
   * @param {TlsCertificateManagement.LookupClientCertificateRequest} _request - The command request.
   * @returns {TlsCertificateManagement.LookupClientCertificateResponse} An empty typed response.
   */
  override lookupClientCertificate(_request: TlsCertificateManagement.LookupClientCertificateRequest): TlsCertificateManagement.LookupClientCertificateResponse {
    return new TlsCertificateManagement.LookupClientCertificateResponse();
  }

  /**
   * Handles RemoveClientCertificate without changing state.
   *
   * @param {TlsCertificateManagement.RemoveClientCertificateRequest} _request - The command request.
   */
  override removeClientCertificate(_request: TlsCertificateManagement.RemoveClientCertificateRequest): void {}
}

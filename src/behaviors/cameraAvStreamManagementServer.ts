/**
 * @file packages/core/src/behaviors/cameraAvStreamManagementServer.ts
 * @description This file contains the MatterbridgeCameraAvStreamManagementServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-07-13
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

import { MatterbridgeServer } from 'matterbridge/behaviors';
import { CameraAvStreamManagementServer } from 'matterbridge/matter/behaviors';
import { CameraAvStreamManagement } from 'matterbridge/matter/clusters';
import { Status, StatusResponseError } from 'matterbridge/matter/types';

/**
 * CameraAvStreamManagement server, specialized for the Snapshot feature only, that implements the
 * stream-priority, snapshot-stream allocation, and snapshot-capture commands required by a Snapshot Camera device.
 */
export class MatterbridgeCameraAvStreamManagementServer extends CameraAvStreamManagementServer.with(
  CameraAvStreamManagement.Feature.Snapshot,
  CameraAvStreamManagement.Feature.ImageControl,
) {
  /**
   * Handles the SnapshotStreamAllocate command (SNP).
   * Allocates a new snapshot stream from the parameters passed in the request and returns its generated identifier.
   *
   * @param {CameraAvStreamManagement.SnapshotStreamAllocateRequest} request - SnapshotStreamAllocate request payload.
   * @returns {Promise<CameraAvStreamManagement.SnapshotStreamAllocateResponse>} The newly allocated snapshot stream identifier.
   */
  // oxlint-disable-next-line typescript/require-await
  override async snapshotStreamAllocate(request: CameraAvStreamManagement.SnapshotStreamAllocateRequest): Promise<CameraAvStreamManagement.SnapshotStreamAllocateResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    let snapshotStreamId = 0;
    for (const stream of this.state.allocatedSnapshotStreams) {
      snapshotStreamId = Math.max(snapshotStreamId, stream.snapshotStreamId + 1);
    }
    this.state.allocatedSnapshotStreams = [
      ...this.state.allocatedSnapshotStreams,
      {
        snapshotStreamId,
        imageCodec: request.imageCodec,
        frameRate: request.maxFrameRate,
        minResolution: request.minResolution,
        maxResolution: request.maxResolution,
        quality: request.quality,
        referenceCount: 0,
        encodedPixels: false,
        hardwareEncoder: false,
        watermarkEnabled: request.watermarkEnabled,
        osdEnabled: request.osdEnabled,
      },
    ];
    device.log.info(`Allocated snapshot stream ${snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    return { snapshotStreamId };
  }

  /**
   * Handles the SnapshotStreamDeallocate command (SNP).
   * Removes the snapshot stream identified in the request from the allocated snapshot streams.
   *
   * @param {CameraAvStreamManagement.SnapshotStreamDeallocateRequest} request - SnapshotStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested snapshotStreamId is not present in allocatedSnapshotStreams.
   */
  // oxlint-disable-next-line typescript/require-await
  override async snapshotStreamDeallocate(request: CameraAvStreamManagement.SnapshotStreamDeallocateRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.allocatedSnapshotStreams.some((stream) => stream.snapshotStreamId === request.snapshotStreamId)) {
      throw new StatusResponseError(`Snapshot stream ${request.snapshotStreamId} is not present in allocatedSnapshotStreams`, Status.NotFound);
    }
    this.state.allocatedSnapshotStreams = this.state.allocatedSnapshotStreams.filter((stream) => stream.snapshotStreamId !== request.snapshotStreamId);
    device.log.info(`Deallocated snapshot stream ${request.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }

  /**
   * Handles the CaptureSnapshot command.
   * Returns a snapshot from the camera for the requested (or automatically selected) snapshot stream.
   *
   * @param {CameraAvStreamManagement.CaptureSnapshotRequest} request - CaptureSnapshot request payload.
   * @returns {Promise<CameraAvStreamManagement.CaptureSnapshotResponse>} The captured snapshot.
   */
  // oxlint-disable-next-line typescript/require-await
  override async captureSnapshot(request: CameraAvStreamManagement.CaptureSnapshotRequest): Promise<CameraAvStreamManagement.CaptureSnapshotResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Capturing snapshot ${request.snapshotStreamId ?? 'auto'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // TODO: Add CameraAvStreamManagement.captureSnapshot in matterbridge
    /*
    await device.commandHandler.executeHandler('CameraAvStreamManagement.captureSnapshot', {
      command: 'captureSnapshot',
      request,
      cluster: CameraAvStreamManagementServer.id,
      attributes: this.state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    */
    device.log.debug(`MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId ${request.snapshotStreamId}`);
    return {
      data: new Uint8Array(0),
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      resolution: request.requestedResolution,
    };
  }

  /**
   * Handles the SetStreamPriorities command (M).
   * Replaces the ranked list of stream usage priorities with the one passed in the request.
   *
   * @param {CameraAvStreamManagement.SetStreamPrioritiesRequest} request - SetStreamPriorities request payload.
   */
  // oxlint-disable-next-line typescript/require-await
  override async setStreamPriorities(request: CameraAvStreamManagement.SetStreamPrioritiesRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting stream priorities to ${request.streamPriorities.join(', ')} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.state.streamUsagePriorities = request.streamPriorities;
  }
}

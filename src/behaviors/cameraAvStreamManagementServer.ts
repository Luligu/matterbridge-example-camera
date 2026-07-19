/**
 * @file packages/core/src/behaviors/cameraAvStreamManagementServer.ts
 * @description This file contains the MatterbridgeCameraAvStreamManagementServer class of Matterbridge.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
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

import { readFileSync } from 'node:fs';

import { MatterbridgeServer } from 'matterbridge/behaviors';
import { CameraAvStreamManagementServer } from 'matterbridge/matter/behaviors';
import { CameraAvStreamManagement } from 'matterbridge/matter/clusters';
import { Status, StatusResponseError } from 'matterbridge/matter/types';

/**
 * A static JPEG television calibration card available to serve from `CaptureSnapshot`, at a given resolution.
 */
export interface CameraColorTestJpeg {
  /** The JPEG image data. */
  data: Buffer;
  /** The resolution of the JPEG image. */
  resolution: CameraAvStreamManagement.VideoResolution;
}

const DEFAULT_CAMERA_COLOR_TEST_RESOLUTION = '640x480';

const cameraColorTestJpegs: Record<string, CameraColorTestJpeg> = {
  '640x480': { data: readFileSync(new URL('../../assets/camera-color-test-640-480.jpeg', import.meta.url)), resolution: { width: 640, height: 480 } },
  '1280x720': { data: readFileSync(new URL('../../assets/camera-color-test-1280-720.jpeg', import.meta.url)), resolution: { width: 1280, height: 720 } },
  '1920x1080': { data: readFileSync(new URL('../../assets/camera-color-test-1920-1080.jpeg', import.meta.url)), resolution: { width: 1920, height: 1080 } },
};

/**
 * Returns the {@link CameraColorTestJpeg} calibration card matching the requested resolution exactly.
 *
 * Edge cases:
 *  - Falls back to the 640x480 card when the requested resolution isn't one of the standard camera resolutions (640x480, 1280x720, 1920x1080).
 *
 * @param {CameraAvStreamManagement.VideoResolution} requestedResolution - The resolution requested by the client.
 * @returns {CameraColorTestJpeg} The matching calibration card.
 */
export function cameraColorTestJpegForResolution(requestedResolution: CameraAvStreamManagement.VideoResolution): CameraColorTestJpeg {
  return cameraColorTestJpegs[`${requestedResolution.width}x${requestedResolution.height}`] ?? cameraColorTestJpegs[DEFAULT_CAMERA_COLOR_TEST_RESOLUTION];
}

/**
 * CameraAvStreamManagement server, specialized for the Snapshot feature only, that implements the
 * stream-priority, snapshot-stream allocation, and snapshot-capture commands required by a Snapshot Camera device.
 */
export class MatterbridgeCameraAvStreamManagementServer extends CameraAvStreamManagementServer.with(
  CameraAvStreamManagement.Feature.Video,
  CameraAvStreamManagement.Feature.Audio,
  CameraAvStreamManagement.Feature.Snapshot,
  CameraAvStreamManagement.Feature.ImageControl,
) {
  /**
   * Handles the SetStreamPriorities command.
   * Sets the relative priorities of the various stream usages on the camera.
   *
   * @param {CameraAvStreamManagement.SetStreamPrioritiesRequest} request - SetStreamPriorities request payload.
   * @throws {StatusResponseError} With status InvalidInState if a snapshot, video, or audio stream is currently allocated.
   * @throws {StatusResponseError} With status DynamicConstraintError if streamPriorities contains an unsupported stream usage.
   * @throws {StatusResponseError} With status AlreadyExists if streamPriorities contains a duplicate value.
   */
  override setStreamPriorities(request: CameraAvStreamManagement.SetStreamPrioritiesRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (
      (this.features.snapshot && this.state.allocatedSnapshotStreams.length > 0) ||
      (this.features.video && this.state.allocatedVideoStreams.length > 0) ||
      (this.features.audio && this.state.allocatedAudioStreams.length > 0)
    ) {
      throw new StatusResponseError('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated', Status.InvalidInState);
    }
    if (!request.streamPriorities.every((usage) => this.state.supportedStreamUsages.includes(usage))) {
      throw new StatusResponseError('streamPriorities shall only contain entries found in supportedStreamUsages', Status.DynamicConstraintError);
    }
    if (new Set(request.streamPriorities).size !== request.streamPriorities.length) {
      throw new StatusResponseError('streamPriorities shall not contain duplicate values', Status.AlreadyExists);
    }
    device.log.info(`Setting stream priorities to [${request.streamPriorities.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.state.streamUsagePriorities = request.streamPriorities;
  }

  /**
   * Handles the VideoStreamAllocate command.
   * Allocates a video stream on the camera and returns the newly allocated video stream identifier.
   *
   * @param {CameraAvStreamManagement.VideoStreamAllocateRequest} request - VideoStreamAllocate request payload.
   * @returns {CameraAvStreamManagement.VideoStreamAllocateResponse} The newly allocated video stream identifier.
   * @throws {StatusResponseError} With status ConstraintError if the requested stream usage is not present in supportedStreamUsages.
   */
  override videoStreamAllocate(request: CameraAvStreamManagement.VideoStreamAllocateRequest): CameraAvStreamManagement.VideoStreamAllocateResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.supportedStreamUsages.includes(request.streamUsage)) {
      throw new StatusResponseError(`Stream usage ${request.streamUsage} is not present in supportedStreamUsages`, Status.ConstraintError);
    }
    let videoStreamId = 0;
    for (const stream of this.state.allocatedVideoStreams) {
      videoStreamId = Math.max(videoStreamId, stream.videoStreamId + 1);
    }
    this.state.allocatedVideoStreams = [
      ...this.state.allocatedVideoStreams,
      {
        videoStreamId,
        streamUsage: request.streamUsage,
        videoCodec: request.videoCodec,
        minFrameRate: request.minFrameRate,
        maxFrameRate: request.maxFrameRate,
        minResolution: request.minResolution,
        maxResolution: request.maxResolution,
        minBitRate: request.minBitRate,
        maxBitRate: request.maxBitRate,
        keyFrameInterval: request.keyFrameInterval,
        watermarkEnabled: request.watermarkEnabled,
        osdEnabled: request.osdEnabled,
        referenceCount: 0,
      },
    ];
    device.log.info(`Allocated video stream ${videoStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    return { videoStreamId };
  }

  /**
   * Handles the VideoStreamDeallocate command.
   * Deallocates the video stream on the camera corresponding to the given video stream identifier.
   *
   * @param {CameraAvStreamManagement.VideoStreamDeallocateRequest} request - VideoStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested videoStreamId is not present in allocatedVideoStreams.
   */
  override videoStreamDeallocate(request: CameraAvStreamManagement.VideoStreamDeallocateRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.allocatedVideoStreams.some((stream) => stream.videoStreamId === request.videoStreamId)) {
      throw new StatusResponseError(`Video stream ${request.videoStreamId} is not present in allocatedVideoStreams`, Status.NotFound);
    }
    this.state.allocatedVideoStreams = this.state.allocatedVideoStreams.filter((stream) => stream.videoStreamId !== request.videoStreamId);
    device.log.info(`Deallocated video stream ${request.videoStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }

  /**
   * Handles the AudioStreamAllocate command.
   * Allocates an audio stream on the camera and returns the newly allocated audio stream identifier.
   *
   * @param {CameraAvStreamManagement.AudioStreamAllocateRequest} request - AudioStreamAllocate request payload.
   * @returns {CameraAvStreamManagement.AudioStreamAllocateResponse} The newly allocated audio stream identifier.
   * @throws {StatusResponseError} With status ConstraintError if the requested stream usage is not present in supportedStreamUsages.
   */
  override audioStreamAllocate(request: CameraAvStreamManagement.AudioStreamAllocateRequest): CameraAvStreamManagement.AudioStreamAllocateResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.supportedStreamUsages.includes(request.streamUsage)) {
      throw new StatusResponseError(`Stream usage ${request.streamUsage} is not present in supportedStreamUsages`, Status.ConstraintError);
    }
    let audioStreamId = 0;
    for (const stream of this.state.allocatedAudioStreams) {
      audioStreamId = Math.max(audioStreamId, stream.audioStreamId + 1);
    }
    this.state.allocatedAudioStreams = [
      ...this.state.allocatedAudioStreams,
      {
        audioStreamId,
        streamUsage: request.streamUsage,
        audioCodec: request.audioCodec,
        channelCount: request.channelCount,
        sampleRate: request.sampleRate,
        bitRate: request.bitRate,
        bitDepth: request.bitDepth,
        referenceCount: 0,
      },
    ];
    device.log.info(`Allocated audio stream ${audioStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    return { audioStreamId };
  }

  /**
   * Handles the AudioStreamDeallocate command.
   * Deallocates the audio stream on the camera corresponding to the given audio stream identifier.
   *
   * @param {CameraAvStreamManagement.AudioStreamDeallocateRequest} request - AudioStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested audioStreamId is not present in allocatedAudioStreams.
   */
  override audioStreamDeallocate(request: CameraAvStreamManagement.AudioStreamDeallocateRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.allocatedAudioStreams.some((stream) => stream.audioStreamId === request.audioStreamId)) {
      throw new StatusResponseError(`Audio stream ${request.audioStreamId} is not present in allocatedAudioStreams`, Status.NotFound);
    }
    this.state.allocatedAudioStreams = this.state.allocatedAudioStreams.filter((stream) => stream.audioStreamId !== request.audioStreamId);
    device.log.info(`Deallocated audio stream ${request.audioStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }

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
   * The image data is a static JPEG television calibration card, picked from {@link cameraColorTestJpegs} to match
   * the requested resolution, until a real capture pipeline is wired in.
   *
   * @param {CameraAvStreamManagement.CaptureSnapshotRequest} request - CaptureSnapshot request payload.
   * @returns {Promise<CameraAvStreamManagement.CaptureSnapshotResponse>} The captured snapshot.
   */
  // oxlint-disable-next-line typescript/require-await
  override async captureSnapshot(request: CameraAvStreamManagement.CaptureSnapshotRequest): Promise<CameraAvStreamManagement.CaptureSnapshotResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Capturing snapshot ${request.snapshotStreamId ?? 'auto'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // TODO: Replace the static calibration card with a real capture once CameraAvStreamManagement.captureSnapshot is wired into matterbridge
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
    const { data, resolution } = cameraColorTestJpegForResolution(request.requestedResolution);
    return {
      data,
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      resolution,
    };
  }
}

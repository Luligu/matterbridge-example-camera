/**
 * @file src/behaviors/videoCameraAvStreamManagementServer.ts
 * @description This file contains the MatterbridgeVideoCameraAvStreamManagementServer class of Matterbridge.
 * @author Ludovic BOUÉ
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

import type { MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgeServer } from 'matterbridge/behaviors';
import { CameraAvStreamManagementServer } from 'matterbridge/matter/behaviors';
import type { CameraAvStreamManagement } from 'matterbridge/matter/clusters';
import { Status, StatusResponseError, ThreeLevelAuto } from 'matterbridge/matter/types';
import type { StreamUsage, Viewport } from 'matterbridge/matter/types';

/**
 * CameraAvStreamManagement server that implements the Video and ImageControl features: video stream allocation/deallocation,
 * stream priority management, and image orientation control.
 *
 * Only the Video and ImageControl features are enabled: the Audio, Snapshot and other optional features are not supported by this
 * implementation. ImageControl is enabled alongside Video because the Matter specification ties the
 * ImageRotation/ImageFlipHorizontal/ImageFlipVertical attributes to an "at least one" choice constraint that matter.js validates
 * against the full cluster schema regardless of the selected feature set, so ImageControl must be enabled and one of its
 * attributes set for the cluster to validate.
 *
 * Not exported directly: its base class, produced by CameraAvStreamManagementServer.with(...), has an inferred type that
 * references matter.js internals in a way tsc cannot always express as a portable declaration (TS2883) when matterbridge
 * is consumed via npm link, as CI does. {@link MatterbridgeVideoCameraAvStreamManagementServer} exports the same class typed as
 * the already-portable unspecialized CameraAvStreamManagementServer instead.
 */
class MatterbridgeVideoCameraAvStreamManagementServerImpl extends CameraAvStreamManagementServer.with('Video', 'ImageControl') {
  /**
   * Handles the SetStreamPriorities command.
   * Sets the relative priorities of the various stream usages on the camera.
   *
   * @param {CameraAvStreamManagement.SetStreamPrioritiesRequest} request - SetStreamPriorities request payload.
   * @throws {StatusResponseError} With status InvalidInState if a video stream is currently allocated.
   * @throws {StatusResponseError} With status ConstraintError if streamPriorities contains a duplicate or unsupported stream usage.
   */
  override setStreamPriorities(request: CameraAvStreamManagement.SetStreamPrioritiesRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (this.state.allocatedVideoStreams.length > 0) {
      throw new StatusResponseError('setStreamPriorities cannot be invoked while video streams are allocated', Status.InvalidInState);
    }
    if (new Set(request.streamPriorities).size !== request.streamPriorities.length) {
      throw new StatusResponseError('streamPriorities shall not contain duplicate values', Status.ConstraintError);
    }
    if (!request.streamPriorities.every((usage) => this.state.supportedStreamUsages.includes(usage))) {
      throw new StatusResponseError('streamPriorities shall only contain entries found in supportedStreamUsages', Status.ConstraintError);
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
}

/**
 * CameraAvStreamManagement server that implements the Video and ImageControl features: video stream allocation/deallocation,
 * stream priority management, and image orientation control. See {@link MatterbridgeVideoCameraAvStreamManagementServerImpl}.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see MatterbridgeVideoCameraAvStreamManagementServerImpl's doc comment above for why this narrowing cast is required.
export const MatterbridgeVideoCameraAvStreamManagementServer = MatterbridgeVideoCameraAvStreamManagementServerImpl as unknown as typeof CameraAvStreamManagementServer;

/**
 * Initial state accepted by {@link createDefaultCameraAvStreamManagementClusterServer}.
 */
export interface CameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the camera */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders: number;
  /** Indicates the maximum data rate, in encoded pixels per second, that the camera can produce */
  maxEncodedPixelRate: number;
  /** Indicates the video sensor parameters for the camera */
  videoSensorParams: CameraAvStreamManagement.VideoSensorParams;
  /** Indicates the minimum resolution, in pixels, that the camera allows for its viewport */
  minViewportResolution: CameraAvStreamManagement.VideoResolution;
  /** Indicates the rate distortion trade-off points between resolution, frame rate and bitrate for each supported hardware encoder */
  rateDistortionTradeOffPoints: CameraAvStreamManagement.RateDistortionTradeOffPoints[];
  /** Indicates the current logical frame rate of the sensor in frames per second */
  currentFrameRate: number;
  /** Indicates the viewport to apply to all streams */
  viewport: Viewport;
  /** Indicates the amount of clockwise rotation, in degrees, that the image has been subjected to */
  imageRotation: number;
  /** Indicates whether the image has been flipped horizontally */
  imageFlipHorizontal: boolean;
  /** Indicates whether the image has been flipped vertically */
  imageFlipVertical: boolean;
}

/**
 * Creates a default CameraAvStreamManagement cluster server, with the Video and ImageControl features enabled, on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {CameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultCameraAvStreamManagementClusterServer(endpoint: MatterbridgeEndpoint, options: CameraAvStreamManagementClusterOptions): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeVideoCameraAvStreamManagementServerImpl, {
    ...options,
    hardPrivacyModeOn: false,
    statusLightEnabled: false,
    statusLightBrightness: ThreeLevelAuto.Auto,
    allocatedVideoStreams: [],
  });
  return endpoint;
}

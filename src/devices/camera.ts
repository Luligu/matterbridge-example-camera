/**
 * @file src/devices/camera.ts
 * @description This file contains the Camera class.
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

// Matterbridge
import { camera, MatterbridgeEndpoint } from 'matterbridge';
import { CameraAvStreamManagement, Identify } from 'matterbridge/matter/clusters';
import { StreamUsage } from 'matterbridge/matter/types';
import type { Viewport } from 'matterbridge/matter/types';

import { createDefaultCameraAvStreamManagementClusterServer } from '../behaviors/videoCameraAvStreamManagementServer.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';

/**
 * Options for configuring a {@link Camera} instance.
 *
 * Only the CameraAvStreamManagement Video and ImageControl features, and the WebRtcTransportProvider cluster, are implemented:
 * the CameraAvStreamManagement Audio and Snapshot features, and the WebRtcTransportRequestor client cluster required by the
 * Matter specification for a fully compliant Camera device type, are not part of this example.
 */
export interface CameraOptions {
  /** Identify time in seconds */
  identifyTime?: number;
  /** Identify type */
  identifyType?: Identify.IdentifyType;

  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize?: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** Indicates the list of stream usages that are supported by the camera */
  supportedStreamUsages?: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities?: StreamUsage[];
  /** Indicates the maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders?: number;
  /** Indicates the maximum data rate, in encoded pixels per second, that the camera can produce */
  maxEncodedPixelRate?: number;
  /** Indicates the video sensor parameters for the camera */
  videoSensorParams?: CameraAvStreamManagement.VideoSensorParams;
  /** Indicates the minimum resolution, in pixels, that the camera allows for its viewport */
  minViewportResolution?: CameraAvStreamManagement.VideoResolution;
  /** Indicates the rate distortion trade-off points between resolution, frame rate and bitrate for each supported hardware encoder */
  rateDistortionTradeOffPoints?: CameraAvStreamManagement.RateDistortionTradeOffPoints[];
  /** Indicates the current logical frame rate of the sensor in frames per second */
  currentFrameRate?: number;
  /** Indicates the viewport to apply to all streams */
  viewport?: Viewport;
  /** Indicates the amount of clockwise rotation, in degrees, that the image has been subjected to */
  imageRotation?: number;
  /** Indicates whether the image has been flipped horizontally */
  imageFlipHorizontal?: boolean;
  /** Indicates whether the image has been flipped vertically */
  imageFlipVertical?: boolean;
}

/**
 * Matterbridge endpoint representing a camera device.
 */
export class Camera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Camera class.
   *
   * A Camera device provides interfaces for controlling and transporting captured media. This example only implements the
   * CameraAvStreamManagement cluster with the Video and ImageControl features enabled, and the WebRtcTransportProvider cluster.
   *
   * @param {string} name - The name of the camera.
   * @param {string} serial - The serial number of the camera.
   * @param {CameraOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *
   *  - maxContentBufferSize: 4194304 (4 MB)
   *  - maxNetworkBandwidth: 10000000 (10 Mbps)
   *  - supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording]
   *  - streamUsagePriorities: same as supportedStreamUsages
   *  - maxConcurrentEncoders: 1
   *  - maxEncodedPixelRate: 62208000 (1920x1080 @ 30 fps)
   *  - videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 }
   *  - minViewportResolution: { width: 640, height: 360 }
   *  - rateDistortionTradeOffPoints: [{ codec: VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1000000 }]
   *  - currentFrameRate: 30
   *  - viewport: { x1: 0, y1: 0, x2: sensorWidth, y2: sensorHeight }
   *  - imageRotation: 0
   *  - imageFlipHorizontal: false
   *  - imageFlipVertical: false
   *
   * @returns {Camera} The Camera instance.
   */
  constructor(name: string, serial: string, options: CameraOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      maxContentBufferSize = 4_194_304,
      maxNetworkBandwidth = 10_000_000,
      supportedStreamUsages = [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities = supportedStreamUsages,
      maxConcurrentEncoders = 1,
      maxEncodedPixelRate = 1920 * 1080 * 30,
      videoSensorParams = { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
      minViewportResolution = { width: 640, height: 360 },
      rateDistortionTradeOffPoints = [{ codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 }],
      currentFrameRate = 30,
      viewport = { x1: 0, y1: 0, x2: videoSensorParams.sensorWidth, y2: videoSensorParams.sensorHeight },
      imageRotation = 0,
      imageFlipHorizontal = false,
      imageFlipVertical = false,
    } = options;
    super([camera], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Camera');
    createDefaultCameraAvStreamManagementClusterServer(this, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      maxConcurrentEncoders,
      maxEncodedPixelRate,
      videoSensorParams,
      minViewportResolution,
      rateDistortionTradeOffPoints,
      currentFrameRate,
      viewport,
      imageRotation,
      imageFlipHorizontal,
      imageFlipVertical,
    });
    createDefaultWebRtcTransportProviderClusterServer(this);
    // Only the required server clusters are added: the WebRtcTransportRequestor client cluster required by the Camera
    // device type is not implemented by this example.
    this.addRequiredClusterServers();
  }
}

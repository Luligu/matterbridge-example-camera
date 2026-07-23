/**
 * @file src/devices/ptzCamera.ts
 * @description This file contains the PtzCamera class.
 * @author Ludovic BOUÉ
 * @created 2026-07-23
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
import { camera, MatterbridgeEndpoint, type MatterbridgeEndpointOptions, powerSource } from 'matterbridge';
import { CameraAvSettingsUserLevelManagement, CameraAvStreamManagement, Identify } from 'matterbridge/matter/clusters';
import { StreamUsage } from 'matterbridge/matter/types';
import type { Viewport } from 'matterbridge/matter/types';

import { MatterbridgeCameraAvSettingsUserLevelManagementServer } from '../behaviors/cameraAvSettingsUserLevelManagementServer.js';
import { addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';
import { createDefaultCameraAvStreamManagementClusterServer } from './camera.js';

/**
 * Options for configuring a {@link PtzCamera} instance.
 *
 * Same Camera AV Stream Management and WebRtcTransportProvider setup as the {@link Camera} device (see that class
 * for the caveats on the WebRtcTransportRequestor client), plus the CameraAvSettingsUserLevelManagement cluster with
 * the MechanicalPan, MechanicalTilt and MechanicalZoom features enabled.
 */
export interface PtzCameraOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

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
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the list of supported snapshot capabilities */
  snapshotCapabilities?: CameraAvStreamManagement.SnapshotCapabilities[];
  /** Indicates the list of allocated snapshot streams */
  allocatedSnapshotStreams?: CameraAvStreamManagement.SnapshotStream[];

  /** Indicates the minimum value for the mechanical pan, in angular degrees */
  panMin?: number;
  /** Indicates the maximum value for the mechanical pan, in angular degrees */
  panMax?: number;
  /** Indicates the minimum value for the mechanical tilt, in angular degrees */
  tiltMin?: number;
  /** Indicates the maximum value for the mechanical tilt, in angular degrees */
  tiltMax?: number;
  /** Indicates the maximum value for the mechanical zoom */
  zoomMax?: number;
  /** Indicates the initial mechanical pan, tilt and zoom position */
  mptzPosition?: CameraAvSettingsUserLevelManagement.Mptz;
}

/**
 * Matterbridge endpoint representing a camera device with mechanical Pan, Tilt and Zoom support.
 */
export class PtzCamera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the PtzCamera class.
   *
   * A PTZ Camera is a Camera device (same device type as {@link Camera}) that also implements the
   * CameraAvSettingsUserLevelManagement cluster with the MechanicalPan, MechanicalTilt and MechanicalZoom features
   * enabled, allowing a controller to move the camera to an absolute position (MPTZSetPosition) or by a relative
   * delta (MPTZRelativeMove). The MechanicalPresets and DigitalPtz features are not part of this example.
   *
   * @param {string} name - The name of the camera.
   * @param {string} serial - The serial number of the camera.
   * @param {PtzCameraOptions} [options] - Optional configuration values. Missing fields use defaults.
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
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - snapshotCapabilities: [{ resolution: 640x480 }, { resolution: 1280x720 }, { resolution: 1920x1080 }], each with maxFrameRate: 10, imageCodec: ImageCodec.Jpeg, requiresEncodedPixels: false
   *  - allocatedSnapshotStreams: []
   *
   *  - panMin: -170, panMax: 170 (angular degrees)
   *  - tiltMin: -20, tiltMax: 90 (angular degrees)
   *  - zoomMax: 10
   *  - mptzPosition: { pan: 0, tilt: 0, zoom: 1 }
   *
   * @returns {PtzCamera} The PtzCamera instance.
   */
  constructor(name: string, serial: string, options: PtzCameraOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
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
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      snapshotCapabilities = [
        { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      ],
      allocatedSnapshotStreams = [],
      panMin = -170,
      panMax = 170,
      tiltMin = -20,
      tiltMax = 90,
      zoomMax = 10,
      mptzPosition = { pan: 0, tilt: 0, zoom: 1 },
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [camera] : [camera, powerSource], { id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number, tagList, mode });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    switch (powerSourceType) {
      case 'Rechargeable':
        this.createDefaultPowerSourceRechargeableBatteryClusterServer();
        break;
      case 'Replaceable':
        this.createDefaultPowerSourceReplaceableBatteryClusterServer();
        break;
      case 'Battery':
        this.createDefaultPowerSourceBatteryClusterServer();
        break;
      case 'Wired':
        this.createDefaultPowerSourceWiredClusterServer();
        break;
      case 'None':
        break;
      // No default
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge PTZ Camera');
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
      microphoneCapabilities,
      snapshotCapabilities,
      allocatedSnapshotStreams,
    });
    createDefaultCameraAvSettingsUserLevelManagementClusterServer(this, { panMin, panMax, tiltMin, tiltMax, zoomMax, mptzPosition });
    createDefaultWebRtcTransportProviderClusterServer(this);
    addWebRtcTransportRequestorClient(this);
    this.addRequiredClusters();
  }
}

/**
 * Initial state accepted by {@link createDefaultCameraAvSettingsUserLevelManagementClusterServer}.
 */
export interface CameraAvSettingsUserLevelManagementClusterOptions {
  /** Indicates the minimum value for the mechanical pan, in angular degrees */
  panMin: number;
  /** Indicates the maximum value for the mechanical pan, in angular degrees */
  panMax: number;
  /** Indicates the minimum value for the mechanical tilt, in angular degrees */
  tiltMin: number;
  /** Indicates the maximum value for the mechanical tilt, in angular degrees */
  tiltMax: number;
  /** Indicates the maximum value for the mechanical zoom */
  zoomMax: number;
  /** Indicates the initial mechanical pan, tilt and zoom position */
  mptzPosition: CameraAvSettingsUserLevelManagement.Mptz;
}

/**
 * Creates a default CameraAvSettingsUserLevelManagement cluster server, with the MechanicalPan, MechanicalTilt and
 * MechanicalZoom features enabled, on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvSettingsUserLevelManagement cluster server on.
 * @param {CameraAvSettingsUserLevelManagementClusterOptions} options - The initial state of the CameraAvSettingsUserLevelManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvSettingsUserLevelManagement cluster server created.
 */
export function createDefaultCameraAvSettingsUserLevelManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: CameraAvSettingsUserLevelManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvSettingsUserLevelManagementServer.with(
      CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
    ),
    {
      ...options,
      movementState: CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle,
    },
  );
  return endpoint;
}

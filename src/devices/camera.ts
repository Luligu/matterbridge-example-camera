/**
 * @file src/devices/camera.ts
 * @description This file contains the Camera class.
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

// Matterbridge
import { camera, MatterbridgeEndpoint, powerSource } from 'matterbridge';
import { MatterbridgeBindingServer } from 'matterbridge/behaviors';
import { WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { CameraAvStreamManagement, Identify, WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
import { StreamUsage, ThreeLevelAuto } from 'matterbridge/matter/types';
import type { Viewport } from 'matterbridge/matter/types';

import { MatterbridgeCameraAvStreamManagementServer } from '../behaviors/cameraAvStreamManagementServer.js';
import { MatterbridgeWebRtcTransportProviderServer } from '../behaviors/webRtcTransportProviderServer.js';

/**
 * Options for configuring a {@link Camera} instance.
 *
 * The CameraAvStreamManagement Video, Audio, Snapshot and ImageControl features and the WebRtcTransportProvider cluster
 * are implemented; only the Answer/End invocations on the WebRtcTransportRequestor client (Offer invocation only is
 * implemented), required by the Matter specification for a fully compliant Camera device type, are not part of this example.
 */
export interface CameraOptions {
  /** Identify time in seconds */
  identifyTime?: number;
  /** Identify type */
  identifyType?: Identify.IdentifyType;
  /** Power source type */
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
}

/**
 * Matterbridge endpoint representing a camera device.
 */
export class Camera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Camera class.
   *
   * A Camera device provides interfaces for controlling and transporting captured media. This example only implements the
   * CameraAvStreamManagement cluster with the Video, Audio and ImageControl features enabled, and the WebRtcTransportProvider cluster.
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
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - snapshotCapabilities: [{ resolution: 640x480 }, { resolution: 1280x720 }, { resolution: 1920x1080 }], each with maxFrameRate: 10, imageCodec: ImageCodec.Jpeg, requiresEncodedPixels: false
   *  - allocatedSnapshotStreams: []
   *
   * @returns {Camera} The Camera instance.
   */
  constructor(name: string, serial: string, options: CameraOptions = {}) {
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
    } = options;
    super(powerSourceType === 'None' ? [camera] : [camera, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Chime');
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
      microphoneCapabilities,
      snapshotCapabilities,
      allocatedSnapshotStreams,
    });
    createDefaultWebRtcTransportProviderClusterServer(this);
    addWebRtcTransportRequestorClient(this);
    this.addRequiredClusters();
  }
}

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
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the list of supported snapshot capabilities */
  snapshotCapabilities: CameraAvStreamManagement.SnapshotCapabilities[];
  /** Indicates the list of allocated snapshot streams */
  allocatedSnapshotStreams: CameraAvStreamManagement.SnapshotStream[];
}

/**
 * Creates a default CameraAvStreamManagement cluster server, with the Video, Audio, Snapshot and ImageControl features
 * enabled, on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {CameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultCameraAvStreamManagementClusterServer(endpoint: MatterbridgeEndpoint, options: CameraAvStreamManagementClusterOptions): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvStreamManagementServer.with(
      CameraAvStreamManagement.Feature.Video,
      CameraAvStreamManagement.Feature.Audio,
      CameraAvStreamManagement.Feature.Snapshot,
      CameraAvStreamManagement.Feature.ImageControl,
    ),
    {
      ...options,
      hardPrivacyModeOn: false,
      statusLightEnabled: false,
      statusLightBrightness: ThreeLevelAuto.Auto,
      allocatedVideoStreams: [],
      allocatedAudioStreams: [],
      microphoneMuted: false,
      microphoneVolumeLevel: 128,
      microphoneMaxLevel: 254,
      microphoneMinLevel: 0,
      microphoneAgcEnabled: false,
      // TODO: open issue on matter.js cause it treats ICTL mandatory but is not so we add for now
      // CameraAvStreamManagement.Feature.ImageControl
      imageRotation: 0,
      imageFlipVertical: false,
      imageFlipHorizontal: false,
    },
  );
  return endpoint;
}

/**
 * Creates a default WebRtcTransportProvider cluster server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the WebRtcTransportProvider cluster server on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportProvider cluster server created.
 */
export function createDefaultWebRtcTransportProviderClusterServer(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeWebRtcTransportProviderServer, { currentSessions: [] });
  return endpoint;
}

/**
 * Registers the WebRtcTransportRequestor client cluster on the given endpoint, so MatterbridgeBindingServer can
 * resolve a bound requestor and {@link MatterbridgeWebRtcTransportProviderServer.solicitOffer} can invoke Offer on it.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to register the WebRtcTransportRequestor client cluster on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportRequestor client cluster registered.
 */
export function addWebRtcTransportRequestorClient(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeBindingServer, { clientList: [WebRtcTransportRequestor.id] });
  endpoint.type.clientClusters['webRtcTransportRequestor'] ??= WebRtcTransportRequestorClient;
  return endpoint;
}

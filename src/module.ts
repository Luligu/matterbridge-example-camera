/**
 * @file src/module.ts
 * @description This file contains the class ExampleMatterbridgeCameraPlatform.
 * @author Luca Liguori
 * @created 2026-01-27
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

// Side effect import: works around https://github.com/matter-js/matter.js/issues/4083 until it is fixed upstream.
// oxlint-disable-next-line import/no-unassigned-import
import './patches/objectSchemaInjectFieldFix.js';

import { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { Identify, Chime as ChimeCluster, PowerSource } from 'matterbridge/matter/clusters';

import { AudioDoorbell } from './devices/audioDoorbell.js';
import { Camera } from './devices/camera.js';
import { Chime } from './devices/chime.js';
import { Doorbell } from './devices/doorbell.js';
import { SnapshotCamera } from './devices/snapshotCamera.js';

export type CameraPlatformConfig = PlatformConfig & {
  whiteList: string[];
  blackList: string[];
  animationInterval: number;
};

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {ExampleMatterbridgeCameraPlatform} - An instance of the ExampleMatterbridgeCameraPlatform. This is the main interface for interacting with the camera example plugin.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: CameraPlatformConfig): ExampleMatterbridgeCameraPlatform {
  return new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
}

export class ExampleMatterbridgeCameraPlatform extends MatterbridgeDynamicPlatform {
  animationPhase: number = 0;
  animationInterval: NodeJS.Timeout | undefined;

  constructor(
    matterbridge: PlatformMatterbridge,
    log: AnsiLogger,
    override config: CameraPlatformConfig,
  ) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.10.0')) {
      throw new Error(`This plugin requires Matterbridge version >= "3.10.0". Please update Matterbridge to the latest version in the frontend.`);
    }

    this.log.info(`Initializing platform ${this.config.name}...`);

    this.log.info(`Platform ${this.config.name} initialized successfully`);
  }

  override async onStart(reason?: string): Promise<void> {
    this.log.info(`Starting platform ${this.config.name} with reason: ${reason ?? 'No reason provided'}...`);

    const exampleChime = new Chime('Chime', 'CHIME-001', {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.AudibleBeep,
      powerSourceType: 'Replaceable',
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
        { chimeId: 2, name: 'Chime 2' },
      ],
      selectedChime: 0,
      enabled: true,
    });
    await this.registerDevice(exampleChime);

    const exampleDoorbell = new Doorbell('Doorbell', 'DOORBELL-001', {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.VisibleIndicator,
      powerSourceType: 'Replaceable',
    });
    await this.registerDevice(exampleDoorbell);

    const exampleAudioDoorbell = new AudioDoorbell('Audio Doorbell', 'AUDIODOORBELL-001', {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.VisibleIndicator,
      powerSourceType: 'Replaceable',
    });
    await this.registerDevice(exampleAudioDoorbell);

    const exampleSnapshotCamera = new SnapshotCamera('Snapshot Camera', 'SNAPSHOTCAMERA-001', {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.VisibleIndicator,
      powerSourceType: 'Wired',
    });
    await this.registerDevice(exampleSnapshotCamera);

    const exampleCamera = new Camera('Camera', 'CAMERA-001');
    await this.registerDevice(exampleCamera);

    const serverChime = new Chime('Server Chime', 'SERVER-CHIME-001', { mode: 'server' });
    await this.registerDevice(serverChime);

    const serverDoorbell = new Doorbell('Server Doorbell', 'SERVER-DOORBELL-001', { mode: 'server' });
    await this.registerDevice(serverDoorbell);

    this.log.info(`Platform ${this.config.name} started successfully`);
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.info(`Configuring platform ${this.config.name}...`);

    const exampleChime: Chime | undefined = this.getDeviceById('Chime-CHIME-001');
    if (!exampleChime) throw new Error(`Chime device not found. Please ensure the device is registered before configuration.`);
    await exampleChime.setCluster(
      PowerSource,
      { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 150, batQuantity: 2, batReplacementDescription: 'AA' },
      exampleChime.log,
    );
    await exampleChime.setAttribute(ChimeCluster, 'enabled', true, exampleChime.log);

    const exampleDoorbell: Doorbell | undefined = this.getDeviceById('Doorbell-DOORBELL-001');
    if (!exampleDoorbell) throw new Error(`Doorbell device not found. Please ensure the device is registered before configuration.`);

    const exampleAudioDoorbell: AudioDoorbell | undefined = this.getDeviceById('AudioDoorbell-AUDIODOORBELL-001');
    if (!exampleAudioDoorbell) throw new Error(`Audio doorbell device not found. Please ensure the device is registered before configuration.`);

    const exampleSnapshotCamera: SnapshotCamera | undefined = this.getDeviceById('SnapshotCamera-SNAPSHOTCAMERA-001');
    if (!exampleSnapshotCamera) throw new Error(`Snapshot camera device not found. Please ensure the device is registered before configuration.`);

    const exampleCamera: Camera | undefined = this.getDeviceById('Camera-CAMERA-001');
    if (!exampleCamera) throw new Error(`Camera device not found. Please ensure the device is registered before configuration.`);

    if (this.config.animationInterval > 0) {
      clearInterval(this.animationInterval);
      this.animationInterval = setInterval(() => void this.animationHandler(), this.config.animationInterval * 1000);
    }

    this.log.info(`Platform ${this.config.name} configured successfully`);
  }

  /** Handles the animation logic for the platform.
   * This method is called at regular intervals defined by the animationInterval configuration.
   *
   * @returns {Promise<void>} A promise that resolves when the animation handling is complete.
   */
  // oxlint-disable-next-line typescript/require-await
  async animationHandler(): Promise<void> {
    this.animationPhase = this.animationPhase + 1;
    this.animationPhase = this.animationPhase > 10 ? 0 : this.animationPhase;
    this.log.info(`Platform ${this.config.name} animation phase: ${this.animationPhase}`);

    /*
    const exampleChime: Chime | undefined = this.getDeviceById('Chime-CHIME-001');
    const exampleDoorbell: Doorbell | undefined = this.getDeviceById('Doorbell-DOORBELL-001');
    const exampleAudioDoorbell: AudioDoorbell | undefined = this.getDeviceById('AudioDoorbell-AUDIODOORBELL-001');
    const exampleSnapshotCamera: SnapshotCamera | undefined = this.getDeviceById('SnapshotCamera-SNAPSHOTCAMERA-001');
    const exampleCamera: Camera | undefined = this.getDeviceById('Camera-CAMERA-001');
    */
  }

  override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    this.log.info(`Shutting down platform ${this.config.name} with reason: ${reason ?? 'No reason provided'}...`);

    clearInterval(this.animationInterval);
    this.animationInterval = undefined;

    if (this.config.unregisterOnShutdown) await this.unregisterAllDevices();

    this.log.info(`Platform ${this.config.name} shut down successfully`);
  }
}

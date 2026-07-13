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

import { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { Identify, Chime as ChimeCluster, PowerSource } from 'matterbridge/matter/clusters';

import { Camera } from './devices/camera.js';
import { Chime } from './devices/chime.js';
import { SnapshotCamera } from './devices/snapshotCamera.js';

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {ExampleMatterbridgeCameraPlatform} - An instance of the ExampleMatterbridgeCameraPlatform. This is the main interface for interacting with the camera example plugin.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): ExampleMatterbridgeCameraPlatform {
  return new ExampleMatterbridgeCameraPlatform(matterbridge, log, config);
}

export class ExampleMatterbridgeCameraPlatform extends MatterbridgeDynamicPlatform {
  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.9.0')) {
      throw new Error(`This plugin requires Matterbridge version >= "3.9.0". Please update Matterbridge to the latest version in the frontend.`);
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

    const exampleSnapshotCamera = new SnapshotCamera('Snapshot Camera', 'CAMERA-001', {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.VisibleIndicator,
      powerSourceType: 'Wired',
    });
    await this.registerDevice(exampleSnapshotCamera);

    const exampleCamera = new Camera('Camera', 'CAMERA-001');
    await this.registerDevice(exampleCamera);

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

    const exampleSnapshotCamera: SnapshotCamera | undefined = this.getDeviceById('SnapshotCamera-CAMERA-001');
    if (!exampleSnapshotCamera) throw new Error(`Snapshot camera device not found. Please ensure the device is registered before configuration.`);

    this.log.info(`Platform ${this.config.name} configured successfully`);
  }

  override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    this.log.info(`Shutting down platform ${this.config.name} with reason: ${reason ?? 'No reason provided'}...`);

    if (this.config.unregisterOnShutdown) await this.unregisterAllDevices();

    this.log.info(`Platform ${this.config.name} shut down successfully`);
  }
}

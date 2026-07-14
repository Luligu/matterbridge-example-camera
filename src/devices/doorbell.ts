/**
 * @file src/devices/doorbell.ts
 * @description This file contains the Doorbell class.
 * @author Ludovic BOUÉ
 * @created 2026-07-14
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
import { doorbell, MatterbridgeEndpoint, powerSource } from 'matterbridge';
import { Identify } from 'matterbridge/matter/clusters';

/**
 * Options for configuring a {@link Doorbell} instance.
 */
export interface DoorbellOptions {
  /** Identify time in seconds */
  identifyTime?: number;
  /** Identify type. The Identify cluster is always created because it is a required server cluster for the Doorbell device type. */
  identifyType?: Identify.IdentifyType;
  /** Power source type */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';
}

/**
 * Matterbridge endpoint representing a doorbell device.
 * Matter specs 1.6.0 chapter 16.9.
 */
export class Doorbell extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Doorbell class.
   *
   * A Doorbell device is a switch which when pressed usually causes a Chime to activate. The Switch cluster
   * is created with the MomentarySwitch feature only, as required by the Matter specification for this device
   * type, and the required Chime client cluster is added automatically by addRequiredClusters().
   *
   * @param {string} name - The name of the doorbell.
   * @param {string} serial - The serial number of the doorbell.
   * @param {DoorbellOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   * @returns {Doorbell} The Doorbell instance.
   */
  constructor(name: string, serial: string, options: DoorbellOptions = {}) {
    const { identifyTime = 0, identifyType = Identify.IdentifyType.None, powerSourceType = 'Wired' } = options;
    super(powerSourceType === 'None' ? [doorbell] : [doorbell, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Doorbell');
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
    this.createDefaultMomentarySwitchClusterServer();
    this.addRequiredClusters();
  }
}

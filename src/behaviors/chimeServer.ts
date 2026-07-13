/**
 * @file packages/core/src/behaviors/chimeServer.ts
 * @description This file contains the MatterbridgeChimeServer class of Matterbridge.
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

import { MatterbridgeServer } from 'matterbridge/behaviors';
import { ChimeServer } from 'matterbridge/matter/behaviors';
import type { Chime } from 'matterbridge/matter/clusters';

/**
 * Chime server that forwards the PlayChimeSound command to the Matterbridge command handler and generates the ChimeStartedPlaying event.
 */
export class MatterbridgeChimeServer extends ChimeServer {
  /**
   * Handles the PlayChimeSound command.
   * Plays the chime sound passed in the request or, if none is passed, the currently selected chime, and generates the ChimeStartedPlaying event.
   *
   * @param {Chime.PlayChimeSoundRequest} request - PlayChimeSound request payload.
   */
  // oxlint-disable-next-line typescript/require-await
  override async playChimeSound(request: Chime.PlayChimeSoundRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const chimeId = request.chimeId ?? this.state.selectedChime;
    device.log.info(`Playing chime sound ${chimeId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // TODO: Add Chime.playChimeSound in matterbridge
    /*
    await device.commandHandler.executeHandler('Chime.playChimeSound', {
      command: 'playChimeSound',
      request,
      cluster: ChimeServer.id,
      attributes: this.state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    */
    device.log.debug(`MatterbridgeChimeServer: playChimeSound called with chimeId ${chimeId}`);
    // ChimeStartedPlaying is provisional in the Matter spec, so matter.js does not instantiate an emitter for it; guard against that.
    this.events.chimeStartedPlaying?.emit({ chimeId }, this.context);
  }
}

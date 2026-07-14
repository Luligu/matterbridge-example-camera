/**
 * @file src/behaviors/webRtcTransportProviderServer.ts
 * @description This file contains the MatterbridgeWebRtcTransportProviderServer class of Matterbridge.
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

import { MatterbridgeBindingServer, MatterbridgeServer } from 'matterbridge/behaviors';
import { WebRtcTransportProviderServer, WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import { WebRtcTransportRequestor } from 'matterbridge/matter/clusters';
import type { WebRtcTransportProvider } from 'matterbridge/matter/clusters';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage, Status, StatusResponseError } from 'matterbridge/matter/types';

/**
 * Placeholder SDP offer sent to a bound WebRtcTransportRequestor after SolicitOffer. This implementation has no real
 * WebRTC peer connection to generate an actual offer from; the session is signaling-only (see the class doc comment).
 */
const MOCK_SDP_OFFER = 'v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n';

/**
 * The subset of a remote command context's session used by {@link MatterbridgeWebRtcTransportProviderServer.#getPeerInfo}.
 */
interface RemoteActorSessionContext {
  session?: {
    peerNodeId?: NodeId;
    fabric?: { fabricIndex: FabricIndex };
  };
}

/**
 * WebRtcTransportProvider server that tracks WebRTC session bookkeeping (SolicitOffer, ProvideOffer, ProvideAnswer,
 * ProvideIceCandidates, EndSession) in the CurrentSessions attribute.
 *
 * This is a signaling-only mock implementation: it records session state and logs the received SDP offers/answers and
 * ICE candidates, but does not establish a real WebRTC peer connection (no media negotiation, STUN/TURN, or RTP flow).
 * SolicitOffer invokes Offer (with a placeholder SDP) on a bound WebRtcTransportRequestor client, if one is bound;
 * otherwise the Offer is silently skipped. ProvideOffer, in contrast, never invokes Answer on the requestor that sent
 * it — completing that side of the Offer/Answer flow is not implemented.
 *
 * Known upstream limitation: matter.js's fabric-index injection for fabric-scoped command invokes
 * (CommandInvokeResponse#decodeWithSchema) recurses into every nested struct field of the request when decoding, including
 * optional ones like SolicitOfferRequest/ProvideOfferRequest's `sFrameConfig`. When a real client omits `sFrameConfig`
 * (the common case, since SFrame E2E encryption is optional), `ObjectSchema.injectField` crashes trying to read a field
 * off that `undefined` value, before this behavior's command handlers ever run. This is a matter.js bug, not something
 * fixable from this plugin; it needs a fix upstream (or an updated matter.js version pulled in by matterbridge core).
 */
export class MatterbridgeWebRtcTransportProviderServer extends WebRtcTransportProviderServer {
  /**
   * Reads the accessing peer's node id and fabric index off the current command context.
   *
   * Not all commands are necessarily invoked by a remote actor (e.g. the test harness), so `this.context` is read
   * defensively via a narrow structural cast instead of matter.js's own `hasRemoteActor` type guard, which lives in the
   * matter.js protocol package and is not reliably resolvable as a direct dependency of this plugin.
   *
   * @returns {{ peerNodeId: NodeId; fabricIndex: FabricIndex }} The peer node id and fabric index, or fallback values if the command was not invoked by a remote actor.
   */
  #getPeerInfo(): { peerNodeId: NodeId; fabricIndex: FabricIndex } {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see this method's doc comment above.
    const session = (this.context as unknown as RemoteActorSessionContext).session;
    return {
      peerNodeId: session?.peerNodeId ?? NodeId(0),
      // WebRtcSession is fabric-scoped data: FabricIndex.NO_FABRIC (0) is rejected by the schema for list entries, so fall
      // back to the first valid fabric index instead.
      fabricIndex: session?.fabric?.fabricIndex ?? FabricIndex(1),
    };
  }

  /**
   * Resolves the effective video/audio stream lists for a SolicitOffer/ProvideOffer request, folding the deprecated
   * cluster revision 1 `videoStreamId`/`audioStreamId` fields into the `videoStreams`/`audioStreams` lists when the
   * modern list fields are not provided, per the Matter specification's backwards-compatibility rules.
   *
   * @param {{ videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant fields of the SolicitOffer/ProvideOffer request.
   * @returns {{ videoStreams?: number[]; audioStreams?: number[] }} The resolved stream lists.
   */
  #resolveStreamLists(request: { videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }): {
    videoStreams?: number[];
    audioStreams?: number[];
  } {
    return {
      videoStreams: request.videoStreams ?? (request.videoStreamId !== undefined && request.videoStreamId !== null ? [request.videoStreamId] : undefined),
      audioStreams: request.audioStreams ?? (request.audioStreamId !== undefined && request.audioStreamId !== null ? [request.audioStreamId] : undefined),
    };
  }

  /**
   * Handles the SolicitOffer command.
   * Records a new WebRTC session and, if a WebRtcTransportRequestor is bound to this endpoint, invokes Offer on it
   * with a placeholder SDP (see {@link MOCK_SDP_OFFER}). If no requestor is bound yet, the Offer is silently skipped;
   * this implementation has no mechanism to send it later once a binding is established.
   *
   * @param {WebRtcTransportProvider.SolicitOfferRequest} request - SolicitOffer request payload.
   * @returns {Promise<WebRtcTransportProvider.SolicitOfferResponse>} The newly allocated session identifier, with deferredOffer set to true.
   * @throws {StatusResponseError} With status ConstraintError if neither videoStreams nor audioStreams is provided; automatic stream assignment is not implemented.
   */
  override async solicitOffer(request: WebRtcTransportProvider.SolicitOfferRequest): Promise<WebRtcTransportProvider.SolicitOfferResponse> {
    const { videoStreams, audioStreams } = this.#resolveStreamLists(request);
    if (!videoStreams?.length && !audioStreams?.length) {
      throw new StatusResponseError('solicitOffer requires at least one of videoStreams or audioStreams; automatic stream assignment is not implemented', Status.ConstraintError);
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    let webRtcSessionId = 0;
    for (const session of this.state.currentSessions) {
      webRtcSessionId = Math.max(webRtcSessionId, session.id + 1);
    }
    const { peerNodeId, fabricIndex } = this.#getPeerInfo();
    this.state.currentSessions = [
      ...this.state.currentSessions,
      {
        id: webRtcSessionId,
        peerNodeId,
        peerEndpointId: request.originatingEndpointId,
        streamUsage: request.streamUsage,
        metadataEnabled: request.metadataEnabled ?? false,
        videoStreams,
        audioStreams,
        fabricIndex,
      },
    ];
    device.log.info(
      `Solicited a WebRTC offer for session ${webRtcSessionId} (stream usage ${request.streamUsage}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    const requestorEndpoint = this.endpoint.behaviors.has(MatterbridgeBindingServer)
      ? this.agent.get(MatterbridgeBindingServer).getEndpoint(WebRtcTransportRequestor.id)
      : undefined;
    /* v8 ignore next 3 -- requires a real established Matter binding to a WebRtcTransportRequestor peer, which this
     * project's vitest harness has no infrastructure to set up (no binding test helpers exist). */
    if (requestorEndpoint) {
      await requestorEndpoint.act((agent) => agent.get(WebRtcTransportRequestorClient).offer({ webRtcSessionId, sdp: MOCK_SDP_OFFER }));
      device.log.info(`Invoked Offer on the bound WebRtcTransportRequestor for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    } else {
      device.log.info(
        `No WebRtcTransportRequestor is bound yet; the Offer for session ${webRtcSessionId} was not sent (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    return { webRtcSessionId, deferredOffer: true };
  }

  /**
   * Handles the ProvideOffer command.
   * Records the SDP offer against a new or existing session.
   *
   * @param {WebRtcTransportProvider.ProvideOfferRequest} request - ProvideOffer request payload.
   * @returns {WebRtcTransportProvider.ProvideOfferResponse} The session identifier the offer was recorded against.
   * @throws {StatusResponseError} With status NotFound if a non-null webRtcSessionId is not present in currentSessions.
   * @throws {StatusResponseError} With status ConstraintError if webRtcSessionId is null and neither videoStreams nor audioStreams is provided; automatic stream assignment is not implemented.
   */
  override provideOffer(request: WebRtcTransportProvider.ProvideOfferRequest): WebRtcTransportProvider.ProvideOfferResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    let webRtcSessionId = request.webRtcSessionId;
    if (webRtcSessionId === null) {
      const { videoStreams, audioStreams } = this.#resolveStreamLists(request);
      if (!videoStreams?.length && !audioStreams?.length) {
        throw new StatusResponseError('provideOffer requires at least one of videoStreams or audioStreams; automatic stream assignment is not implemented', Status.ConstraintError);
      }
      webRtcSessionId = 0;
      for (const session of this.state.currentSessions) {
        webRtcSessionId = Math.max(webRtcSessionId, session.id + 1);
      }
      const { peerNodeId, fabricIndex } = this.#getPeerInfo();
      this.state.currentSessions = [
        ...this.state.currentSessions,
        {
          id: webRtcSessionId,
          peerNodeId,
          peerEndpointId: request.originatingEndpointId ?? EndpointNumber(0),
          streamUsage: request.streamUsage ?? StreamUsage.LiveView,
          metadataEnabled: request.metadataEnabled ?? false,
          videoStreams,
          audioStreams,
          fabricIndex,
        },
      ];
    } else if (!this.state.currentSessions.some((session) => session.id === webRtcSessionId)) {
      throw new StatusResponseError(`WebRTC session ${webRtcSessionId} is not present in currentSessions`, Status.NotFound);
    }
    device.log.info(`Received an SDP offer for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer: received SDP offer for session ${webRtcSessionId}: ${request.sdp}`);
    return { webRtcSessionId };
  }

  /**
   * Handles the ProvideAnswer command.
   * Records the SDP answer received in response to a previously sent offer.
   *
   * @param {WebRtcTransportProvider.ProvideAnswerRequest} request - ProvideAnswer request payload.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override provideAnswer(request: WebRtcTransportProvider.ProvideAnswerRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(`WebRTC session ${request.webRtcSessionId} is not present in currentSessions`, Status.NotFound);
    }
    device.log.info(`Received an SDP answer for session ${request.webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer: received SDP answer for session ${request.webRtcSessionId}: ${request.sdp}`);
  }

  /**
   * Handles the ProvideIceCandidates command.
   * Records the ICE candidates gathered for a session.
   *
   * @param {WebRtcTransportProvider.ProvideIceCandidatesRequest} request - ProvideIceCandidates request payload.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override provideIceCandidates(request: WebRtcTransportProvider.ProvideIceCandidatesRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(`WebRTC session ${request.webRtcSessionId} is not present in currentSessions`, Status.NotFound);
    }
    device.log.info(
      `Received ${request.iceCandidates.length} ICE candidate(s) for session ${request.webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles the EndSession command.
   * Removes the session from currentSessions.
   *
   * @param {WebRtcTransportProvider.EndSessionRequest} request - EndSession request payload.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override endSession(request: WebRtcTransportProvider.EndSessionRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(`WebRTC session ${request.webRtcSessionId} is not present in currentSessions`, Status.NotFound);
    }
    this.state.currentSessions = this.state.currentSessions.filter((session) => session.id !== request.webRtcSessionId);
    device.log.info(`Ended WebRTC session ${request.webRtcSessionId} (reason ${request.reason}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }
}

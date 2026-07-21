/**
 * @file src/behaviors/webRtcTransportProviderServer.ts
 * @description This file contains the MatterbridgeWebRtcTransportProviderServer class of Matterbridge.
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

import type { MatterbridgeEndpoint } from 'matterbridge';
import { MatterbridgeServer } from 'matterbridge/behaviors';
import type { Endpoint, ServerNode } from 'matterbridge/matter';
import { Node } from 'matterbridge/matter';
import { WebRtcTransportProviderServer, WebRtcTransportRequestorClient } from 'matterbridge/matter/behaviors';
import type { WebRtcTransportProvider } from 'matterbridge/matter/clusters';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage, Status, StatusResponseError } from 'matterbridge/matter/types';

import { WeriftWebRtcSession } from '../webrtc/weriftSession.js';
import { MatterbridgeCameraAvStreamManagementServer } from './cameraAvStreamManagementServer.js';

/**
 * Delay before firing a deferred Offer/Answer invoke on the peer's WebRtcTransportRequestor (see
 * {@link MatterbridgeWebRtcTransportProviderServer.#invokeDeferred}). The peer needs to receive and process our own
 * SolicitOffer/ProvideOffer response first, since that response is what tells it the session id this invoke is for;
 * without this delay, an invoke to a peer with an already-established Matter session can outrace our own response.
 */
const DEFERRED_INVOKE_DELAY_MS = 250;

/**
 * Per-candidate timeout for {@link MatterbridgeWebRtcTransportProviderServer.provideIceCandidates}. mDNS host
 * candidates (`*.local`) are resolved by werift-ice via a real multicast DNS query before being applied (see the
 * method's doc comment), so this must leave enough headroom for a multicast round trip on the LAN in addition to
 * the candidate application itself, while still failing well before werift-ice's own 10s internal mDNS timeout so
 * a candidate that truly can't be resolved (e.g. no multicast routing between subnets) is reported promptly.
 */
const ICE_CANDIDATE_APPLY_TIMEOUT_MS = 5000;

/** Highest WebRTC session identifier allocated before the Matter-mandated wrap to zero. */
const MAX_WEB_RTC_SESSION_ID = 0xfffe;

/**
 * Allocates a WebRTC session identifier according to the Matter specification.
 *
 * Identifiers start at zero, increase monotonically for every new allocation, wrap after 65534, and skip any
 * identifier that is still active.
 *
 * @param {number} nextCandidate - The next monotonically increasing identifier candidate.
 * @param {ReadonlySet<number>} activeSessionIds - Identifiers belonging to active sessions.
 * @returns {{ webRtcSessionId: number; nextCandidate: number }} The allocated identifier and the following candidate.
 * @throws {StatusResponseError} With status ResourceExhausted if every allocatable identifier is active.
 */
export function allocateWebRtcSessionId(nextCandidate: number, activeSessionIds: ReadonlySet<number>): { webRtcSessionId: number; nextCandidate: number } {
  const firstCandidate = nextCandidate;
  let candidate = firstCandidate;

  do {
    const followingCandidate = candidate === MAX_WEB_RTC_SESSION_ID ? 0 : candidate + 1;
    if (!activeSessionIds.has(candidate)) return { webRtcSessionId: candidate, nextCandidate: followingCandidate };
    candidate = followingCandidate;
  } while (candidate !== firstCandidate);

  throw new StatusResponseError('No WebRTC session identifier is available', Status.ResourceExhausted);
}

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
 * Each session is backed by a real werift RTCPeerConnection (see {@link WeriftWebRtcSession}). WebRtcTransportProvider
 * and WebRtcTransportRequestor address each other directly using the peer node id captured from the incoming
 * request's session (comparable to the OTA Provider/Requestor cluster pair) — see
 * {@link #resolvePeerRequestorEndpoint} — rather than via the Binding cluster:
 * - SolicitOffer creates the session's peer connection and invokes Offer, with a real generated SDP offer, on the
 *   peer's WebRtcTransportRequestor, if it can be reached; otherwise the Offer is silently skipped.
 * - ProvideOffer applies the received SDP offer to the session's peer connection (creating one first for a new
 *   session) and invokes Answer, with the real generated SDP answer, on the peer's WebRtcTransportRequestor, if it
 *   can be reached; otherwise the Answer is silently skipped.
 * - ProvideAnswer and ProvideIceCandidates apply the received SDP answer/ICE candidates to the session's peer
 *   connection, if one exists.
 * - EndSession closes the session's peer connection.
 *
 * This implementation has no mechanism to send a deferred Offer/Answer later once the peer becomes reachable after
 * the fact. The underlying WeriftWebRtcSession can inject a synthetic moving test pattern video track for end-to-end media
 * validation when video is negotiated.
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
   * Behaviors are ephemeral (matter.js constructs a new instance per Agent), so the werift peer connection wrappers
   * must live in `internal` state, which is backed by the endpoint rather than the instance, to survive from the
   * command that creates a session (SolicitOffer/ProvideOffer) to the later, separate commands that use it
   * (ProvideAnswer/ProvideIceCandidates/EndSession). A plain instance field would silently reset between them.
   */
  declare internal: MatterbridgeWebRtcTransportProviderServer.Internal;

  /**
   * Fires an outbound Offer/Answer invoke on the peer's WebRtcTransportRequestor without awaiting it.
   *
   * The peer must receive and process our own SolicitOffer/ProvideOffer response (which carries the session id it
   * needs to accept this invoke) before this invoke reaches it. Awaiting the invoke here, before returning our
   * response, would send it first and the peer would reject it as an unknown session.
   *
   * @param {() => void | PromiseLike<void>} action - Invokes the command on the peer's WebRtcTransportRequestor.
   * @param {string} description - Human-readable description of the invoke, for the error log on failure.
   */
  /* v8 ignore next 8 -- only reachable once a real peer WebRtcTransportRequestor can be reached; see the v8 ignore
   * comments at this method's call sites. */
  #invokeDeferred(action: () => void | PromiseLike<void>, description: string): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    setTimeout(() => {
      Promise.resolve(action()).catch((error: unknown) => {
        device.log.error(`Failed to invoke ${description} on the peer's WebRtcTransportRequestor: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, DEFERRED_INVOKE_DELAY_MS);
  }

  /**
   * Resolves the peer's WebRtcTransportRequestor client endpoint by connecting directly to the peer node that sent
   * the current request (identified by peerNodeId/fabricIndex from the incoming session, and peerEndpointId from
   * originatingEndpointId) — WebRtcTransportProvider/Requestor address each other this way, comparable to the OTA
   * Provider/Requestor cluster pair, and do not use the Binding cluster.
   *
   * @param {NodeId} peerNodeId - The peer's node id.
   * @param {FabricIndex} fabricIndex - The fabric shared with the peer.
   * @param {EndpointNumber} peerEndpointId - The peer's endpoint hosting WebRtcTransportRequestor.
   * @returns {Promise<Endpoint | undefined>} The peer's WebRtcTransportRequestor endpoint, or undefined if the peer
   * could not be reached (e.g. no real remote peer is connected, as in this project's vitest harness).
   */
  async #resolvePeerRequestorEndpoint(peerNodeId: NodeId, fabricIndex: FabricIndex, peerEndpointId: EndpointNumber): Promise<Endpoint | undefined> {
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- this endpoint always belongs to the Matterbridge server node.
      const serverNode = Node.forEndpoint(this.endpoint) as ServerNode;
      const peerNode = await serverNode.peers.forAddress({ nodeId: peerNodeId, fabricIndex });
      /* v8 ignore start -- requires a real commissioned fabric with a connectable peer node, which this project's
       * vitest harness has no infrastructure to set up (no remote peer test helpers exist). */
      const peerEndpoint = peerNode.endpoints.require(peerEndpointId);
      peerEndpoint.behaviors.require(WebRtcTransportRequestorClient);
      return peerEndpoint;
      /* v8 ignore stop */
    } catch (error) {
      this.endpoint
        .stateOf(MatterbridgeServer)
        .log.debug(
          `Could not resolve peer WebRtcTransportRequestor endpoint (peerNodeId=${peerNodeId}, fabricIndex=${fabricIndex}, peerEndpointId=${peerEndpointId}): ${error instanceof Error ? error.message : String(error)}`,
        );
      return undefined;
    }
  }

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
   * Allocates the next WebRTC session identifier according to the Matter specification.
   *
   * Identifiers start at zero, increase monotonically for every new allocation, wrap after 65534, and skip any
   * identifier that is still present in CurrentSessions.
   *
   * @returns {number} The next unique WebRTC session identifier.
   * @throws {StatusResponseError} With status ResourceExhausted if every allocatable identifier is active.
   */
  #allocateWebRtcSessionId(): number {
    const activeSessionIds = new Set(this.state.currentSessions.map((session) => session.id));
    const allocation = allocateWebRtcSessionId(this.internal.nextWebRtcSessionId, activeSessionIds);
    this.internal.nextWebRtcSessionId = allocation.nextCandidate;
    return allocation.webRtcSessionId;
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
   * Resolves the webcam capture resolution matching the client's requested video stream, from the endpoint's
   * CameraAvStreamManagement allocatedVideoStreams state, so a real client's stream/resolution selection (e.g. a
   * quality picker in its UI, which allocates a video stream with a given maxResolution before soliciting/providing
   * an offer) is reflected in the injected webcam capture.
   *
   * @param {number[]} [videoStreams] - The resolved videoStreams ids for the request (see {@link #resolveStreamLists}).
   * @returns {string | undefined} The "widthxheight" resolution of the first matching allocated video stream, or undefined if none is found.
   */
  #resolveVideoResolution(videoStreams?: number[]): string | undefined {
    const videoStreamId = videoStreams?.[0];
    if (videoStreamId === undefined) return undefined;
    if (!this.endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)) return undefined;
    const { allocatedVideoStreams } = this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer);
    const stream = allocatedVideoStreams.find((allocatedStream) => allocatedStream.videoStreamId === videoStreamId);
    if (!stream) return undefined;
    return `${stream.maxResolution.width}x${stream.maxResolution.height}`;
  }

  /**
   * Resolves the video/audio stream ids for a SolicitOffer/ProvideOffer request that omitted videoStreams and
   * audioStreams (and their deprecated single-id counterparts), per the Matter specification's automatic stream
   * selection for revision 1 clients (e.g. Home Assistant's Matter camera integration), which never allocates
   * streams explicitly and expects the camera to select or allocate them on its own.
   *
   * Reuses an already allocated stream matching the request's stream usage, falling back to the endpoint's first
   * allocated stream of that kind, and only allocates a new one, from the endpoint's CameraAvStreamManagement default
   * video/audio capabilities, when none exists yet.
   *
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @returns {Promise<{ videoStreams?: number[]; audioStreams?: number[] }>} The resolved video/audio stream id lists; a list is omitted if the endpoint has no CameraAvStreamManagement cluster or no allocatable stream of that kind.
   */
  async #autoAssignStreams(streamUsage: StreamUsage): Promise<{ videoStreams?: number[]; audioStreams?: number[] }> {
    if (!this.endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)) return {};
    const state = this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer);

    // Spread into plain arrays first: state's list attributes throw on out-of-bounds index access (e.g. `[0]` on an
    // empty list) instead of returning undefined like a normal JS array.
    const allocatedVideoStreams = [...state.allocatedVideoStreams];
    let videoStreamId = (allocatedVideoStreams.find((stream) => stream.streamUsage === streamUsage) ?? allocatedVideoStreams[0])?.videoStreamId;
    if (videoStreamId === undefined && state.rateDistortionTradeOffPoints.length > 0) {
      const [{ codec, resolution, minBitRate }] = state.rateDistortionTradeOffPoints;
      ({ videoStreamId } = await this.endpoint.act((agent) =>
        agent.get(MatterbridgeCameraAvStreamManagementServer).videoStreamAllocate({
          streamUsage,
          videoCodec: codec,
          minFrameRate: 1,
          maxFrameRate: state.videoSensorParams.maxFps,
          minResolution: state.minViewportResolution,
          maxResolution: resolution,
          minBitRate,
          maxBitRate: minBitRate,
          keyFrameInterval: 4000,
        }),
      ));
    }

    const allocatedAudioStreams = [...state.allocatedAudioStreams];
    let audioStreamId = (allocatedAudioStreams.find((stream) => stream.streamUsage === streamUsage) ?? allocatedAudioStreams[0])?.audioStreamId;
    if (audioStreamId === undefined && state.microphoneCapabilities.supportedCodecs.length > 0) {
      const { microphoneCapabilities } = state;
      ({ audioStreamId } = await this.endpoint.act((agent) =>
        agent.get(MatterbridgeCameraAvStreamManagementServer).audioStreamAllocate({
          streamUsage,
          audioCodec: microphoneCapabilities.supportedCodecs[0],
          channelCount: microphoneCapabilities.maxNumberOfChannels,
          sampleRate: microphoneCapabilities.supportedSampleRates[0],
          bitRate: 32_000,
          bitDepth: microphoneCapabilities.supportedBitDepths[0],
        }),
      ));
    }

    return {
      videoStreams: videoStreamId === undefined ? undefined : [videoStreamId],
      /* v8 ignore next -- microphoneCapabilities.supportedCodecs is schema-enforced to have at least 1 entry
       * whenever the Audio feature is present, and MatterbridgeCameraAvStreamManagementServer always enables Audio
       * (see its class declaration); audioStreamId can therefore never be undefined here. */
      audioStreams: audioStreamId === undefined ? undefined : [audioStreamId],
    };
  }

  /**
   * Builds the deprecated single-id `videoStreamId`/`audioStreamId` echo fields for a SolicitOfferResponse/ProvideOfferResponse.
   *
   * Per the Matter specification, their presence in the response is tied to the corresponding deprecated request field
   * (`videoStreamId`/`audioStreamId`) being present, regardless of whether the modern `videoStreams`/`audioStreams` list
   * was used instead: revision 1 clients (e.g. Home Assistant's Matter camera integration) send the deprecated field as
   * null to request automatic stream selection, and read the response's echoed id to learn which stream was selected.
   *
   * @param {{ videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant deprecated fields of the SolicitOffer/ProvideOffer request.
   * @param {number[]} [videoStreams] - The resolved videoStreams ids for the request (see {@link #resolveStreamLists}/{@link #autoAssignStreams}).
   * @param {number[]} [audioStreams] - The resolved audioStreams ids for the request (see {@link #resolveStreamLists}/{@link #autoAssignStreams}).
   * @returns {{ videoStreamId?: number | null; audioStreamId?: number | null }} The echo fields to include in the response; a field is omitted if the corresponding deprecated request field was not present.
   */
  #echoDeprecatedStreamIds(
    request: { videoStreamId?: number | null; audioStreamId?: number | null },
    videoStreams?: number[],
    audioStreams?: number[],
  ): { videoStreamId?: number | null; audioStreamId?: number | null } {
    return {
      videoStreamId: request.videoStreamId === undefined ? undefined : (videoStreams?.[0] ?? null),
      audioStreamId: request.audioStreamId === undefined ? undefined : (audioStreams?.[0] ?? null),
    };
  }

  /**
   * Handles the SolicitOffer command.
   * Creates a real werift peer connection for the new session (see {@link WeriftWebRtcSession}) and, if a
   * WebRtcTransportRequestor is bound to this endpoint, invokes Offer on it with the SDP offer generated by that
   * peer connection. If no requestor is bound yet, the Offer is silently skipped; this implementation has no
   * mechanism to send it later once a binding is established.
   *
   * @param {WebRtcTransportProvider.SolicitOfferRequest} request - SolicitOffer request payload.
   * @returns {Promise<WebRtcTransportProvider.SolicitOfferResponse>} The newly allocated session identifier, with deferredOffer set to true.
   * @throws {StatusResponseError} With status ConstraintError if neither videoStreams nor audioStreams is provided or automatically assignable (see {@link #autoAssignStreams}).
   */
  override async solicitOffer(request: WebRtcTransportProvider.SolicitOfferRequest): Promise<WebRtcTransportProvider.SolicitOfferResponse> {
    let { videoStreams, audioStreams } = this.#resolveStreamLists(request);
    if (!videoStreams?.length && !audioStreams?.length) {
      ({ videoStreams, audioStreams } = await this.#autoAssignStreams(request.streamUsage));
    }
    if (!videoStreams?.length && !audioStreams?.length) {
      throw new StatusResponseError(
        'MatterbridgeWebRtcTransportProviderServer.solicitOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
        Status.ConstraintError,
      );
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const webRtcSessionId = this.#allocateWebRtcSessionId();
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
      `MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session ${webRtcSessionId} (stream usage ${request.streamUsage}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    const webRtcPeer = new WeriftWebRtcSession(webRtcSessionId);
    this.internal.sessions.set(webRtcSessionId, webRtcPeer);
    const sdp = await webRtcPeer.createOffer({ video: !!videoStreams?.length, audio: !!audioStreams?.length, videoResolution: this.#resolveVideoResolution(videoStreams) });

    const requestorEndpoint = await this.#resolvePeerRequestorEndpoint(peerNodeId, fabricIndex, request.originatingEndpointId);
    /* v8 ignore next 6 -- requires a real connectable peer node, which this project's vitest harness has no
     * infrastructure to set up (no remote peer test helpers exist). */
    if (requestorEndpoint) {
      this.#invokeDeferred(async () => requestorEndpoint.commandsOf(WebRtcTransportRequestorClient).offer({ webRtcSessionId, sdp }), `Offer for session ${webRtcSessionId}`);
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.solicitOffer: invoking Offer on the peer's WebRtcTransportRequestor for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    } else {
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor; the Offer for session ${webRtcSessionId} was not sent (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    return { webRtcSessionId, deferredOffer: true, ...this.#echoDeprecatedStreamIds(request, videoStreams, audioStreams) };
  }

  /**
   * Handles the ProvideOffer command.
   * Records the SDP offer against a new or existing session, applies it to that session's real werift peer
   * connection (see {@link WeriftWebRtcSession}), and, if a WebRtcTransportRequestor is bound to this endpoint,
   * invokes Answer on it with the SDP answer generated by that peer connection. If no requestor is bound yet, the
   * Answer is silently skipped; this implementation has no mechanism to send it later once a binding is established.
   *
   * @param {WebRtcTransportProvider.ProvideOfferRequest} request - ProvideOffer request payload.
   * @returns {Promise<WebRtcTransportProvider.ProvideOfferResponse>} The session identifier the offer was recorded against.
   * @throws {StatusResponseError} With status NotFound if a non-null webRtcSessionId is not present in currentSessions.
   * @throws {StatusResponseError} With status ConstraintError if webRtcSessionId is null and neither videoStreams nor audioStreams is provided or automatically assignable (see {@link #autoAssignStreams}).
   */
  override async provideOffer(request: WebRtcTransportProvider.ProvideOfferRequest): Promise<WebRtcTransportProvider.ProvideOfferResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    let webRtcSessionId = request.webRtcSessionId;
    if (webRtcSessionId === null) {
      let { videoStreams, audioStreams } = this.#resolveStreamLists(request);
      if (!videoStreams?.length && !audioStreams?.length) {
        ({ videoStreams, audioStreams } = await this.#autoAssignStreams(request.streamUsage ?? StreamUsage.LiveView));
      }
      if (!videoStreams?.length && !audioStreams?.length) {
        throw new StatusResponseError(
          'MatterbridgeWebRtcTransportProviderServer.provideOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
          Status.ConstraintError,
        );
      }
      webRtcSessionId = this.#allocateWebRtcSessionId();
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
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${webRtcSessionId}:\n${request.sdp}`);

    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was just created or found above.
    const session = this.state.currentSessions.find((s) => s.id === webRtcSessionId)!;
    const webRtcPeer = this.internal.sessions.get(webRtcSessionId) ?? new WeriftWebRtcSession(webRtcSessionId);
    this.internal.sessions.set(webRtcSessionId, webRtcPeer);
    const sdp = await webRtcPeer.createAnswer(request.sdp, this.#resolveVideoResolution(session.videoStreams));

    const requestorEndpoint = await this.#resolvePeerRequestorEndpoint(session.peerNodeId, session.fabricIndex, session.peerEndpointId);
    /* v8 ignore next 6 -- requires a real connectable peer node, which this project's vitest harness has no
     * infrastructure to set up (no remote peer test helpers exist). */
    if (requestorEndpoint) {
      this.#invokeDeferred(async () => requestorEndpoint.commandsOf(WebRtcTransportRequestorClient).answer({ webRtcSessionId, sdp }), `Answer for session ${webRtcSessionId}`);
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.provideOffer: invoking Answer on the peer's WebRtcTransportRequestor for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    } else {
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.provideOffer: could not reach the peer's WebRtcTransportRequestor; the Answer for session ${webRtcSessionId} was not sent (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Spread into plain arrays first: state's list attributes throw on out-of-bounds index access (e.g. `[0]` on an
    // empty list) instead of returning undefined like a normal JS array.
    return { webRtcSessionId, ...this.#echoDeprecatedStreamIds(request, session.videoStreams && [...session.videoStreams], session.audioStreams && [...session.audioStreams]) };
  }

  /**
   * Handles the ProvideAnswer command.
   * Records the SDP answer received in response to a previously sent offer and applies it to that session's real
   * werift peer connection (see {@link WeriftWebRtcSession}), if one was created by {@link solicitOffer} or
   * {@link provideOffer}.
   *
   * @param {WebRtcTransportProvider.ProvideAnswerRequest} request - ProvideAnswer request payload.
   * @returns {Promise<void>} Resolves once the answer has been recorded and, if applicable, applied.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override async provideAnswer(request: WebRtcTransportProvider.ProvideAnswerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.provideAnswer: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideAnswer: received an SDP answer for session ${request.webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer.provideAnswer: received SDP answer for session ${request.webRtcSessionId}:\n${request.sdp}`);

    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      await webRtcPeer.applyAnswer(request.sdp);
    }
  }

  /**
   * Handles the ProvideIceCandidates command.
   * Records the ICE candidates gathered for a session and applies them to that session's real werift peer
   * connection (see {@link WeriftWebRtcSession}), if one was created by {@link solicitOffer} or {@link provideOffer}.
   *
   * mDNS host candidates (`*.local`, e.g. from a browser with WebRTC IP obfuscation enabled) are applied like any
   * other candidate: werift-ice resolves them via a real multicast DNS query before pairing them (see
   * `IceGatherer.addRemoteCandidate` in the werift-ice dependency), so this method does not need to special-case
   * them itself.
   *
   * @param {WebRtcTransportProvider.ProvideIceCandidatesRequest} request - ProvideIceCandidates request payload.
   * @returns {Promise<void>} Resolves once the candidates have been recorded and, if applicable, applied.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override async provideIceCandidates(request: WebRtcTransportProvider.ProvideIceCandidatesRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: received ${request.iceCandidates.length} ICE candidate(s) for session ${request.webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      for (const [index, candidate] of request.iceCandidates.entries()) {
        const startedAt = Date.now();
        device.log.debug(
          `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applying ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} ` +
            `(mid=${candidate.sdpMid ?? 'null'}, mLine=${candidate.sdpmLineIndex ?? 'null'}, endOfCandidates=${candidate.candidate.trim() === ''}) ` +
            `(endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        );
        try {
          await Promise.race([
            webRtcPeer.addIceCandidate(candidate.candidate, candidate.sdpMid, candidate.sdpmLineIndex),
            new Promise<never>((_resolve, reject) =>
              setTimeout(
                () => reject(new Error(`MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: ICE candidate apply timeout after ${ICE_CANDIDATE_APPLY_TIMEOUT_MS}ms`)),
                ICE_CANDIDATE_APPLY_TIMEOUT_MS,
              ),
            ),
          ]);
          device.log.debug(
            `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applied ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} ` +
              `in ${Date.now() - startedAt}ms (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          );
        } catch (error) {
          device.log.warn(
            `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} after ${Date.now() - startedAt}ms ` +
              `(endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}): ${String(error)}`,
          );
        }
      }
    }
  }

  /**
   * Handles the EndSession command.
   * Removes the session from currentSessions and closes its real werift peer connection, if one was created by
   * {@link solicitOffer}.
   *
   * @param {WebRtcTransportProvider.EndSessionRequest} request - EndSession request payload.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override async endSession(request: WebRtcTransportProvider.EndSessionRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.endSession: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    this.state.currentSessions = this.state.currentSessions.filter((session) => session.id !== request.webRtcSessionId);
    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      this.internal.sessions.delete(request.webRtcSessionId);
      await webRtcPeer.close();
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.endSession: ended webRTC session ${request.webRtcSessionId} (reason ${request.reason}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }
}

/**
 * matter.js's own Behavior subclasses declare Internal/State/Events this way (see e.g. @matter/node's
 * SubscriptionsServer.ts); it's how the framework resolves `this.internal`'s type, so an ES module can't replace it.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeWebRtcTransportProviderServer {
  /**
   * Internal (endpoint-scoped, not instance-scoped) state for {@link MatterbridgeWebRtcTransportProviderServer}.
   */
  export class Internal {
    /** The next WebRTC session identifier candidate, retained across ephemeral behavior agents. */
    nextWebRtcSessionId = 0;

    /**
     * The real werift peer connection wrappers backing each session in {@link WebRtcTransportProvider.State.currentSessions},
     * keyed by WebRTC session id.
     */
    sessions = new Map<number, WeriftWebRtcSession>();
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
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

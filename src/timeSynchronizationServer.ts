/**
 * @file src/timeSynchronizationServer.ts
 * @description This file contains the MatterbridgeTimeSynchronizationServer class, a Time Synchronization cluster server backed by the host clock.
 * @author Luca Liguori
 * @created 2026-10-18
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

import { isIPv4, isIPv6 } from 'node:net';

// Matterbridge
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'matterbridge/logger';
import { Node, Seconds, Time, type Timer } from 'matterbridge/matter';
import { OperationalCredentialsServer, TimeSynchronizationServer } from 'matterbridge/matter/behaviors';
import { type OperationalCredentials, TimeSynchronization } from 'matterbridge/matter/clusters';
import { Status, StatusResponseError } from 'matterbridge/matter/types';

/**
 * The Matter epoch (2000-01-01T00:00:00Z) in Unix microseconds. matter.js keeps epoch-us values as Unix microseconds
 * and converts them on the wire, so the epoch-us value 0 of the specification (e.g. the ValidAt of the first
 * TimeZone entry) is this value in JavaScript.
 */
export const MATTER_EPOCH_US = 946_684_800_000_000n;

/** Interval of the clock refresh that keeps UTCTime and LocalTime current and applies the TimeZone and DSTOffset changes over time. */
const CLOCK_INTERVAL = Seconds(1);

/** Hostname as defined by RFC 1123: dot separated labels of letters, digits and hyphens, not starting or ending with a hyphen. */
const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

/** Module logger for the Time Synchronization server. */
const log = new AnsiLogger({ logName: 'TimeSync', logLevel: LogLevel.INFO, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/**
 * Returns the current host time in Unix microseconds.
 *
 * @returns {bigint} The current time in Unix microseconds.
 */
function nowUs(): bigint {
  return BigInt(Time.nowMs) * 1000n;
}

/**
 * Checks whether an address is a static IPv6 address written as recommended by RFC 5952 section 4 (lower case and
 * compressed), without zone index or port. The IPv4-mapped form with an embedded dotted IPv4 address (RFC 5952
 * section 5) is accepted too.
 *
 * @param {string} address - The address to check.
 * @returns {boolean} True if the address is a canonical IPv6 address.
 */
export function isCanonicalIpv6(address: string): boolean {
  if (!isIPv6(address) || address.includes('%')) return false;
  if (/^::ffff:\d{1,3}(\.\d{1,3}){3}$/.test(address)) return true;
  return new URL(`http://[${address}]`).hostname === `[${address}]`;
}

/** Featured matter.js base of {@link MatterbridgeTimeSynchronizationServer}: the features required on the Root Node of a Camera. */
const MatterbridgeTimeSynchronizationServerBase = TimeSynchronizationServer.with(
  TimeSynchronization.Feature.TimeSyncClient,
  TimeSynchronization.Feature.NtpClient,
  TimeSynchronization.Feature.TimeZone,
);

/**
 * Time Synchronization cluster server with the TimeSyncClient, NtpClient and TimeZone features, as required on the
 * Root Node of a Camera (`TimeSyncWithClientCond`, `TimeSyncWithNTPCCond`, `TimeSyncWithTZCond`).
 *
 * Matterbridge runs on a host whose clock is kept in sync by the operating system, a trusted time source external to
 * the Matter network (Matter 1.6.1 § 11.17.13), so UTCTime is the host clock with MillisecondsGranularity and the
 * Unknown time source (an unlisted source). No time synchronization protocol is run: the DefaultNTP server and the
 * TrustedTimeSource node are stored as required, but not queried. There is no time zone database, so DSTOffset is
 * provided by the administrator with SetDSTOffset.
 */
export class MatterbridgeTimeSynchronizationServer extends MatterbridgeTimeSynchronizationServerBase {
  declare internal: MatterbridgeTimeSynchronizationServer.Internal;

  override initialize(): void {
    // Matter 1.6.1 § 11.17.8.6: The TimeZone attribute SHALL have at least one entry, UTC by default.
    if (this.state.timeZone.length === 0) this.state.timeZone = [{ offset: 0, validAt: MATTER_EPOCH_US }];
    // There is no time zone database (Matter 1.6.1 § 11.17.8.9).
    this.state.timeZoneDatabase = TimeSynchronization.TimeZoneDatabase.None;
    this.updateClock();
    this.internal.dstActive = this.#activeDstOffset() !== 0;
    this.internal.clockTimer = Time.getPeriodicTimer(
      'TimeSynchronization clock',
      CLOCK_INTERVAL,
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.updateClock, { lock: true }),
    ).start();
    // The OperationalCredentials cluster is on the Root Node: Node.forEndpoint() finds it traversing the owners of this endpoint.
    // Offline: the reaction runs in its own transaction, not in the OperationalCredentials one that changed the fabrics.
    const node = Node.forEndpoint(this.endpoint);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(node.eventsOf(OperationalCredentialsServer).fabrics$Changed, this.#handleFabricsChanged, { offline: true, lock: true });
  }

  /**
   * Stops the clock refresh when the server is disposed.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    this.internal.clockTimer?.stop();
    this.internal.clockTimer = undefined;
    await super[Symbol.asyncDispose]?.();
  }

  /**
   * Refreshes UTCTime and LocalTime from the host clock and applies the TimeZone and DSTOffset changes over time.
   * Called every second by the clock refresh timer.
   *
   * - The TimeZone entry that became valid replaces the previous one, with its ValidAt set to 0 (§ 11.17.8.6).
   * - The DSTOffset entries no longer valid are removed (§ 11.17.8.7), generating DSTTableEmpty when none is left (§ 11.17.10.1).
   * - A DSTStatus event is generated when a DST offset starts or stops being applied (§ 11.17.10.2).
   */
  updateClock(): void {
    const now = nowUs();
    // Matter 1.6.1 § 11.17.8.2 and § 11.17.8.3: UTCTime is non-null, so Granularity and TimeSource are not NoTimeGranularity and None.
    this.state.utcTime = now;
    this.state.granularity = TimeSynchronization.Granularity.MillisecondsGranularity;
    this.state.timeSource = TimeSynchronization.TimeSource.Unknown;

    // Matter 1.6.1 § 11.17.8.6: Remove the TimeZone entries no longer active and set the ValidAt of the one in use to 0.
    const [, nextTimeZone] = this.state.timeZone;
    if (nextTimeZone && BigInt(nextTimeZone.validAt) <= now) {
      this.state.timeZone = [{ offset: nextTimeZone.offset, validAt: MATTER_EPOCH_US, ...(nextTimeZone.name === undefined ? {} : { name: nextTimeZone.name }) }];
    }

    // Matter 1.6.1 § 11.17.8.7: Remove the DSTOffset entries no longer active.
    const dstOffset = this.state.dstOffset.filter((entry) => entry.validUntil === null || BigInt(entry.validUntil) > now);
    if (dstOffset.length !== this.state.dstOffset.length) {
      this.state.dstOffset = dstOffset;
      // Matter 1.6.1 § 11.17.10.1: Generate DSTTableEmpty when the last DST offset expires.
      if (dstOffset.length === 0) {
        log.info('DSTOffset table expired: generating DSTTableEmpty');
        this.events.dstTableEmpty.emit(undefined, this.context);
      }
    }
    this.#updateDstStatus();
    this.#updateLocalTime(now);
  }

  /**
   * Handles the SetUTCTime command.
   *
   * The host clock is a trusted source with MillisecondsGranularity, so the node never has NoTimeGranularity and
   * opts not to update its time, failing the command with the TimeNotAccepted cluster status code (§ 11.17.9.1).
   *
   * @param {TimeSynchronization.SetUtcTimeRequest} request - SetUTCTime request payload.
   * @throws {TimeSynchronization.TimeNotAcceptedError} Always, since the node keeps the host clock.
   */
  override setUtcTime(request: TimeSynchronization.SetUtcTimeRequest): void {
    log.info(`SetUTCTime with granularity ${request.granularity} not accepted: the node uses the host clock`);
    // Matter 1.6.1 § 11.17.9.1: If the node opts to not update its time, fail the command with the cluster specific status code TimeNotAccepted.
    throw new TimeSynchronization.TimeNotAcceptedError('SetUTCTime not accepted: the node uses the host clock');
  }

  /**
   * Handles the SetTrustedTimeSource command (§ 11.17.9.2).
   *
   * @param {TimeSynchronization.SetTrustedTimeSourceRequest} request - SetTrustedTimeSource request payload.
   * @throws {StatusResponseError} UnsupportedAccess if the command has no accessing fabric.
   */
  override setTrustedTimeSource(request: TimeSynchronization.SetTrustedTimeSourceRequest): void {
    const { trustedTimeSource } = request;
    // Matter 1.6.1 § 11.17.9.2: A null TrustedTimeSource sets the attribute to null and generates a MissingTrustedTimeSource event.
    if (trustedTimeSource === null) {
      this.state.trustedTimeSource = null;
      log.info('TrustedTimeSource cleared: generating MissingTrustedTimeSource');
      this.events.missingTrustedTimeSource.emit(undefined, this.context);
      return;
    }
    const fabricIndex = this.context.fabric;
    if (fabricIndex === undefined) {
      throw new StatusResponseError('SetTrustedTimeSource requires an accessing fabric', Status.UnsupportedAccess);
    }
    // Matter 1.6.1 § 11.17.9.2: Otherwise set the NodeID and Endpoint from the command and the FabricIndex of the accessing fabric.
    this.state.trustedTimeSource = { fabricIndex, nodeId: trustedTimeSource.nodeId, endpoint: trustedTimeSource.endpoint };
    log.info(`TrustedTimeSource set to node ${trustedTimeSource.nodeId} endpoint ${trustedTimeSource.endpoint} on fabric ${fabricIndex}`);
  }

  /**
   * Handles the SetDefaultNTP command (§ 11.17.9.6). The address is a domain name, accepted only when
   * SupportsDNSResolve is true, or a static IPv6 address in the RFC 5952 form, without port (§ 11.17.8.5).
   *
   * @param {TimeSynchronization.SetDefaultNtpRequest} request - SetDefaultNTP request payload.
   * @throws {StatusResponseError} InvalidCommand if the address is not a valid DefaultNTP value.
   */
  override setDefaultNtp(request: TimeSynchronization.SetDefaultNtpRequest): void {
    const { defaultNtp } = request;
    if (defaultNtp !== null && !isCanonicalIpv6(defaultNtp)) {
      // Matter 1.6.1 § 11.17.9.6: Fail with INVALID_COMMAND if the address is not a domain name or a static IPv6 address without port.
      if (isIPv4(defaultNtp) || !HOSTNAME_REGEX.test(defaultNtp)) {
        throw new StatusResponseError(`SetDefaultNTP: ${defaultNtp} is not a domain name or a static IPv6 address`, Status.InvalidCommand);
      }
      // Matter 1.6.1 § 11.17.9.6: Fail with INVALID_COMMAND if the address is a domain name and the node does not support DNS resolution.
      if (!this.state.supportsDnsResolve) {
        throw new StatusResponseError(`SetDefaultNTP: ${defaultNtp} is a domain name and the node does not support DNS resolution`, Status.InvalidCommand);
      }
    }
    this.state.defaultNtp = defaultNtp;
    log.info(`DefaultNTP set to ${defaultNtp ?? 'null'}`);
  }

  /**
   * Handles the SetTimeZone command (§ 11.17.9.3). Without a time zone database the DSTOffset attribute is emptied
   * and the response asks the administrator for the DST offsets.
   *
   * @param {TimeSynchronization.SetTimeZoneRequest} request - SetTimeZone request payload.
   * @returns {TimeSynchronization.SetTimeZoneResponse} The SetTimeZoneResponse, with DSTOffsetRequired true.
   * @throws {StatusResponseError} ResourceExhausted if the list is larger than TimeZoneListMaxSize, ConstraintError if the list does not conform to the TimeZone attribute requirements.
   */
  override setTimeZone(request: TimeSynchronization.SetTimeZoneRequest): TimeSynchronization.SetTimeZoneResponse {
    const { timeZone } = request;
    // Matter 1.6.1 § 11.17.9.3: Respond with RESOURCE_EXHAUSTED if the list is larger than TimeZoneListMaxSize.
    if (timeZone.length > this.state.timeZoneListMaxSize) {
      throw new StatusResponseError(`SetTimeZone: ${timeZone.length} entries exceed TimeZoneListMaxSize ${this.state.timeZoneListMaxSize}`, Status.ResourceExhausted);
    }
    // Matter 1.6.1 § 11.17.8.6: The first entry SHALL have a ValidAt of 0, a second entry a non-zero ValidAt.
    const [first, second] = timeZone;
    if (first === undefined || BigInt(first.validAt) !== MATTER_EPOCH_US || (second !== undefined && BigInt(second.validAt) === MATTER_EPOCH_US)) {
      throw new StatusResponseError('SetTimeZone: the first entry SHALL have a ValidAt of 0 and a second entry a non-zero ValidAt', Status.ConstraintError);
    }
    // Matter 1.6.1 § 11.17.9.3: Copy the list to the TimeZone attribute and generate a TimeZoneStatus event with the new time zone.
    this.state.timeZone = timeZone;
    const now = nowUs();
    const active = this.#activeTimeZone(now);
    log.info(`TimeZone set to offset ${active.offset}s${active.name === undefined ? '' : ` (${active.name})`}: generating TimeZoneStatus`);
    this.events.timeZoneStatus.emit({ offset: active.offset, name: active.name }, this.context);
    // Matter 1.6.1 § 11.17.9.3: Without a time zone database, set DSTOffset to an empty list and generate a DSTTableEmpty event.
    this.state.dstOffset = [];
    this.events.dstTableEmpty.emit(undefined, this.context);
    // Matter 1.6.1 § 11.17.9.3: Generate a DSTStatus event if the node was previously applying a DST offset.
    this.#updateDstStatus();
    this.#updateLocalTime(now);
    // Matter 1.6.1 § 11.17.9.4: The node does not set its own DSTOffset, so DSTOffsetRequired is true.
    return { dstOffsetRequired: true };
  }

  /**
   * Handles the SetDSTOffset command (§ 11.17.9.5).
   *
   * @param {TimeSynchronization.SetDstOffsetRequest} request - SetDSTOffset request payload.
   * @throws {StatusResponseError} ResourceExhausted if the list is larger than DSTOffsetListMaxSize, ConstraintError if the list does not conform to the DSTOffset attribute requirements.
   */
  override setDstOffset(request: TimeSynchronization.SetDstOffsetRequest): void {
    const { dstOffset } = request;
    // Matter 1.6.1 § 11.17.9.5: Respond with RESOURCE_EXHAUSTED if the list is larger than DSTOffsetListMaxSize.
    if (dstOffset.length > this.state.dstOffsetListMaxSize) {
      throw new StatusResponseError(`SetDSTOffset: ${dstOffset.length} entries exceed DSTOffsetListMaxSize ${this.state.dstOffsetListMaxSize}`, Status.ResourceExhausted);
    }
    // Matter 1.6.1 § 11.17.9.5: Respond with CONSTRAINT_ERROR if the list does not conform to the DSTOffset attribute requirements (§ 11.17.8.7).
    for (const [index, entry] of dstOffset.entries()) {
      const isLast = index === dstOffset.length - 1;
      const previous = index > 0 ? dstOffset[index - 1] : undefined;
      // Only the last entry may have a null ValidUntil, and a ValidUntil is after its ValidStarting.
      const validUntilOk = entry.validUntil === null ? isLast : BigInt(entry.validUntil) > BigInt(entry.validStarting);
      // Sorted by ValidStarting, not starting before the ValidUntil of the previous entry.
      const orderOk = previous?.validUntil === null || previous === undefined || BigInt(entry.validStarting) >= BigInt(previous.validUntil);
      if (!validUntilOk || !orderOk) {
        throw new StatusResponseError(`SetDSTOffset: entry ${index} does not conform to the DSTOffset list requirements`, Status.ConstraintError);
      }
    }
    // Matter 1.6.1 § 11.17.9.5: Copy the list to the DSTOffset attribute; generate DSTTableEmpty if it is empty and DSTStatus if the DST state changes.
    this.state.dstOffset = dstOffset;
    log.info(`DSTOffset set with ${dstOffset.length} entries`);
    if (dstOffset.length === 0) this.events.dstTableEmpty.emit(undefined, this.context);
    this.#updateDstStatus();
    this.#updateLocalTime(nowUs());
  }

  /**
   * Clears the TrustedTimeSource when its fabric is removed and generates a MissingTrustedTimeSource event (§ 11.17.10.5).
   *
   * @param {readonly OperationalCredentials.FabricDescriptor[]} fabrics - The fabrics of the node after the change.
   */
  #handleFabricsChanged(fabrics: readonly OperationalCredentials.FabricDescriptor[]): void {
    // Read before clearing the attribute: a reference to state is no longer valid once the state changes.
    const fabricIndex = this.state.trustedTimeSource?.fabricIndex;
    if (fabricIndex === undefined || fabrics.some((fabric) => fabric.fabricIndex === fabricIndex)) return;
    // Matter 1.6.1 § 11.17.10.5: Generate MissingTrustedTimeSource when the TrustedTimeSource is set to null upon fabric removal.
    this.state.trustedTimeSource = null;
    log.info(`TrustedTimeSource fabric ${fabricIndex} removed: generating MissingTrustedTimeSource`);
    this.events.missingTrustedTimeSource.emit(undefined, this.context);
  }

  /**
   * Returns the TimeZone entry in use: the last one whose ValidAt is not in the future.
   *
   * @param {bigint} now - The current time in Unix microseconds.
   * @returns {TimeSynchronization.TimeZone} The TimeZone entry in use.
   */
  #activeTimeZone(now: bigint): TimeSynchronization.TimeZone {
    const [first, second] = this.state.timeZone;
    return second !== undefined && BigInt(second.validAt) <= now ? second : first;
  }

  /**
   * Returns the DST offset in use, in seconds: the offset of the DSTOffset entry valid now, 0 if there is none.
   *
   * @returns {number} The DST offset in use, in seconds.
   */
  #activeDstOffset(): number {
    const now = nowUs();
    const active = this.state.dstOffset.find((entry) => BigInt(entry.validStarting) <= now && (entry.validUntil === null || now < BigInt(entry.validUntil)));
    return active?.offset ?? 0;
  }

  /**
   * Generates a DSTStatus event when the node starts or stops applying a DST offset (§ 11.17.10.2).
   */
  #updateDstStatus(): void {
    const dstActive = this.#activeDstOffset() !== 0;
    if (dstActive === this.internal.dstActive) return;
    this.internal.dstActive = dstActive;
    log.info(`DST offset ${dstActive ? 'applied' : 'no longer applied'}: generating DSTStatus`);
    this.events.dstStatus.emit({ dstOffsetActive: dstActive }, this.context);
  }

  /**
   * Updates LocalTime: UTCTime plus the offsets of the TimeZone and DSTOffset entries in use, null while DSTOffset is empty (§ 11.17.8.8).
   *
   * @param {bigint} now - The current time in Unix microseconds.
   */
  #updateLocalTime(now: bigint): void {
    if (this.state.dstOffset.length === 0) {
      this.state.localTime = null;
      return;
    }
    const offsetSeconds = this.#activeTimeZone(now).offset + this.#activeDstOffset();
    this.state.localTime = now + BigInt(offsetSeconds) * 1_000_000n;
  }
}

/**
 * matter.js's own Behavior subclasses declare Internal this way; it is how the framework resolves `this.internal`'s type.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeTimeSynchronizationServer {
  /**
   * Internal (endpoint-scoped, not instance-scoped) state for {@link MatterbridgeTimeSynchronizationServer}.
   */
  export class Internal {
    /** The periodic timer refreshing the clock. */
    clockTimer?: Timer;
    /** Whether a DST offset is being applied, to generate DSTStatus on a change. */
    dstActive = false;
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
}

<!-- eslint-disable markdown/no-missing-label-refs -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge camera example plugin changelog

[![npm version](https://img.shields.io/npm/v/matterbridge-example-camera.svg)](https://www.npmjs.com/package/matterbridge-example-camera)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-example-camera.svg)](https://www.npmjs.com/package/matterbridge-example-camera)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-example-camera/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-example-camera/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-example-camera/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-example-camera)
[![tested with Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev)
[![styled with Oxc](https://img.shields.io/badge/styled_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/formatter.html)
[![linted with Oxc](https://img.shields.io/badge/linted_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/linter.html)
[![TypeScript Native](https://img.shields.io/badge/TypeScript_Native-3178C6?logo=typescript&logoColor=white)](https://github.com/microsoft/typescript-go)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
![under development](https://img.shields.io/badge/status-under%20development-orange)

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-example-camera and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.2.0] - Dev branch

### Added

- [chip]: Non-skipped CHIP test failures that carry a documented `comment` in `chipTests.json` (known, explained issues) no longer fail the `chip-tests.yml` workflow; only undocumented failures do.
- [camera]: Add the ffmpeg-based snapshot capture pipeline (`src/behaviors/snapshot.ts`): captures a single JPEG from an RTSP or webcam source, retrying at increasing compression (and a downgraded resolution as a last resort) until it fits the requested byte budget, with request validation, bounded capture timeouts escalating from `SIGTERM` to `SIGKILL`, webcam warm-up frame dropping, empty-capture rejection, and credential redaction in logs and errors.
- [frontend] Add plugin-frontend agents instructions.

### Changed

- [plugin]: Require Matterbridge `3.10.3` or later.
- [camera]: Move `weriftSession.ts` from `src/webrtc/` to `src/behaviors/` and extract the ffmpeg binary resolution into a shared `src/behaviors/ffmpeg.ts` helper, resolved once at module load and reused by both the WebRTC injection and the snapshot pipeline.

## [0.1.0] - Dev branch

### Added

- [camera]: Bump MatterbridgeWebRtcTransportProviderServer v.2.0.0.
- [camera]: Bump MatterbridgeCameraAvStreamManagementServer v.2.0.0.
- [chip]: Add chip test toolchain.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.9] - Not published

### Added

- [Dev Container]: Update Dev Container v.1.2.0.
- [scripts]: Add `scripts/run-chip-tests.mjs` to manage the `luligu/matterbridge:chip-test` docker container and run the CHIP python test suite defined in `chipTests.json`. `--start` builds and adds the plugin to a fresh container, `--stop` stops it and restores the local dev environment (reinstall, relink, rebuild), `--test NAME` filters to matching tests, and results are logged to `chipTests.log`.
- [scripts]: `run-chip-tests.mjs` now supports a per-test `"reset": true` field in `chipTests.json` that clears persisted stateful cluster storage and restarts the plugin (without recreating the container) before a test that needs a clean device state, and a per-test `"comment"` field that documents a known/expected failure, printed under its ❌ line in the run summary. The run summary is also written to `chipTestsSummary.log`, separate from the full `chipTests.log`.
- [tests]: Add `TC_AVSUM_2_1`, `TC_AVSUM_2_2`, `TC_AVSUM_2_3` and `TC_AVSUM_2_9` (Camera AV Settings User Level Management / Mechanical PTZ) to `chipTests.json` and the README, running against the `PTZCamera` example device (endpoint 7).
- [camera]: Add a `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` environment variable for `MatterbridgeWebRtcTransportProviderServer.solicitOffer`/`provideOffer`. When set to `1`: (1) a request with none of `videoStreams`, `audioStreams`, `videoStreamId` or `audioStreamId` present is rejected with `INVALID_COMMAND`, matching the Matter specification's choice conformance for these commands; (2) `videoStreams`/`audioStreams` are resolved and validated against `AllocatedVideoStreams`/`AllocatedAudioStreams` per Matter 1.6/1.5.1 §11.5.6.1.10/§11.5.6.3.5 — `INVALID_IN_STATE` when nothing is allocated, `ALREADY_EXISTS` on duplicate ids, `DYNAMIC_CONSTRAINT_ERROR` when an id isn't allocated — instead of the default lenient auto-allocate-on-demand behavior. Fixes the CHIP WebRTC Transport Provider conformance test suite's expectations (`TC_WEBRTCP_2_2`, `2_3`, `2_5`, `2_27`, `2_28`, `2_29`, `2_31`; `2_3`/`2_29` now fully pass, `2_5`/`2_31` progress past this scenario into an unrelated, still-open `StreamUsage` validation gap). Left unset (the default), behavior is completely unchanged: a completely empty request triggers automatic stream selection, and a present stream id/list is used without validating it against `Allocated*Streams` at all — required for compatibility with real clients observed in production that never call `VideoStreamAllocate`/`AudioStreamAllocate` (e.g. SmartThings, and Home Assistant's Matter camera integration).
- [tests]: Add coverage for `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`'s `Allocated*Streams` validation in `vitest/behaviors/webRtcTransportProviderServer.test.ts` (up to 53 tests, 100% statements/branches/functions/lines maintained project-wide).
- [camera]: `MatterbridgeCameraAvStreamManagementServer` now self-allocates a default video/audio/snapshot stream on construction for any feature the endpoint supports that has none allocated yet (`Camera`, `SnapshotCamera`, `AudioDoorbell`, `Intercom`, and the composite `FloodlightCamera`/`VideoDoorbell`), so `AllocatedVideoStreams`/`AllocatedAudioStreams`/`AllocatedSnapshotStreams` are never unexpectedly empty for a client that never calls `VideoStreamAllocate`/`AudioStreamAllocate`/`SnapshotStreamAllocate` itself (e.g. SmartThings in production) or after matter.js legitimately discards persisted state on a `FeatureMap` change between restarts. Add a `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` environment variable to disable this (set to `1`) for the CHIP conformance suite, whose `TC_AVSM_2_2`/`TC_AVSM_2_5` assert the lists are empty immediately after commissioning — see `chipTests.md`'s "Camera AV Stream Management — Default Stream Self-Allocation" for the full rationale and verification. The self-allocated default snapshot stream's `minResolution`/`maxResolution` now span the full range of the endpoint's `snapshotCapabilities` (smallest to largest entry) instead of a single fixed point (the first/smallest entry), so a real client requesting any of the device's own advertised snapshot resolutions dedup-matches this default stream in `snapshotStreamAllocate` (Matter 1.6/1.5.1 §11.2.8.8.8) instead of allocating an unwanted duplicate — confirmed against a real `python-matter-server` dashboard trace that previously allocated a second, orphaned snapshot stream for exactly this reason.

### Changed

- [screenshots]: Update screenshots.

### Fixed

- [chime]: `MatterbridgeChimeServer` now rejects writes to the `SelectedChime` attribute with `NOT_FOUND` when the written chime ID is not present in `InstalledChimeSounds`, per Matter 1.6 Application Cluster spec §11.8.5.2. Previously any value was silently accepted, failing `TC_CHIME_2_3`.
- [camera]: `CameraAvStreamManagement.captureSnapshot` now rejects with `NOT_FOUND` when the requested `snapshotStreamId` (or automatic selection with no allocated snapshot stream) does not match an entry in `AllocatedSnapshotStreams`, per Matter 1.6 §11.2.8.13. Previously it always returned a snapshot. Fixed `TC_AVSM_2_10`.
- [camera]: `SnapshotStreamAllocate` now reuses an existing snapshot stream whose resolution range overlaps the request (narrowing its stored resolution to the new range) instead of only matching on exact field equality, per Matter 1.6 §11.2.8.8.8. Fixed `TC_AVSM_2_15` and `TC_AVSM_StreamReuseRangeParams`.
- [camera]: `VideoStreamAllocate` now enforces `MaxConcurrentEncoders`, rejecting a new (non-reused) allocation with `RESOURCE_EXHAUSTED` once the limit is reached, and validates the `MinFrameRate`/`MaxFrameRate` and `MinBitRate`/`MaxBitRate` cross-field constraints ("1 to Max...", Matter 1.6 §11.2.8.4) with `CONSTRAINT_ERROR`, neither of which matter.js enforces automatically.
- [camera]: `MPTZSetPosition` and `MPTZRelativeMove` now reject with `INVALID_COMMAND` when all of their fields (pan/tilt/zoom, or panDelta/tiltDelta/zoomDelta) are omitted, per Matter 1.6 §11.3.7. Previously an empty command was silently accepted as a no-op. Fixed `TC_AVSUM_2_2` and `TC_AVSUM_2_3`.
- [camera]: Remove the temporary `ImageControl` feature workaround from Audio Doorbell and Intercom, now that the underlying matter.js choice-conformance bug (ImageRotation/ImageFlipHorizontal/ImageFlipVertical enforced unconditionally instead of only when `ImageControl` is enabled) is fixed upstream. Both device types now correctly omit `ImageControl` and its attributes, matching the Matter specification for their device type. Also removed the now-obsolete `comment` on `TC_DeviceConformance` in `chipTests.json`.
- [camera]: Remove the same now-unneeded `ImageControl` attributes from Snapshot Camera (Snapshot feature only). Camera keeps `ImageControl` enabled: unlike the other three device types, its `webRtcTransportProviderServer.ts` automatic stream assignment gates on `endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)`, an exact match against that base class's declared Video/Audio/Snapshot/ImageControl feature set, so dropping `ImageControl` there breaks WebRTC `SolicitOffer`/`ProvideOffer` auto-assignment.
- [tests]: Add `SelectedChime` write coverage (accepted and rejected chime IDs) in `vitest/behaviors/chimeServer.test.ts`.
- [tests]: Add coverage for all the `CameraAvStreamManagement` and `CameraAvSettingsUserLevelManagement` fixes above in `vitest/behaviors/cameraAvStreamManagementServer.test.ts` and `vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts` (both files at 100% statements/branches/functions/lines).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.8] - 2026-07-26

### Added

- [webrtc]: Add an `rtsp` video generator option that pulls from a real RTSP camera via `ffmpeg -rtsp_transport tcp -i <url>` instead of only the synthetic test pattern or a local webcam.
- [platform]: Rename the `webcam`/`webcamResolution`/`webcamBitrate` config properties to `videoSource`/`videoResolution`/`videoBitrate` (and the corresponding `MATTERBRIDGE_CAMERA_WEBCAM_*` env vars to `MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE`/`MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION`/`MATTERBRIDGE_CAMERA_VIDEO_BITRATE`), since `videoSource` now also holds the RTSP url for the `rtsp` generator.
- [platform]: Rename the `generator` config property to `videoGenerator`.
- [webrtc]: Add an `auto` value for `videoResolution` (now the default) that uses the controller's requested per-session resolution (the allocated video stream's `maxResolution`) instead of a fixed value; a fixed `videoResolution` still always wins over the controller's request. For `rtsp`, the resolved resolution (fixed or auto) is now applied to the injected track with an ffmpeg `scale` filter instead of being ignored.
- [docs]: Document the `rtsp` video generator, the renamed config properties, the `auto`/fixed `videoResolution` precedence, and the previously undocumented `videoBitrate` property (with suggested per-resolution values) in the README and schema, with example configurations.
- [tests]: Add `rtsp` video source and `videoResolution` precedence (`auto` vs. fixed, webcam and rtsp) coverage in `vitest/webrtc/weriftSession.test.ts`; extend `vitest/module.test.ts` with the `videoGenerator` normalization test and a test for the `videoResolution` default of `auto`.
- [webrtc]: Add `WeriftWebRtcSession.closeAll()`, a static helper that closes every active session (peer connection plus any injected ffmpeg generators). `onShutdown` now calls it so a graceful platform shutdown cleans up leftover WebRTC sessions itself instead of relying solely on the `process.on('exit', ...)` fallback.
- [tests]: Add `closeAll` coverage in `vitest/webrtc/weriftSession.test.ts`, covering closing all active sessions and the no-active-sessions case.
- [platform]: Add an `audioGenerator` config property (`none`/`test`, defaulting to `none`) replacing the undocumented `MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1` env var toggle, mirroring `videoGenerator`'s pattern via the new `MATTERBRIDGE_CAMERA_AUDIO_SOURCE` env var. Test-voice audio injection is now opt-in instead of on by default.
- [docs]: Document `audioGenerator` in the README and schema.
- [tests]: Extend `vitest/module.test.ts` with `audioGenerator` normalization/apply coverage; update `vitest/webrtc/weriftSession.test.ts` for the new `MATTERBRIDGE_CAMERA_AUDIO_SOURCE` gate.
- [webrtc]: Add a periodic diagnostics log (`WeriftWebRtcSession.logDiagnosticsSnapshot`, every 10s) reporting `connectionState`, `iceConnectionState`, `iceGatheringState`, `signalingState`, per-transport ICE/DTLS states, and `getStats()`-derived packet-flow counters (nominated candidate-pair and outbound-rtp packets, with deltas since the previous tick). Needed because werift's ICE consent-freshness check (RFC 7675) can latch `iceConnectionState` at `disconnected` forever after a single missed keepalive, even on a healthy, actively-streaming session — the packet-flow deltas are unaffected by that bug and are a reliable "is media still moving" signal. A dedicated log line also fires immediately on any DTLS transport state change instead of waiting for the next tick.
- [webrtc]: Auto-close a `WeriftWebRtcSession` (peer connection plus any injected ffmpeg generators) when one of its DTLS transports reaches `closed` or `failed` on its own — a real, one-way teardown signal from the peer, unlike `iceConnectionState`'s `disconnected`, which must never trigger a close by itself. Fixes an orphaned-session leak: a controller that abandons a live view without ever sending `EndSession` (e.g. just closing the window) previously left the peer connection and its ffmpeg processes running indefinitely, piling up on every reconnect.
- [tests]: Add DTLS-triggered auto-close coverage in `vitest/webrtc/weriftSession.test.ts` (`closed`, `failed`, and a regression test ensuring a normal `close()` doesn't re-enter itself via the same DTLS state change).
- [webrtc]: Add `microphone` and `rtsp` options to `audioGenerator`, mirroring `videoGenerator`'s pattern: `microphone` captures from a local capture device via `ffmpeg -f alsa/avfoundation/dshow`, and `rtsp` pulls just the audio from a real RTSP camera stream (dropping any video) via `ffmpeg -rtsp_transport tcp -i <url> -vn`. Add the corresponding `audioSource` config property and `MATTERBRIDGE_CAMERA_AUDIO_SOURCE_DEVICE` env var (device identifier for `microphone`, or the RTSP url for `rtsp`), mirroring `videoSource`/`MATTERBRIDGE_CAMERA_VIDEO_SOURCE_DEVICE`. The `-af volume=6dB` boost is now only applied to the `test` clip (recorded quietly), not to `microphone`/`rtsp` capture.
- [docs]: Document the `microphone` and `rtsp` audio generators and the new `audioSource` property in the README and schema, with example configurations.
- [tests]: Extend `vitest/module.test.ts` and `vitest/webrtc/weriftSession.test.ts` with `microphone`/`rtsp` audio source coverage.

### Changed

- [webrtc]: Replace inline `error instanceof Error ? error.message : String(error)` error-message extraction with `getErrorMessage` from `matterbridge/utils` throughout `weriftSession.ts`; use `fireAndForget` for the auto-close's fire-and-forget `close()` call, matching the pattern already used elsewhere in the plugin.

### Fixed

- [webrtc]: The per-session requested webcam resolution (from a client's `CameraAvStreamManagement.VideoStreamAllocate`) was never actually applied: `buildFfmpegVideoInputArgs` read `MATTERBRIDGE_CAMERA_VIDEO_RESOLUTION` directly before falling back to `getConfiguredVideoResolution(requestedResolution)`, and since the plugin always sets that env var (default `640x480` at the time of this fix, before `videoResolution` defaulted to `auto`), the fallback — and therefore the requested resolution — was never reached.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.7] - 2026-07-25

### Added

- [video doorbell]: Add the Video Doorbell device type (Matter 1.6.0 chapter 16.3). A composite device, always defined via endpoint composition: the root endpoint exposes Basic Information and, unless disabled, a Power Source cluster; the mandatory Camera child endpoint is wired the same way as the standalone `Camera` device, and the mandatory Doorbell child endpoint is wired the same way as the standalone `Doorbell` device. Exposes `addDoorbell()` to add further Doorbell child endpoints.
- [platform]: Register a Video Doorbell example device in `onStart`.
- [tests]: Add `vitest/devices/videoDoorbell.test.ts`; extend `vitest/module.test.ts` device-count assertions for the new device.
- [docs]: Document the Video Doorbell device type in the README.
- [tests]: Add `vitest/webrtc/weriftSession.test.ts` coverage for the audio track injection path in `WeriftWebRtcSession`: an SDP answer without an injectable audio codec when the remote offer only supports PCMU, skipping non-audio transceivers when selecting the preferred audio codec, only adjusting the audio transceiver(s) that actually negotiated the preferred codec, the `MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1` toggle, a missing ffmpeg dependency on the audio path, and not re-attaching a test-audio track on a subsequent `createAnswer`. `weriftSession.ts` is back to 100% statement/branch/function/line coverage. Also mark the audio generator's spawn-error handler, its catch block, and the unreachable `adjustedTransceivers === 0` branch in `preferAudioCodecOnTransceivers` as `v8 ignore`, mirroring the already-ignored video counterparts for the same reasons (child-process/werift-internals mocking, and a mimeType that's always found on at least one transceiver).
- [ptz camera]: Add the PTZ Camera device type. Same device type and Camera AV Stream Management/WebRtcTransportProvider wiring as the standalone `Camera` device, plus the Camera AV Settings User Level Management cluster with the MechanicalPan, MechanicalTilt and MechanicalZoom features, implementing the `MPTZSetPosition` (absolute move, rejecting out-of-range pan/tilt/zoom with a ConstraintError) and `MPTZRelativeMove` (relative move, clamped to the configured range) commands.
- [behaviors]: Add `src/behaviors/cameraAvSettingsUserLevelManagementServer.ts` with `MatterbridgeCameraAvSettingsUserLevelManagementServer`.
- [platform]: Register a PTZ Camera example device in `onStart`.
- [tests]: Add `vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts`; extend `vitest/module.test.ts` device-count assertions for the new device.
- [docs]: Document the PTZ Camera device type in the README.
- [platform]: Add log of config.
- [platform]: Add animation interval in 10 phases.
- [doorbell]: Add use of cluster client Chime of Server Doorbell in the animation. It needs the Server Doorbell and Server Chime to be paired and a binding in Matter Server dashboard from Server Doorbell Chime client cluster to Server Chime Chime server cluster: [bindings](screenshots/bindings.png).
- [chip-test]: Add full shell script to run the chip tests.
- [platform]: Set the software version (plugin version) and hardware version (Matterbridge version) on each device in `addDevice()` before registration, so the BasicInformation/BridgedDeviceBasicInformation Firmware and Hardware fields no longer stay stuck at the default `1.0.0`.

### Changed

- [package]: Update dependencies and update package.
- [package]: Bump `werift` to v.0.24.1. This release tightens `setRemoteDescription`/`setLocalDescription` toward W3C `RTCPeerConnection` spec compliance (signaling-state validation, SDP media-section handling), which is stricter than the previous 0.23.0 behavior.
- [package]: Update agents configs.

### Fixed

- [chime]: Fix behavior when enabled is false. All chip tests pass.
- [webrtc]: `createAnswer()` no longer calls `ensureTestAudioTrack()` when the remote offer negotiated no injectable audio codec (e.g. PCMU-only). Previously it still ran with an `undefined` codec and silently defaulted to Opus/payload type 111, injecting RTP the peer never negotiated.
- [tests]: Fix `vitest/behaviors/webRtcTransportProviderServer.test.ts` session reuse that broke under werift 0.24.1's stricter signaling-state validation: `provideOffer`/`provideAnswer` on an "existing session" test now use dedicated sessions instead of layering a media-less fake re-offer/answer onto the same real, already-negotiated session 1, which used to silently work only because of werift 0.23.0's laxer validation.
- [webrtc]: `provideIceCandidates` applied ICE candidates one at a time and only returned once every one of them had finished (up to a 5s mDNS resolution/apply timeout, each). A browser offers one host candidate per local network interface, and an interface with no multicast route to the Matterbridge host (e.g. an inactive VPN/virtual adapter) always runs out that timeout — so candidates were stacking up to 5-10s of dead time onto every `ProvideIceCandidates` call, even though a candidate on a reachable interface routinely resolved in milliseconds. Candidates are now applied concurrently, and the command responds as soon as they're recorded instead of waiting for their application to finish (matching how `SolicitOffer`/`ProvideOffer` already invoke Offer/Answer on the peer without blocking their own response) — application results are still logged, just in the background. Diagnosed against a real Edge client.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.6] - 2026-07-21

### Added

- [floodlight camera]: Add the Floodlight Camera device type. It is a composed device: the root endpoint carries Basic Information and, unless disabled, Power Source; the mandatory Camera child endpoint and the mandatory On/Off Light child endpoint required by Matter specs 1.6.0 chapter 16.2 are both created automatically by the constructor, the Camera child with the same CameraAvStreamManagement/WebRtcTransportProvider wiring as the standalone `Camera` device; `addLight()` adds further On/Off Light child endpoints beyond the mandatory one.
- [intercom]: Add the Intercom device type with the Camera AV Stream Management (Audio and Speaker features, for genuine two-way audio), WebRtcTransportProvider, and WebRtcTransportRequestor server clusters, plus the WebRtcTransportProvider, WebRtcTransportRequestor, and Chime client clusters, Identify, and Power Source support.
- [clients]: Add `addWebRtcTransportProviderClient` helper to `src/behaviors/clients.ts`, shared by `Intercom`, mirroring `addWebRtcTransportRequestorClient`.
- [behaviors]: Add `src/behaviors/webRtcTransportRequestorServer.ts` with `createDefaultWebRtcTransportRequestorClusterServer`, using matter.js's default `WebRtcTransportRequestorServer` implementation directly.
- [tests]: Add `vitest/devices/floodlightCamera.test.ts` covering default options, custom `lightOptions`, camera identify, power source variants, additional tagged lights, and custom stream usages; add `vitest/devices/intercom.test.ts`; extend `vitest/module.test.ts` with the Floodlight Camera "device not registered" `onConfigure` error path; extend `vitest/behaviors/clients.test.ts` to cover `addWebRtcTransportProviderClient`.
- [platform]: Register a Floodlight Camera and two Intercom example devices, `Intercom 1` (bridged) and `Intercom 2` (`mode: 'server'`, its own Matter node, alongside the existing `Server Chime`/`Server Doorbell`), in `onStart`, and verify Intercom 1 is registered in `onConfigure`. Intercom 1 and Intercom 2 can be bound to each other to test two-way calling (see the new README pairing section).
- [docs]: Document how to pair two Intercom devices for two-way calling (Binding and ACL requirements, with chip-tool examples) in the README.

### Changed

- [webrtc]: Add the required `generator` setting (`none`, `test`, or `webcam`, default `none`), the optional `webcam` ffmpeg device setting with no default, and the required `webcamResolution` setting (`640x480`, `1280x720`, or `1920x1080`, default `640x480`). `test` selects the SMPTE bars pattern, `webcam` captures from the configured device, and `none` negotiates video without attaching a track.

### Fixed

- [webrtc]: Allocate `WebRTCSessionID` values monotonically from 0 through 65534 across both `SolicitOffer` and new-session `ProvideOffer` requests, wrapping to 0 and skipping active identifiers instead of deriving the next value from the currently active sessions.
- [platform]: Initialize missing `whiteList` and `blackList` properties for older saved configs so the frontend Home page exposes its device-selection checkboxes.
- [webrtc]: `provideIceCandidates` unconditionally skipped every mDNS host ICE candidate (`*.local`), so a peer that only offers mDNS-obfuscated candidates (the Chromium/Edge default) left the werift peer connection with zero usable remote candidates — signaling succeeded but the stream stayed black. werift-ice already resolves `.local` candidates via a real multicast DNS query before pairing them, so candidates are no longer skipped and that resolution is allowed to run; the per-candidate apply timeout is bumped from 2000ms to 5000ms to leave headroom for the mDNS round trip. Verified against a real Edge client: the mDNS candidate resolved and applied in 98ms and video streamed correctly. See the new "Known limitation: Firefox may only offer a link-local address on a non-HTTPS page" note in the README for a related, separate client-side issue this does not fix.
- [snapshot]: README asset docs still described the pre-#15 `camera-color-test-*.jpeg` names; `CaptureSnapshot` now reads `camera-color-{640-480,1280-720,1920-1080}.jpeg`. Also documented why all three calibration cards are kept under the ~65535-byte Matter message-size ceiling (AES-CCM's 13-byte nonce) and why it can't be worked around by tuning TCP.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.5] - 2026-07-20

### Added

- [wirift]: Add codec negotiation and ffmpeg windows path.
- [audio doorbell]: Add the Audio Doorbell device type with the required Identify, Switch (MomentarySwitch feature), Camera AV Stream Management (Audio feature), and WebRtcTransportProvider clusters, plus the Chime and WebRtcTransportRequestor client clusters, and Power Source support.
- [clients]: Add `src/behaviors/clients.ts` with `addChimeClient`/`addWebRtcTransportRequestorClient` helpers, shared by `Doorbell`, `AudioDoorbell`, and `Camera`.
- [tests]: Add `vitest/behaviors/clients.test.ts` covering `addChimeClient`/`addWebRtcTransportRequestorClient`, and assert in `doorbell.test.ts`, `camera.test.ts`, and `audioDoorbell.test.ts` that the required client clusters are registered in `MatterbridgeBindingServer`'s `clientList` and `type.clientClusters`.
- [platform]: Add a server Chime and Doorbell to test binding.

### Changed

- [package]: Update dependencies.
- [package]: Upgrade package.
- [camera]: Use the shared `addWebRtcTransportRequestorClient` helper from `clients.ts` instead of a local duplicate.
- [doorbell]: Use the shared `addChimeClient` helper from `clients.ts` instead of inline binding code.
- [devices]: `DoorbellOptions`, `AudioDoorbellOptions`, `ChimeOptions`, `CameraOptions`, and `SnapshotCameraOptions` now extend `MatterbridgeEndpointOptions`, forwarding `id`/`number`/`tagList`/`mode` to the underlying `MatterbridgeEndpoint` (`id` defaults to `${name}-${serial}` when not provided), and document the default value of each `identifyTime`/`identifyType`/`powerSourceType` option in JSDoc.
- [module]: Register the `AudioDoorbell` example device in `onStart` and verify it's registered in `onConfigure`, alongside the existing `Chime`, `Doorbell`, `SnapshotCamera`, and `Camera` example devices.
- [tests]: Add `vitest/module.test.ts` coverage for the `AudioDoorbell` and `Camera` "device not registered" `onConfigure` error paths, and for the `animationInterval` configuration option (periodic `animationHandler` execution, phase wraparound, and interval cleanup on shutdown).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.4] - 2026-07-19

### Added

- [webrtc]: `WebRtcTransportProvider` now negotiates real SDP offers/answers through a werift `RTCPeerConnection` (`WeriftWebRtcSession`) instead of a placeholder SDP string, and applies real ICE candidates and connection teardown.
- [webrtc]: Injects a real video track into the negotiated connection via ffmpeg, so the media path can be validated end to end without a physical camera. Defaults to a synthetic SMPTE bars test pattern, or captures from a real local webcam (`MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam`, `MATTERBRIDGE_CAMERA_WEBCAM_DEVICE`) at 640x480/1280x720/1920x1080, following the resolution the client actually allocated via `CameraAvStreamManagement.VideoStreamAllocate`. See the README for the full list of environment variables.
- [webrtc]: `SolicitOffer`/`ProvideOffer` now automatically select or allocate a video/audio stream when the client omits `videoStreams`/`audioStreams` (and their deprecated single-id counterparts), per the Matter specification's automatic stream selection for revision 1 clients. This is required to interoperate with Home Assistant's Matter camera integration ([home-assistant/core#176080](https://github.com/home-assistant/core/pull/176080)), which never allocates streams explicitly and expects the camera to select them on its own.

### Changed

- [webrtc]: Offer/Answer invokes now address the peer's `WebRtcTransportRequestor` directly using the peer node id captured from the session (matching matter.js's OTA Provider/Requestor pattern), instead of the Binding cluster.
- [webrtc]: Improved ICE candidate handling and WebRTC session logging, including logging why the peer's `WebRtcTransportRequestor` endpoint couldn't be resolved (previously a silent failure), and closing dangling WebRTC sessions left open when the requestor is unreachable.
- [camera]: Document in the JSDoc that the CameraAvStreamManagement Snapshot feature is implemented.
- [snapshot camera]: Document the CameraAvStreamManagement features implemented in the JSDoc.

### Fixed

- [webrtc]: `ProvideOfferResponse`/`SolicitOfferResponse` now echo back the deprecated `videoStreamId`/`audioStreamId` fields when the request used them, as required by the Matter specification's conformance rules. Revision 1 clients (e.g. Home Assistant) send these fields as `null` to request automatic stream selection, and rely on the echoed value to learn which stream was selected; without it, they could not determine that a stream had in fact been negotiated.
- [camera]: Fix `Camera` to provide default `snapshotCapabilities` and `allocatedSnapshotStreams` values for the CameraAvStreamManagement Snapshot feature, which was enabled but left the `SnapshotCapabilities` attribute as an empty list.
- [snapshot]: `CaptureSnapshot` calibration cards were 480×270 and 960×540, which don't match any standard camera resolution. Regenerated the two cards as basic SMPTE color-bars test patterns (mires) at 640×480 and 1280×720 1920-1080, matching the resolutions the webcam capture path actually negotiates. `Camera` and `SnapshotCamera` now default `snapshotCapabilities` to advertise all three resolutions, since `CaptureSnapshot` can genuinely serve a matching calibration card for each.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.3] - 2026-07-17

### Breaking changes

- [matterbridge]: Require Matterbridge 3.10.0.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.2] - 2026-07-15

### Breaking changes

- [matterbridge]: Require Matterbrdige 3.9.5 (from 3.9.5-git-623095608a9ab3f792c80e288cf236e0b5de878a).
- [DevContainer]: Bump DevContainer config v.1.1.0. Rebuild the container.

### Added

- [Snapshot]: Add JPEG television color and geometry calibration cards for snapshot testing.
- [WebRTC]: Add deterministic H.264, Opus, and MP4 media fixtures for WebRTC stream testing.
- [WebRTC]: Add a Vitest integration test covering a complete local `werift` client/server negotiation and data-channel flow.
- [doorbell]: Add the Doorbell device type with the required Identify, Switch (MomentarySwitch feature) and Chime client clusters, and Power Source support.
- [chime]: Add validation in `MatterbridgeChimeServer.playChimeSound` to reject a `chimeId` that is not present in `installedChimeSounds` with a `NotFound` status response.
- [snapshot camera]: Add the Snapshot Camera device with configurable snapshot capabilities, stream allocation, stream priorities, snapshot capture, Identify, and Power Source support.
- [snapshot camera]: Add `MatterbridgeCameraAvStreamManagementServer` with the Snapshot and Image Control features.

### Changed

- [WebRTC]: Transfer the MP4 camera fixture over the werift data channel and verify its reconstructed SHA-256 hash.
- [Snapshot]: Return `assets/camera-color-test.jpeg` from `CaptureSnapshot` instead of the embedded mire image.
- [chime]: Document the Chime device features in the README.
- [snapshot camera]: Document the Snapshot Camera device features in the README.
- [agents]: Update agents instructions.

### Fixed

- [chime]: Fixed `Chime` to omit the `powerSource` device type when `powerSourceType` is `'None'`.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.1] - 2026-07-13

- First published release.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->

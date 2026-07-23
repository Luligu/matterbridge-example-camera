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

## [0.0.7] - Dev branch

### Added

- [tests]: Add `vitest/webrtc/weriftSession.test.ts` coverage for the audio track injection path in `WeriftWebRtcSession`: an SDP answer without an injectable audio codec when the remote offer only supports PCMU, skipping non-audio transceivers when selecting the preferred audio codec, only adjusting the audio transceiver(s) that actually negotiated the preferred codec, the `MATTERBRIDGE_CAMERA_DISABLE_TEST_AUDIO=1` toggle, a missing ffmpeg dependency on the audio path, and not re-attaching a test-audio track on a subsequent `createAnswer`. `weriftSession.ts` is back to 100% statement/branch/function/line coverage. Also mark the audio generator's spawn-error handler, its catch block, and the unreachable `adjustedTransceivers === 0` branch in `preferAudioCodecOnTransceivers` as `v8 ignore`, mirroring the already-ignored video counterparts for the same reasons (child-process/werift-internals mocking, and a mimeType that's always found on at least one transceiver).
- [ptz camera]: Add the PTZ Camera device type. Same device type and Camera AV Stream Management/WebRtcTransportProvider wiring as the standalone `Camera` device, plus the Camera AV Settings User Level Management cluster with the MechanicalPan, MechanicalTilt and MechanicalZoom features, implementing the `MPTZSetPosition` (absolute move, rejecting out-of-range pan/tilt/zoom with a ConstraintError) and `MPTZRelativeMove` (relative move, clamped to the configured range) commands.
- [behaviors]: Add `src/behaviors/cameraAvSettingsUserLevelManagementServer.ts` with `MatterbridgeCameraAvSettingsUserLevelManagementServer`.
- [platform]: Register a PTZ Camera example device in `onStart`.
- [tests]: Add `vitest/devices/ptzCamera.test.ts` and `vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts`; extend `vitest/module.test.ts` device-count assertions for the new device.
- [docs]: Document the PTZ Camera device type in the README.
- [platform]: Add log of config.
- [platform]: Add animation interval in 10 phases.
- [doorbell]: Add use of cluster client Chime of Server Doorbell in the animation. It needs the Server Doorbell and Server Chime to be paired and a binding in Matter Server dashboard from Server Doorbell Chime client cluster to Server Chime Chime server cluster: [bindings](screenshots/bindings.png).
- [chip-test]: Add full shell script to run the chip tests.

### Fixed

- [webrtc]: `createAnswer()` no longer calls `ensureTestAudioTrack()` when the remote offer negotiated no injectable audio codec (e.g. PCMU-only). Previously it still ran with an `undefined` codec and silently defaulted to Opus/payload type 111, injecting RTP the peer never negotiated.

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

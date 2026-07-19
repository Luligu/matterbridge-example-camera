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

## [0.0.4] - Dev branch

### Added

- [webrtc]: `WebRtcTransportProvider` now negotiates real SDP offers/answers through a werift `RTCPeerConnection` (`WeriftWebRtcSession`) instead of a placeholder SDP string, and applies real ICE candidates and connection teardown.
- [webrtc]: Injects a real video track into the negotiated connection via ffmpeg, so the media path can be validated end to end without a physical camera. Defaults to a synthetic SMPTE bars test pattern, or captures from a real local webcam (`MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam`, `MATTERBRIDGE_CAMERA_WEBCAM_DEVICE`) at 640x480/1280x720/1920x1080, following the resolution the client actually allocated via `CameraAvStreamManagement.VideoStreamAllocate`. See the README for the full list of environment variables.

- [webrtc]: `SolicitOffer`/`ProvideOffer` now automatically select or allocate a video/audio stream when the client omits `videoStreams`/`audioStreams` (and their deprecated single-id counterparts), per the Matter specification's automatic stream selection for revision 1 clients. This is required to interoperate with Home Assistant's Matter camera integration ([home-assistant/core#176080](https://github.com/home-assistant/core/pull/176080)), which never allocates streams explicitly and expects the camera to select them on its own.

### Changed

- [webrtc]: Offer/Answer invokes now address the peer's `WebRtcTransportRequestor` directly using the peer node id captured from the session (matching matter.js's OTA Provider/Requestor pattern), instead of the Binding cluster.
- [webrtc]: Improved ICE candidate handling and WebRTC session logging, including logging why the peer's `WebRtcTransportRequestor` endpoint couldn't be resolved (previously a silent failure), and closing dangling WebRTC sessions left open when the requestor is unreachable.

### Fixed

- [webrtc]: `ProvideOfferResponse`/`SolicitOfferResponse` now echo back the deprecated `videoStreamId`/`audioStreamId` fields when the request used them, as required by the Matter specification's conformance rules. Revision 1 clients (e.g. Home Assistant) send these fields as `null` to request automatic stream selection, and rely on the echoed value to learn which stream was selected; without it, they could not determine that a stream had in fact been negotiated.

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

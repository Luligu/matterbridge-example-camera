# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge camera example plugin

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

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This repository is used to create all Camera Device Types in chapter 16 of Matter specs 1.6.0.

## Setup

- `src/module.ts` will create all device types for easy testing;
- `src/devices/` contains all single class device types (it will be moved directly in matterbridge core package).
- `src/behaviors/` contains all required behaviors (it will be moved directly in matterbridge core package).

## Supported device types

### Chime

Features:

- Exposes the Chime cluster with a configurable list of installed chime sounds, playable via the PlayChimeSound command.
- Supports selecting a chime sound with the SelectedChime attribute or by passing a chimeId to the PlayChimeSound command.
- Validates the requested chimeId against the InstalledChimeSounds list and rejects unknown ids with a NotFound response.
- Emits the ChimeStartedPlaying event when a chime sound starts playing.
- Chime sounds can be enabled or disabled with the Enabled attribute.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

### Doorbell

Features:

- Exposes the Switch cluster with the MomentarySwitch feature only, as required by the Matter specification for this device type.
- Adds the required Chime client cluster automatically via `addRequiredClusters()`, so a bound Chime device can be triggered when the doorbell button is pressed.
- Supports simulating a button press with `triggerSwitchEvent('Single', ...)`.
- Identify cluster is always created (it is a required server cluster for this device type), with configurable identify time and type.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

### Camera

Features:

- Exposes the Camera AV Stream Management cluster with the Video, Audio and ImageControl features (the Snapshot feature is not implemented in this example; see Snapshot Camera).
- Exposes the WebRtcTransportProvider cluster and registers a WebRtcTransportRequestor client, so a bound device can solicit and receive WebRTC offers.
- Automatically selects or allocates a video/audio stream when a client's `SolicitOffer`/`ProvideOffer` omits `videoStreams`/`audioStreams` (and their deprecated single-id counterparts), per the Matter specification's automatic stream selection for revision 1 clients. This is required to interoperate with clients that never allocate streams explicitly, such as Home Assistant's Matter camera integration.
- Supports configurable stream usages and priorities, encoder limits, video sensor parameters, viewport, rate-distortion trade-off points, and microphone capabilities.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

### Snapshot Camera

Features:

- Exposes the Camera AV Stream Management cluster with the Snapshot and Image Control features.
- Supports configurable snapshot capabilities, encoder limits, content buffer size, and network bandwidth.
- Supports configuring stream usages and their priority order with the SetStreamPriorities command.
- Allocates and deallocates snapshot streams with generated stream identifiers.
- Captures snapshots using a requested stream or automatic stream selection and returns the requested resolution as JPEG data.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

## WebRTC test video injection

`WeriftWebRtcSession` (see `src/webrtc/weriftSession.ts`) wraps a real werift `RTCPeerConnection` for each WebRtcTransportProvider session (see `MatterbridgeWebRtcTransportProviderServer` in `src/behaviors/webRtcTransportProviderServer.ts`), so the session's SDP offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded. It can also inject a real ffmpeg-generated video track into the negotiated connection, so the end-to-end media path can be validated without a real camera capture pipeline.

The video source defaults to a synthetic SMPTE bars test pattern, or can be switched to a real local webcam. Configure it with environment variables:

- `MATTERBRIDGE_CAMERA_DISABLE_TEST_VIDEO=1`: disables video injection entirely (only the negotiated transceiver is created, with no track attached).
- `MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam`: capture from a local webcam via ffmpeg instead of the SMPTE bars test pattern. Requires `MATTERBRIDGE_CAMERA_WEBCAM_DEVICE`; falls back to the test pattern (with a warning) if unset.
- `MATTERBRIDGE_CAMERA_WEBCAM_DEVICE=<device>`: the OS-specific ffmpeg device identifier — e.g. `/dev/video0` on Linux (v4l2), an avfoundation index such as `0` on macOS, or a device name such as `Integrated Camera` on Windows (dshow).
- `MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION=<width>x<height>`: default webcam capture resolution — `640x480` (default), `1280x720`, or `1920x1080`. Falls back to `640x480` (with a warning) for unsupported values. The actual achievable frame rate depends on the webcam and can be much lower than 30 FPS at higher resolutions (check with `v4l2-ctl -d <device> --list-formats-ext` on Linux).

A real client's resolution/quality picker (e.g. in Home Assistant) takes precedence over `MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION`: it allocates a video stream with `CameraAvStreamManagement.VideoStreamAllocate` before soliciting or providing a WebRTC offer, and `MatterbridgeWebRtcTransportProviderServer` looks up that stream's `maxResolution` to select the webcam capture resolution for the session. `MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION` is used when no matching allocated stream is found, or when the requested resolution isn't one of the three supported above.

Requires `ffmpeg` to be installed and reachable on `PATH` (or under `/usr/bin`, `/bin`, or `/usr/local/bin`).

Example, capturing from a real Linux webcam at 720p:

```bash
MATTERBRIDGE_CAMERA_VIDEO_SOURCE=webcam MATTERBRIDGE_CAMERA_WEBCAM_DEVICE=/dev/video0 MATTERBRIDGE_CAMERA_WEBCAM_RESOLUTION=1280x720 npm start
```

## Werift integration test

The `vitest/werift.test.ts` integration test creates local client and server peers and verifies SDP offer/answer negotiation, ICE candidate exchange, a bidirectional data-channel transfer, and connection teardown with `werift`.

The test uses the client as the Matter controller and the server as the camera device. Its signaling flow is:

```text
Controller/client                         Camera/server
      |                                        |
      |---------- SDP offer ----------------->|
      |------ client ICE candidates --------->|
      |<--------- SDP answer -----------------|
      |<------ server ICE candidates ---------|
      |                                        |
      |<======= ICE + DTLS connected =========>|
      |<======= SCTP data channel =============>|
      |                                        |
      |---------- start-live-view ------------>|
      |<--------- live-view-started -----------|
      |                                        |
      |<=========== close peers ===============>|
```

Legend:

- **SDP — Session Description Protocol:** describes the media session, including codecs, formats, transport parameters, and how each peer expects to communicate. The controller sends an SDP offer and the camera returns an SDP answer.
- **ICE — Interactive Connectivity Establishment:** discovers and tests possible network paths between the peers. ICE candidates contain addresses and ports that may be used to establish the direct WebRTC connection.
- **DTLS — Datagram Transport Layer Security:** authenticates the peers and encrypts communication over the selected UDP network path. WebRTC uses the negotiated DTLS connection to protect subsequent media and data transport.
- **SCTP — Stream Control Transmission Protocol:** transports WebRTC data-channel messages over the secure DTLS connection. In this test, it carries `start-live-view` and `live-view-started` between the controller and camera.

`createOffer()` and `createAnswer()` produce the SDP descriptions. Applying each local description gathers that peer's ICE candidates. After each peer receives the other peer's description and candidates, werift selects a network path, performs the DTLS handshake, and opens the SCTP data channel. The two control messages prove that data can travel in both directions. The camera peer then sends `assets/test-camera.mp4` to the controller in 16 KiB binary chunks; the test reconstructs it and compares its byte length and SHA-256 hash before closing both peers.

In the camera implementation, Matter's WebRTC Transport Provider and Requestor clusters are responsible for carrying the SDP and ICE signaling between devices. The resulting WebRTC connection carries the media or data directly; Matter does not carry the WebRTC payload itself. This test validates werift independently and does not yet connect it to `MatterbridgeWebRtcTransportProviderServer`.

Run it with:

```bash
npm run test -- vitest/werift.test.ts
```

### Media test assets

The `assets` directory contains deterministic three-second media fixtures for extending the werift test to real media tracks:

- `test-video.h264`: raw H.264 Constrained Baseline video, 640×360 at 15 FPS, with a moving test pattern. Use this elementary stream when implementing H.264 NAL-unit parsing and RTP packetization.
- `test-audio.opus`: Ogg container with mono Opus audio at 48 kHz and 64 kbit/s, containing a 1 kHz test tone. Use the Opus packets for an audio RTP track; the Ogg container itself is not sent over WebRTC.
- `test-camera.mp4`: playable reference containing the same 640×360 H.264 test pattern and a mono 1 kHz AAC track. The werift test transfers the complete file over its SCTP data channel and verifies its integrity. This exercises binary file transport, not a WebRTC video RTP track.
- `camera-color-test-1920-1080.jpeg`: 1920×1080 broadcast-style snapshot calibration card returned by the example's `CaptureSnapshot` command. It contains color bars, grayscale references, geometry targets, focus patterns, safe-area guides, and near-black/near-white patches for inspecting hue, saturation, brightness, contrast, geometry, overscan, and focus.
- `camera-color-test-1280-720.jpeg`: 1280×720 SMPTE color-bars test pattern (mire) returned by the example's `CaptureSnapshot` command, generated with `ffmpeg -f lavfi -i smptebars=size=1280x720`.
- `camera-color-test-640-480.jpeg`: 640×480 SMPTE color-bars test pattern (mire) returned by the example's `CaptureSnapshot` command, generated with `ffmpeg -f lavfi -i smptebars=size=640x480`.

WebRTC media tracks transport encoded H.264 or Opus frames in RTP packets; they do not send an MP4, Ogg, or MPEG container directly. The current MP4 transfer deliberately uses the separate data-channel path. A future video-track test should parse the relevant elementary frames, packetize them as RTP, call werift's media track `writeRtp()`, and verify reception through `onTrack` and `onReceiveRtp`.

## Chip tests

```bash
docker rm matterbridge-chip-test-hub -f && docker pull luligu/matterbridge:chip-test && docker run -dit --network matterbridge --restart always --stop-timeout 60 --name matterbridge-chip-test-hub -p 8283:8283 -v "%USERPROFILE%/GitHub/matterbridge-example-camera/temp:/tmp/matter_testing/logs" luligu/matterbridge:chip-test
docker logs -f matterbridge-chip-test-hub --tail 1000
docker exec -it matterbridge-chip-test-hub bash
```

```bash
# Generic device composition and conformance
python3 src/python_testing/TC_DeviceBasicComposition.py
python3 src/python_testing/TC_DeviceConformance.py --bool-arg allow_provisional:true
python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true

# Doorbell mandatory Switch server
python3 src/python_testing/TC_SWTCH.py

# Chime cluster
python3 src/python_testing/TC_CHIME_2_2.py
python3 src/python_testing/TC_CHIME_2_3.py
python3 src/python_testing/TC_CHIME_2_5.py
python3 src/python_testing/TC_CHIME_2_6.py

# Camera AV Stream Management
python3 src/python_testing/TC_AVSM_2_1.py
python3 src/python_testing/TC_AVSM_2_2.py
python3 src/python_testing/TC_AVSM_2_3.py
python3 src/python_testing/TC_AVSM_2_4.py
python3 src/python_testing/TC_AVSM_2_5.py
python3 src/python_testing/TC_AVSM_2_6.py
python3 src/python_testing/TC_AVSM_2_7.py
python3 src/python_testing/TC_AVSM_2_8.py
python3 src/python_testing/TC_AVSM_2_9.py
python3 src/python_testing/TC_AVSM_2_10.py
python3 src/python_testing/TC_AVSM_2_11.py
python3 src/python_testing/TC_AVSM_2_12.py
python3 src/python_testing/TC_AVSM_2_13.py
python3 src/python_testing/TC_AVSM_2_14.py
python3 src/python_testing/TC_AVSM_2_15.py
python3 src/python_testing/TC_AVSM_2_16.py
python3 src/python_testing/TC_AVSM_2_17.py
python3 src/python_testing/TC_AVSM_2_18.py
python3 src/python_testing/TC_AVSM_2_19.py
python3 src/python_testing/TC_AVSM_2_20.py
python3 src/python_testing/TC_AVSM_2_21.py

# Additional Camera AV Stream Management tests
python3 src/python_testing/TC_AVSM_StreamReuseRangeParams.py
python3 src/python_testing/TC_AVSM_VideoStreamsPersistence.py

# Audio/Video Stream Usage Management
python3 src/python_testing/TC_AVSUM_2_1.py
python3 src/python_testing/TC_AVSUM_2_2.py
python3 src/python_testing/TC_AVSUM_2_3.py
python3 src/python_testing/TC_AVSUM_2_4.py
python3 src/python_testing/TC_AVSUM_2_5.py
python3 src/python_testing/TC_AVSUM_2_6.py
python3 src/python_testing/TC_AVSUM_2_7.py
python3 src/python_testing/TC_AVSUM_2_8.py
python3 src/python_testing/TC_AVSUM_2_9.py

# Push AV Stream Transport
python3 src/python_testing/TC_PAVST_2_1.py
python3 src/python_testing/TC_PAVST_2_2.py
python3 src/python_testing/TC_PAVST_2_3.py
python3 src/python_testing/TC_PAVST_2_4.py
python3 src/python_testing/TC_PAVST_2_5.py
python3 src/python_testing/TC_PAVST_2_6.py
python3 src/python_testing/TC_PAVST_2_7.py
python3 src/python_testing/TC_PAVST_2_8.py
python3 src/python_testing/TC_PAVST_2_9.py
python3 src/python_testing/TC_PAVST_2_10.py
python3 src/python_testing/TC_PAVST_2_11.py
python3 src/python_testing/TC_PAVST_2_12.py
python3 src/python_testing/TC_PAVST_2_13.py

# WebRTC Transport Provider
python3 src/python_testing/TC_WEBRTCP_2_1.py
python3 src/python_testing/TC_WEBRTCP_2_2.py
python3 src/python_testing/TC_WEBRTCP_2_3.py
python3 src/python_testing/TC_WEBRTCP_2_4.py
python3 src/python_testing/TC_WEBRTCP_2_5.py
python3 src/python_testing/TC_WEBRTCP_2_6.py
python3 src/python_testing/TC_WEBRTCP_2_7.py
python3 src/python_testing/TC_WEBRTCP_2_8.py
python3 src/python_testing/TC_WEBRTCP_2_9.py
python3 src/python_testing/TC_WEBRTCP_2_10.py
python3 src/python_testing/TC_WEBRTCP_2_11.py
python3 src/python_testing/TC_WEBRTCP_2_12.py
python3 src/python_testing/TC_WEBRTCP_2_13.py
python3 src/python_testing/TC_WEBRTCP_2_14.py
python3 src/python_testing/TC_WEBRTCP_2_15.py
python3 src/python_testing/TC_WEBRTCP_2_16.py
python3 src/python_testing/TC_WEBRTCP_2_17.py
python3 src/python_testing/TC_WEBRTCP_2_18.py
python3 src/python_testing/TC_WEBRTCP_2_19.py
python3 src/python_testing/TC_WEBRTCP_2_20.py
python3 src/python_testing/TC_WEBRTCP_2_21.py
python3 src/python_testing/TC_WEBRTCP_2_22.py
python3 src/python_testing/TC_WEBRTCP_2_23.py
python3 src/python_testing/TC_WEBRTCP_2_24.py
python3 src/python_testing/TC_WEBRTCP_2_25.py
python3 src/python_testing/TC_WEBRTCP_2_26.py
python3 src/python_testing/TC_WEBRTCP_2_27.py
python3 src/python_testing/TC_WEBRTCP_2_28.py
python3 src/python_testing/TC_WEBRTCP_2_29.py
python3 src/python_testing/TC_WEBRTCP_2_30.py
python3 src/python_testing/TC_WEBRTCP_2_31.py
python3 src/python_testing/TC_WEBRTCP_2_32.py

# Zone Management
python3 src/python_testing/TC_ZONEMGMT_2_4.py
```

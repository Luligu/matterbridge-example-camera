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
![under development](https://img.shields.io/badge/status-under%20development-orange)

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

## TODO

- Track matter.js PR #4128 (https://github.com/matter-js/matter.js/pull/4128) and, once merged and released in the consumed `@matter/*` version, remove the temporary ImageControl workaround used by Audio Doorbell and Intercom for CameraAvStreamManagement choice conformance.

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
- Allocates WebRTC session identifiers monotonically from 0 through 65534, wrapping to 0 and skipping identifiers that still belong to active sessions, as required by Matter 1.6.
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

### Audio Doorbell

Features:

- Exposes the Switch cluster with the MomentarySwitch feature only, as required by the Matter specification for this device type.
- Exposes the Camera AV Stream Management cluster with the Audio feature only (the Video and Snapshot features are not present, per the Matter specification for this device type; see Camera for a device implementing those).
- Exposes the WebRtcTransportProvider cluster and registers a WebRtcTransportRequestor client, so a bound controller can solicit and receive WebRTC offers, same as Camera.
- Adds the required Chime client cluster automatically via `addChimeClient`, so a bound Chime device can be triggered when the doorbell button is pressed.
- Identify cluster is always created (it is a required server cluster for this device type), with configurable identify time and type.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- Deviation from the Matter specification: the CameraAvStreamManagement ImageControl feature is also enabled, even though the specification only allows it when Video or Snapshot is present, to work around a matter.js bug where the ImageRotation/ImageFlipHorizontal/ImageFlipVertical "at least one shall be present" choice conformance is enforced unconditionally instead of only when ImageControl is enabled (see the JSDoc in `src/devices/audioDoorbell.ts`).

### Floodlight Camera

Features:

- A composite device type, always defined via endpoint composition: the root endpoint exposes Basic Information and, unless disabled, a Power Source cluster; the mandatory Camera child endpoint and the mandatory On/Off Light child endpoint required by the Matter specification for this device type are both created automatically by the constructor. The Camera child is wired the same way as the standalone Camera device (CameraAvStreamManagement with the Video, Audio, Snapshot and ImageControl features, and the WebRtcTransportProvider cluster and WebRtcTransportRequestor client). Each light gets its own Identify and OnOff (Lighting feature) cluster servers.
- Exposes `addLight()` to add further On/Off Light child endpoints beyond the mandatory one, with an optional tagList for disambiguation when more than one light is present.
- Configurable Power Source cluster type on the root endpoint: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- The Camera child endpoint's Identify and CameraAvStreamManagement configuration can be customized via the `cameraOptions` constructor option, using the same fields and defaults as the standalone Camera device. The mandatory light's name, tagList, and initial state can be customized via the `lightOptions` constructor option.

### Intercom

Features:

- Exposes the Camera AV Stream Management cluster with the Audio and Speaker features (the Video and Snapshot features are not present, per the Matter specification for this device type; see Camera for a device implementing those). The Speaker feature is what makes an Intercom genuinely two-way: unlike Audio Doorbell, it can both capture and play back audio. Configurable speaker capabilities (codec, sample rates, channels) and two-way talk support (NotSupported, HalfDuplex, FullDuplex; default FullDuplex).
- Unlike Camera and Audio Doorbell, an Intercom both hosts and invokes WebRtcTransportProvider and WebRtcTransportRequestor: it exposes both cluster servers, and registers both as client clusters via `addWebRtcTransportProviderClient`/`addWebRtcTransportRequestorClient`, so it can both receive and solicit WebRTC offers to/from a peer intercom.
- Adds the optional Chime client cluster automatically via `addChimeClient`, so a bound Chime device can be triggered.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- Deviation from the Matter specification: the CameraAvStreamManagement ImageControl feature is also enabled, even though the specification only allows it when Video or Snapshot is present, to work around the same matter.js bug described above for Audio Doorbell.

#### Pairing two Intercoms for two-way calling

`src/module.ts` registers exactly this pair for testing: `Intercom 1` (bridged, under the Matterbridge aggregator) and `Intercom 2` (`mode: 'server'`, its own Matter node) — commission both and follow the steps below to bind them together.

`Intercom 2` has to be `mode: 'server'` rather than a second bridged endpoint: peer resolution (see below) identifies the caller from the `peerNodeId`/`fabricIndex` of the command's CASE session, and a CASE session only exists between two distinct node identities on the fabric. Two bridged endpoints share the bridge's single node identity, so there is no CASE session, Binding, or ACL between them to test — invoking one from the other would just be a local, in-process behavior call. `mode: 'server'` is what gives an endpoint its own independent Matter node, which is what a real second, physical Intercom would be.

Unlike a Doorbell/Chime pair, where only the Doorbell invokes commands on the Chime, an Intercom both hosts (server) and invokes (client) WebRtcTransportProvider and WebRtcTransportRequestor (see `#resolvePeerRequestorEndpoint` in `src/behaviors/webRtcTransportProviderServer.ts`). Once a peer invokes SolicitOffer/ProvideOffer on an Intercom's WebRtcTransportProvider, that Intercom resolves the caller's WebRtcTransportRequestor endpoint directly from the invoking peer's node id/fabric index carried by the command's CASE session — not via the Binding cluster — so the Offer/Answer "return leg" needs no binding of its own. Only the initiating invoke needs one.

So, to let either Intercom 1 or Intercom 2 start a call, on the fabric they share (commission both onto the same controller/ecosystem first, e.g. via chip-tool, Apple Home, or Google Home):

1. **Binding on 1 → 2**, so Intercom 1 knows where to send SolicitOffer/ProvideOffer. Binding on 2 → 1 is the mirror, for the other direction:

   ```bash
   chip-tool binding write binding '[{"fabricIndex": 1, "node": <NODE_ID_2>, "endpoint": <ENDPOINT_2>, "cluster": 1363}]' <NODE_ID_1> <ENDPOINT_1>
   chip-tool binding write binding '[{"fabricIndex": 1, "node": <NODE_ID_1>, "endpoint": <ENDPOINT_1>, "cluster": 1363}]' <NODE_ID_2> <ENDPOINT_2>
   ```

   `1363` (`0x553`) is the WebRtcTransportProvider cluster id; `<ENDPOINT_1>`/`<ENDPOINT_2>` are each Intercom's endpoint number (find them from the commissioning output or the Matterbridge frontend).

2. **ACL on 2 granting 1**, and **ACL on 1 granting 2**, Operate access to both WebRtcTransportProvider (`1363`) and WebRtcTransportRequestor (`1364`, `0x554`) — Intercom 1 needs it on 2 for the initiating invoke, and Intercom 2 needs it on 1 for the return invoke, regardless of who starts the call:

   ```bash
   chip-tool accesscontrol write acl '[
     {"fabricIndex": 1, "privilege": 5, "authMode": 2, "subjects": [<ADMIN_NODE_ID>], "targets": null},
     {"fabricIndex": 1, "privilege": 3, "authMode": 2, "subjects": [<NODE_ID_1>], "targets": [{"cluster": 1363, "endpoint": null, "deviceType": null}, {"cluster": 1364, "endpoint": null, "deviceType": null}]}
   ]' <NODE_ID_2> 0

   chip-tool accesscontrol write acl '[
     {"fabricIndex": 1, "privilege": 5, "authMode": 2, "subjects": [<ADMIN_NODE_ID>], "targets": null},
     {"fabricIndex": 1, "privilege": 3, "authMode": 2, "subjects": [<NODE_ID_2>], "targets": [{"cluster": 1363, "endpoint": null, "deviceType": null}, {"cluster": 1364, "endpoint": null, "deviceType": null}]}
   ]' <NODE_ID_1> 0
   ```

   The ACL attribute is a full replace, not a merge: keep the existing Administer entry for `<ADMIN_NODE_ID>` (your controller/commissioner) in the list, or you lock yourself out of that node.

With both directions in place, either Intercom can call the other; a call initiated the other way only needs its own binding/ACL pair, already covered above since both were set up symmetrically.

## WebRTC test video injection

`WeriftWebRtcSession` (see `src/webrtc/weriftSession.ts`) wraps a real werift `RTCPeerConnection` for each WebRtcTransportProvider session (see `MatterbridgeWebRtcTransportProviderServer` in `src/behaviors/webRtcTransportProviderServer.ts`), so the session's SDP offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded. It can also inject a real ffmpeg-generated video track into the negotiated connection, so the end-to-end media path can be validated without a real camera capture pipeline.

The platform configuration controls WebRTC video injection with these properties:

- `generator` is required and accepts `none`, `test`, or `webcam`. It defaults to `none`, which negotiates the video transceiver without attaching a track. `test` injects a synthetic moving test pattern, while `webcam` captures from the configured local webcam.
- `webcam` is optional and has no default. It contains the OS-specific ffmpeg device identifier — e.g. `/dev/video0` on Linux (v4l2), an avfoundation index such as `0` on macOS, or a device name such as `Integrated Camera` on Windows (dshow). Selecting the `webcam` generator without this property falls back to the test pattern with a warning.
- `webcamResolution` is required and accepts `640x480`, `1280x720`, or `1920x1080`. It defaults to `640x480`. The actual achievable frame rate depends on the webcam and can be much lower than 30 FPS at higher resolutions (check with `v4l2-ctl -d <device> --list-formats-ext` on Linux).

A real client's resolution/quality picker (e.g. in Home Assistant) takes precedence over `webcamResolution`: it allocates a video stream with `CameraAvStreamManagement.VideoStreamAllocate` before soliciting or providing a WebRTC offer, and `MatterbridgeWebRtcTransportProviderServer` looks up that stream's `maxResolution` to select the webcam capture resolution for the session. `webcamResolution` is used when no matching allocated stream is found, or when the requested resolution isn't one of the three supported above.

Requires `ffmpeg` to be installed. The resolver checks the system command and common installation directories on Linux, macOS, and Windows.

Use ffmpeg itself to list the available capture devices and find the right value for `webcam`:

- Linux (v4l2): `v4l2-ctl --list-devices` (from `v4l-utils`), or `ls /dev/video*`.
- macOS (avfoundation): `ffmpeg -f avfoundation -list_devices true -i dummy` — video devices are listed with their index, e.g. `[0] FaceTime HD Camera`; use that index (e.g. `0`) as the device value.
- Windows (dshow): `ffmpeg -f dshow -list_devices true -i dummy` — video devices are listed by name under "DirectShow video devices", e.g. `"Integrated Camera"`; use that exact name as the device value.

Example configuration for a real Linux webcam at 720p:

```json
{
  "generator": "webcam",
  "webcam": "/dev/video0",
  "webcamResolution": "1280x720"
}
```

Example, capturing from a real Windows webcam at 720p:

```json
{
  "generator": "webcam",
  "webcam": "Integrated Camera",
  "webcamResolution": "1280x720"
}
```

### Known limitation: mDNS ICE candidates can't be resolved across a Docker Desktop host boundary

When matterbridge runs in a container (e.g. via Docker Desktop on Windows/macOS) and the WebRTC-consuming page runs in a browser on the host machine — for example the matterjs-server dashboard — `provideIceCandidates` can fail every candidate with `ICE candidate apply timeout after 5000ms`, even though matterbridge and the Matter controller container can reach each other fine.

The cause: Chromium-based browsers (Edge, Chrome) hide the page's real local IP behind a random `<uuid>.local` mDNS name in ICE host candidates by default. Resolving that name requires a real multicast DNS query/response over the LAN (see the Firefox limitation above). Docker Desktop's virtualized networking (WSL2/Hyper-V) does not forward multicast traffic between a container's network and the Windows/macOS host, so matterbridge's mDNS query for the browser's candidate name never reaches the browser, and the candidate can never resolve — no matter how the container networking is otherwise configured.

Packet captures confirm this: the query correctly leaves the matterbridge container and even reaches other containers on the same Docker network, but never reaches a browser running on the host, and no reply is ever seen.

The fix is on the browser side, not in this plugin: disable mDNS obfuscation of local ICE candidates so the browser advertises its real LAN IP instead of a `.local` name, which skips mDNS resolution entirely.

- **Edge**: go to `edge://flags/#enable-webrtc-hide-local-ips-with-mdns`, set **"Anonymize local IPs exposed by WebRTC"** to **Disabled**, then relaunch the browser.
- **Chrome**: the same flag is at `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns`.
- **Firefox**: open `about:config` and set `media.peerconnection.ice.obfuscate_host_addresses` to `false`. Note this alone may not be enough — per the Firefox limitation above, Firefox can still fall back to a useless link-local address on a non-secure-context page even with this preference disabled, so the page also needs to be served over HTTPS or via `localhost`.

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
- `camera-color-1920-1080.jpeg`: 1920×1080 simplified ffmpeg-generated color-rectangle snapshot returned by the example's `CaptureSnapshot` command.
- `camera-color-1280-720.jpeg`: 1280×720 simplified ffmpeg-generated color-rectangle snapshot returned by the example's `CaptureSnapshot` command.
- `camera-color-640-480.jpeg`: 640×480 simplified ffmpeg-generated color-rectangle snapshot returned by the example's `CaptureSnapshot` command.
- `camera-color-test-1920-1080.jpeg`, `camera-color-test-1280-720.jpeg`, `camera-color-test-960-540.jpeg`, `camera-color-test-640-480.jpeg`, and `camera-color-test-480-270.jpeg`: additional SMPTE color-bars snapshot fixtures.

#### Why the snapshot calibration cards stay under ~64 KB

All three calibration cards above are kept well under the Matter message size ceiling, which caps at **65535 bytes** for a single message and cannot be worked around by tuning TCP:

- Every Matter message is encrypted with AES-128-CCM, using a 13-byte nonce built from the security flags, message counter, and node ID (`Session.generateNonce`, part of the Matter message-security spec, not a matter.js choice).
- AES-CCM (RFC 3610 / NIST SP 800-38C) requires the nonce length `N` and the length-field size `L` to satisfy `N + L = 15` bytes for a 128-bit block cipher. With `N = 13`, that leaves `L = 2`.
- A 2-byte length field caps the plaintext of a single CCM-encrypted message at `2^16 - 1 = 65535` bytes — a cryptographic ceiling, not a networking one. matter.js's `DEFAULT_MAX_TCP_MESSAGE_SIZE` (64000) is just a round number kept safely under that limit.

A `CaptureSnapshot` response whose `data` field doesn't fit fails to send: the client gets a generic invoke failure instead of an image, since the encoder cannot represent the required plaintext length in the message header. `CameraAvStreamManagement.CaptureSnapshot` returns its image as a single field of a single command response, so it inherits this ceiling directly. Matter has a dedicated mechanism for transferring larger payloads — BDX (Bulk Data Exchange), used for OTA updates and diagnostic logs — which splits big content across a sequence of acknowledged messages instead of one oversized one, but `CaptureSnapshot` doesn't use it.

WebRTC media tracks transport encoded H.264 or Opus frames in RTP packets; they do not send an MP4, Ogg, or MPEG container directly. The current MP4 transfer deliberately uses the separate data-channel path. A future video-track test should parse the relevant elementary frames, packetize them as RTP, call werift's media track `writeRtp()`, and verify reception through `onTrack` and `onReceiveRtp`.

## Chip tests

```bash
docker rm matterbridge-chip-test-hub -f && docker pull luligu/matterbridge:chip-test && docker run -dit --network matterbridge --restart always --stop-timeout 60 --name matterbridge-chip-test-hub -p 8283:8283 -v "C:/Users/your-user/GitHub/matterbridge-example-camera/temp:/tmp/matter_testing/logs" luligu/matterbridge:chip-test
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

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

It also tests the client cluster interaction.

## Credit

Thanks to [Ludovic BOUÉ](https://github.com/lboue) for his contributions to this project (and many others).

## Setup

- `src/module.ts` will create all device types for easy testing;
- `src/devices/` contains all single class device types (it will be moved directly in matterbridge core package).
- `src/behaviors/` contains all required behaviors (it will be moved directly in matterbridge core package).

## Requirements

Requires Matterbridge `3.10.3` or later.

Requires [`ffmpeg`](https://ffmpeg.org/) to be installed on the host or in the container. The resolver checks the system command and common installation directories on Linux, macOS, and Windows.

Install it with the platform's package manager:

### Linux (Debian/Ubuntu)

If you run in a container, install it in the same way.

```bash
sudo apt update && sudo apt install -y ffmpeg
```

### Windows

```powershell
winget install --id Gyan.FFmpeg -e
```

### macOS

```bash
brew install ffmpeg
```

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

- Exposes the Camera AV Stream Management cluster with the Video, Audio, Snapshot and ImageControl features.
- Exposes the WebRtcTransportProvider cluster and registers a WebRtcTransportRequestor client, so a bound device can solicit and receive WebRTC offers.
- Allocates WebRTC session identifiers monotonically from 0 through 65534, wrapping to 0 and skipping identifiers that still belong to active sessions, as required by Matter 1.6.
- Automatically selects or allocates a video/audio stream when a client's `SolicitOffer`/`ProvideOffer` omits `videoStreams`/`audioStreams` (and their deprecated single-id counterparts), per the Matter specification's automatic stream selection for revision 1 clients. This is required to interoperate with clients that never allocate streams explicitly, such as Home Assistant's Matter camera integration.
- Supports configurable stream usages and priorities, encoder limits, video sensor parameters, viewport, rate-distortion trade-off points, and microphone capabilities.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- Additionally exposes the Camera AV Settings User Level Management cluster with the MechanicalPan, MechanicalTilt and MechanicalZoom features, so a controller can move the camera to an absolute pan/tilt/zoom position (`MPTZSetPosition`) or by a relative delta (`MPTZRelativeMove`). The MechanicalPresets and DigitalPtz features are not part of this example.
- `MPTZSetPosition` rejects an absolute pan, tilt, or zoom value outside of the configured range with a ConstraintError.
- `MPTZRelativeMove` adds the pan/tilt/zoom delta directly to the current position, clamping the result to the configured range instead of rejecting it, since a relative move is expected to just stop at the mechanical limit.
- Configurable pan (`panMin`/`panMax`), tilt (`tiltMin`/`tiltMax`) and zoom (`zoomMax`) ranges, and initial `mptzPosition`. Defaults: pan -170° to 170°, tilt -20° to 90°, zoom 1 to 10, starting position `{ pan: 0, tilt: 0, zoom: 1 }`.

Supported by:

- [Matterserver dashboard](screenshots/matterserver-camera.png)

- [Matterserver dashboard with MPTZ](screenshots/matterserver-ptz-camera.png)

### Snapshot Camera

Features:

- Exposes the Camera AV Stream Management cluster with the Snapshot feature.
- Supports configurable snapshot capabilities, encoder limits, content buffer size, and network bandwidth.
- Supports configuring stream usages and their priority order with the SetStreamPriorities command.
- Allocates and deallocates snapshot streams with generated stream identifiers.
- Captures snapshots using a requested stream or automatic stream selection and returns the requested resolution as JPEG data.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

Supported by:

- [Matterserver dashboard](screenshots/matterserver-snapshot-camera.png)

### Audio Doorbell

Features:

- Exposes the Switch cluster with the MomentarySwitch feature only, as required by the Matter specification for this device type.
- Exposes the Camera AV Stream Management cluster with the Audio feature only (the Video and Snapshot features are not present, per the Matter specification for this device type; see Camera for a device implementing those).
- Exposes the WebRtcTransportProvider cluster and registers a WebRtcTransportRequestor client, so a bound controller can solicit and receive WebRTC offers, same as Camera.
- Adds the required Chime client cluster automatically via `addChimeClient`, so a bound Chime device can be triggered when the doorbell button is pressed.
- Identify cluster is always created (it is a required server cluster for this device type), with configurable identify time and type.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

### Floodlight Camera

Features:

- A composite device type, always defined via endpoint composition: the root endpoint exposes Basic Information and, unless disabled, a Power Source cluster; the mandatory Camera child endpoint and the mandatory On/Off Light child endpoint required by the Matter specification for this device type are both created automatically by the constructor. The Camera child is wired the same way as the standalone Camera device (CameraAvStreamManagement with the Video, Audio, Snapshot and ImageControl features, and the WebRtcTransportProvider cluster and WebRtcTransportRequestor client). Each light gets its own Identify and OnOff (Lighting feature) cluster servers.
- Exposes `addLight()` to add further On/Off Light child endpoints beyond the mandatory one, with an optional tagList for disambiguation when more than one light is present.
- Configurable Power Source cluster type on the root endpoint: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- The Camera child endpoint's Identify and CameraAvStreamManagement configuration can be customized via the `cameraOptions` constructor option, using the same fields and defaults as the standalone Camera device. The mandatory light's name, tagList, and initial state can be customized via the `lightOptions` constructor option.

### Video Doorbell

Features:

- A composite device type, always defined via endpoint composition: the root endpoint exposes Basic Information and, unless disabled, a Power Source cluster; the mandatory Camera child endpoint and the mandatory Doorbell child endpoint required by the Matter specification for this device type are both created automatically by the constructor. The Camera child is wired the same way as the standalone Camera device (CameraAvStreamManagement with the Video, Audio, Snapshot and ImageControl features, and the WebRtcTransportProvider cluster and WebRtcTransportRequestor client). The Doorbell child is wired the same way as the standalone Doorbell device (Switch cluster with the MomentarySwitch feature only, Identify cluster always created, and the required Chime client cluster added automatically via `addChimeClient`).
- Exposes `addDoorbell()` to add further Doorbell child endpoints beyond the mandatory one, with an optional tagList for disambiguation when more than one doorbell is present.
- Configurable Power Source cluster type on the root endpoint: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.
- The Camera child endpoint's Identify and CameraAvStreamManagement configuration can be customized via the `cameraOptions` constructor option, using the same fields and defaults as the standalone Camera device. The mandatory doorbell's name, tagList, and identify configuration can be customized via the `doorbellOptions` constructor option.

### Intercom

Features:

- Exposes the Camera AV Stream Management cluster with the Audio and Speaker features (the Video and Snapshot features are not present, per the Matter specification for this device type; see Camera for a device implementing those). The Speaker feature is what makes an Intercom genuinely two-way: unlike Audio Doorbell, it can both capture and play back audio. Configurable speaker capabilities (codec, sample rates, channels) and two-way talk support (NotSupported, HalfDuplex, FullDuplex; default FullDuplex).
- Unlike Camera and Audio Doorbell, an Intercom both hosts and invokes WebRtcTransportProvider and WebRtcTransportRequestor: it exposes both cluster servers, and registers both as client clusters via `addWebRtcTransportProviderClient`/`addWebRtcTransportRequestorClient`, so it can both receive and solicit WebRTC offers to/from a peer intercom.
- Adds the optional Chime client cluster automatically via `addChimeClient`, so a bound Chime device can be triggered.
- Optional Identify cluster support, with configurable identify time and type. Set to Identify.IdentifyType.None to omit the cluster entirely.
- Configurable Power Source cluster type: Rechargeable, Replaceable, Battery, Wired, or None to omit the Power Source cluster entirely.

Supported by:

- [Matterserver dashboard](screenshots/matterserver-intercom.png)

### Pairing the Server Chime and Server Doorbell to let the Doorbell play a chime

`src/module.ts` registers exactly this pair for testing: `Server Chime` (`mode: 'server'`, its own Matter node) and `Server Doorbell` (`mode: 'server'`, its own Matter node) — commission both and follow the steps below to bind them together.

1. **Binding on Server Doorbell → Server Chime**, so Server Doorbell knows where to play a chime.

Bind Server Doorbell to Server Chime with ![Matter Server Dashboard](screenshots/binding.png)

### Pairing the two Server Intercoms for two-way calling

`src/module.ts` registers exactly this pair for testing: `Server Intercom 1` (`mode: 'server'`, its own Matter node) and `Server Intercom 2` (`mode: 'server'`, its own Matter node) — commission both and follow the steps below to bind them together.

Unlike a Doorbell/Chime pair, where only the Doorbell invokes commands on the Chime, an Intercom both hosts (server) and invokes (client) WebRtcTransportProvider and WebRtcTransportRequestor (see `#resolvePeerRequestorEndpoint` in `src/behaviors/webRtcTransportProviderServer.ts`). Once a peer invokes SolicitOffer/ProvideOffer on an Intercom's WebRtcTransportProvider, that Intercom resolves the caller's WebRtcTransportRequestor endpoint directly from the invoking peer's node id/fabric index carried by the command's CASE session — not via the Binding cluster — so the Offer/Answer "return leg" needs no binding of its own. Only the initiating invoke needs one.

So, to let either Server Intercom 1 or Server Intercom 2 start a call, on the fabric they share.

1. **Binding on Server Intercom 1 → Server Intercom 2**, so Server Intercom 1 knows where to send SolicitOffer/ProvideOffer.

Bind Server Intercom 1 to Server Intercom 2 with ![Matter Server Dashboard](screenshots/binding-intercom1.png)

2. **Binding on Server Intercom 2 → Server Intercom 1**, so Server Intercom 2 knows where to send SolicitOffer/ProvideOffer.

Bind Server Intercom 2 to Server Intercom 1 with ![Matter Server Dashboard](screenshots/binding-intercom2.png)

## WebRTC video and audio injection

`WeriftWebRtcSession` (see `src/webrtc/weriftSession.ts`) wraps a real werift `RTCPeerConnection` for each WebRtcTransportProvider session (see `MatterbridgeWebRtcTransportProviderServer` in `src/behaviors/webRtcTransportProviderServer.ts`), so the session's SDP offer/answer and ICE candidates are handled by a real WebRTC peer connection instead of being just recorded. It can also inject a real ffmpeg-generated video and/or audio track into the negotiated connection, so the end-to-end media path can be validated without a real camera/microphone capture pipeline.

The platform configuration controls WebRTC video injection with these properties:

- `videoGenerator` is required and accepts `none`, `test`, `webcam`, or `rtsp`. It defaults to `none`, which negotiates the video transceiver without attaching a track. `test` injects a synthetic moving test pattern, `webcam` captures from the configured local webcam, and `rtsp` pulls from the RTSP url configured in `videoSource`.

- `videoSource` is optional and has no default. For the `webcam` generator it contains the OS-specific ffmpeg device identifier — e.g. `/dev/video0` on Linux (v4l2), an avfoundation index such as `0` on macOS, or a device name such as `Integrated Camera` on Windows (dshow). For the `rtsp` generator it instead holds the RTSP url, e.g. `rtsp://user:password@host:554/path`. Selecting the `webcam` or `rtsp` generator without this property falls back to the test pattern with a warning.

- `videoResolution` is required and accepts `auto`, `640x480`, `1280x720`, or `1920x1080`. It defaults to `auto`, which uses the resolution requested by the controller for the session (see below), falling back to `640x480` when no request is available or it names an unsupported resolution. A fixed resolution always wins over what the controller requested. The actual achievable frame rate depends on the webcam and can be much lower than 30 FPS at higher resolutions (check with `v4l2-ctl -d <device> --list-formats-ext` on Linux).

- `videoBitrate` is required and accepts a number (the target encoder bitrate in kbps). It defaults to `1000`. It applies to the `webcam` and `rtsp` sources only; the `test` pattern is always encoded at a fixed 1000 kbps regardless of this setting. Since the encoder always uses `-preset ultrafast -tune zerolatency` for low-latency live view (lower compression efficiency than slower presets), suggested values are higher than typical streaming guides: ~800 for `640x480`, ~2000 for `1280x720`, ~2500 for `1920x1080`.

The platform configuration controls WebRTC audio injection with these properties:

- `audioGenerator` is required and accepts `none`, `test`, `microphone`, or `rtsp`. It defaults to `none`, which negotiates the audio transceiver (e.g. for an Intercom's "Listen" live view) without attaching a track. `test` injects a recorded test-voice clip, looped, so the end-to-end audio path can be validated without a real microphone capture pipeline. `microphone` captures from the configured local microphone, and `rtsp` pulls just the audio from the RTSP url configured in `audioSource` (any video in the stream is dropped).

- `audioSource` is optional and has no default. For the `microphone` generator it contains the OS-specific ffmpeg device identifier — e.g. an ALSA device such as `hw:0,0` on Linux, an avfoundation audio index such as `0` on macOS, or a device name such as `Microphone Array` on Windows (dshow). For the `rtsp` generator it instead holds the RTSP url, e.g. `rtsp://user:password@host:554/path` (it can be a different camera/url than `videoSource`). Selecting the `microphone` or `rtsp` generator without this property falls back to the test-voice clip with a warning.

Use ffmpeg itself to list the [available capture devices](https://trac.ffmpeg.org/wiki/Capture/Webcam) and find the right value for `audioSource`:

- Linux (alsa): `arecord -l`, or `ffmpeg -f alsa -i default` to try the default device.
- macOS (avfoundation): `ffmpeg -f avfoundation -list_devices true -i dummy` — audio devices are listed with their index under "AVFoundation audio devices", e.g. `[0] MacBook Pro Microphone`; use that index (e.g. `0`) as the device value.
- Windows (dshow): `ffmpeg -f dshow -list_devices true -i dummy` — audio devices are listed by name under "DirectShow audio devices", e.g. `"Microphone Array"`; use that exact name as the device value.

Example configuration for a real Linux microphone:

```json
{
  "audioGenerator": "microphone",
  "audioSource": "hw:0,0"
}
```

Example, pulling the audio from the same RTSP camera used for `videoSource`:

```json
{
  "videoGenerator": "rtsp",
  "videoSource": "rtsp://admin:password@192.168.1.100:554/ch1/main",
  "audioGenerator": "rtsp",
  "audioSource": "rtsp://admin:password@192.168.1.100:554/ch1/main"
}
```

With `videoResolution: "auto"`, a real client's resolution/quality picker (e.g. in Home Assistant) drives the capture/output resolution: it allocates a video stream with `CameraAvStreamManagement.VideoStreamAllocate` before soliciting or providing a WebRTC offer, and `MatterbridgeWebRtcTransportProviderServer` looks up that stream's `maxResolution` to select the resolution for the session. For `webcam` this is the capture resolution passed to ffmpeg; for `rtsp` the camera keeps streaming at its own native resolution and ffmpeg scales it to match.

Use ffmpeg itself to list the [available capture devices](https://trac.ffmpeg.org/wiki/Capture/Webcam) and find the right value for `videoSource`:

- Linux (v4l2): `v4l2-ctl --list-devices` (from `v4l-utils`), or `ls /dev/video*`.
- macOS (avfoundation): `ffmpeg -f avfoundation -list_devices true -i dummy` — video devices are listed with their index, e.g. `[0] FaceTime HD Camera`; use that index (e.g. `0`) as the device value.
- Windows (dshow): `ffmpeg -f dshow -list_devices true -i dummy` — video devices are listed by name under "DirectShow video devices", e.g. `"Integrated Camera"`; use that exact name as the device value.

Example configuration for a real Linux webcam at 720p:

```json
{
  "videoGenerator": "webcam",
  "videoSource": "/dev/video0",
  "videoResolution": "1280x720"
}
```

Example, capturing from a real Windows webcam at 720p with a higher bitrate:

```json
{
  "videoGenerator": "webcam",
  "videoSource": "Integrated Camera",
  "videoResolution": "1280x720",
  "videoBitrate": 2000
}
```

Finding your camera's RTSP url for `videoSource` when `videoGenerator` is `rtsp`:

- The general format is `rtsp://<username>:<password>@<camera-ip>:<port>/<path>`.
- `username`/`password` are the camera's own local admin account (set in its web UI or during first setup), not a cloud/app account.
- `camera-ip` is its LAN IP — check your router's DHCP client list, the camera's own app, or an IP scanner.
- `port` is almost always `554` unless changed in the camera's settings.
- `path` is vendor/model-specific and varies the most — check the camera's manual or web UI's RTSP settings page, or query it with an ONVIF tool (e.g. ONVIF Device Manager) for the exact `GetStreamUri` result. Some common examples:
  - Hikvision/Ezviz-style: `/ch1/main` (main stream) or `/ch1/sub` (substream, lower resolution)
  - Dahua: `/cam/realmonitor?channel=1&subtype=0`
  - Reolink: `/h264Preview_01_main`

Verify the url works standalone before adding it to the config, e.g. `ffprobe rtsp://admin:password@192.168.1.100:554/ch1/main` or `ffplay rtsp://admin:password@192.168.1.100:554/ch1/main`, or open it in VLC via "Open Network Stream". Note that the url (with credentials in plaintext) ends up stored in Matterbridge's plugin config on disk, like any other password-bearing config value.

Example, pulling from a real RTSP camera, scaled to a fixed 1280x720 and re-encoded at `videoBitrate` (the camera's own frame rate is kept):

```json
{
  "videoGenerator": "rtsp",
  "videoSource": "rtsp://admin:password@192.168.1.100:554/ch1/main",
  "videoResolution": "1280x720"
}
```

Example, pulling from a real RTSP camera and scaling to whatever resolution the controller requests for the session:

```json
{
  "videoGenerator": "rtsp",
  "videoSource": "rtsp://admin:password@192.168.1.100:554/ch1/main",
  "videoResolution": "auto"
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

### Known limitation: a client with an unreachable network interface can slow down ICE negotiation logging

A browser gathers one host ICE candidate per local network interface it sees, mDNS-obfuscated or not. When one of those interfaces has no multicast route to the machine running Matterbridge — a disconnected VPN adapter, a Hyper-V/WSL virtual switch, a second NIC on an unrelated subnet — werift-ice's mDNS resolution for that candidate's `*.local` name can never succeed, and takes the full per-candidate apply timeout (5s, see `ICE_CANDIDATE_APPLY_TIMEOUT_MS` in `src/behaviors/webRtcTransportProviderServer.ts`) to give up on it.

Candidates are applied concurrently, not one after another, so this doesn't compound: a candidate on a reachable interface succeeds in a few milliseconds without waiting behind a sibling candidate that's doomed to time out. `provideIceCandidates` also responds to the peer as soon as the candidates are recorded, rather than waiting for their application to finish — the same reason `SolicitOffer`/`ProvideOffer` already invoke Offer/Answer on the peer without blocking their own response — so an unreachable interface no longer delays the Matter command itself, only the background log entry for that specific candidate. If a stream is slow to start or intermittently fails specifically on a machine with multiple network interfaces/VPNs, this is the mechanism to check first (grep the Matterbridge log for `ICE candidate apply timeout`).

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
- **RTSP — Real Time Streaming Protocol:** a separate, older protocol (not part of the WebRTC flow above) used to pull a live stream from a real IP camera. See the `rtsp` video generator earlier in this README: `ffmpeg` connects to the camera's RTSP url and re-encodes its stream into the WebRTC video track injected into this same peer connection.

`createOffer()` and `createAnswer()` produce the SDP descriptions. Applying each local description gathers that peer's ICE candidates. After each peer receives the other peer's description and candidates, werift selects a network path, performs the DTLS handshake, and opens the SCTP data channel. The two control messages prove that data can travel in both directions. The camera peer then sends `assets/test-camera.mp4` to the controller in 16 KiB binary chunks; the test reconstructs it and compares its byte length and SHA-256 hash before closing both peers.

In the camera implementation, Matter's WebRTC Transport Provider and Requestor clusters are responsible for carrying the SDP and ICE signaling between devices. The resulting WebRTC connection carries the media or data directly; Matter does not carry the WebRTC payload itself. This test validates werift independently and does not yet connect it to `MatterbridgeWebRtcTransportProviderServer`.

Run it with:

```bash
npm run test -- vitest/werift.test.ts
```

### Media test assets

The `assets` directory contains deterministic three-second media fixtures for extending the werift test to real media tracks:

- `test-video.h264`: raw H.264 Constrained Baseline video, 640×360 at 15 FPS, with a moving test pattern. Use this elementary stream when implementing H.264 NAL-unit parsing and RTP packetization.
- `test-audio.opus`: Ogg container with mono Opus audio at 48 kHz and 64 kbit/s, containing a recorded voice track. Use the Opus packets for an audio RTP track; the Ogg container itself is not sent over WebRTC.
- `test-camera.mp4`: playable reference containing the same 640×360 H.264 test pattern and a mono 1 kHz AAC track. The werift test transfers the complete file over its SCTP data channel and verifies its integrity. This exercises binary file transport, not a WebRTC video RTP track.
- `camera-color-1920-1080.jpeg`: 1920×1080 simplified ffmpeg-generated color-rectangle snapshot.
- `camera-color-1280-720.jpeg`: 1280×720 simplified ffmpeg-generated color-rectangle snapshot.
- `camera-color-640-480.jpeg`: 640×480 simplified ffmpeg-generated color-rectangle snapshot.
- `camera-color-test-1920-1080.jpeg`: 1920×1080 extended color-rectangle snapshot returned by the example's `CaptureSnapshot` command.
- `camera-color-test-1280-720.jpeg`: 1280×720 extended color-rectangle snapshot returned by the example's `CaptureSnapshot` command.
- `camera-color-test-640-480.jpeg`: 640×480 extended color-rectangle snapshot returned by the example's `CaptureSnapshot` command.

#### Why the snapshot calibration cards stay under ~64 KB

All three calibration cards above are kept well under the Matter message size ceiling, which caps at **65535 bytes** for a single message and cannot be worked around by tuning TCP:

- Every Matter message is encrypted with AES-128-CCM, using a 13-byte nonce built from the security flags, message counter, and node ID (`Session.generateNonce`, part of the Matter message-security spec, not a matter.js choice).
- AES-CCM (RFC 3610 / NIST SP 800-38C) requires the nonce length `N` and the length-field size `L` to satisfy `N + L = 15` bytes for a 128-bit block cipher. With `N = 13`, that leaves `L = 2`.
- A 2-byte length field caps the plaintext of a single CCM-encrypted message at `2^16 - 1 = 65535` bytes — a cryptographic ceiling, not a networking one. matter.js's `DEFAULT_MAX_TCP_MESSAGE_SIZE` (64000) is just a round number kept safely under that limit.

A `CaptureSnapshot` response whose `data` field doesn't fit fails to send: the client gets a generic invoke failure instead of an image, since the encoder cannot represent the required plaintext length in the message header. `CameraAvStreamManagement.CaptureSnapshot` returns its image as a single field of a single command response, so it inherits this ceiling directly. Matter has a dedicated mechanism for transferring larger payloads — BDX (Bulk Data Exchange), used for OTA updates and diagnostic logs — which splits big content across a sequence of acknowledged messages instead of one oversized one, but `CaptureSnapshot` doesn't use it.

WebRTC media tracks transport encoded H.264 or Opus frames in RTP packets; they do not send an MP4, Ogg, or MPEG container directly. The current MP4 transfer deliberately uses the separate data-channel path. A future video-track test should parse the relevant elementary frames, packetize them as RTP, call werift's media track `writeRtp()`, and verify reception through `onTrack` and `onReceiveRtp`.

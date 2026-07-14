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

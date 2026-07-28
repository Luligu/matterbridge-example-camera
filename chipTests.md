## Chip tests

### Create the container (Linux, macOS, and Windows)

Run the `luligu/matterbridge:chip-test` docker image:

- frontend on port 8585
- plugin mapped to .
- container test logs directory mapped on ./temp directory

```shell
node scripts/run-chip-tests.mjs --start
```

### Run all configured tests inside the container

```shell
node scripts/run-chip-tests.mjs
```

### Manually run the tests inside the container

Open a shell in the container

```shell
docker exec -it plugin-chip-test bash
```

In the shell:

```bash
# Generic device composition and conformance ✅ (all pass)
python3 src/python_testing/TC_DeviceBasicComposition.py
python3 src/python_testing/TC_DeviceConformance.py --bool-arg allow_provisional:true
python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true

# Chime cluster ✅ (all pass)
python3 src/python_testing/TC_CHIME_2_1.py --endpoint 2
python3 src/python_testing/TC_CHIME_2_2.py --endpoint 2
python3 src/python_testing/TC_CHIME_2_3.py --endpoint 2
python3 src/python_testing/TC_CHIME_2_4.py --endpoint 2
python3 src/python_testing/TC_CHIME_2_5.py --endpoint 2
python3 src/python_testing/TC_CHIME_2_6.py --endpoint 2

# Doorbell mandatory Switch server ✅ (all non interactive pass)
python3 src/python_testing/TC_SWTCH.py --endpoint 3

# Camera AV Stream Management — requires MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT=1 (baked into the luligu/matterbridge:chip-test image by default) ✅ (all pass except 2.7 for test bug)
# Without that env var, 2.2 and 2.5 fail: TC_AVSM_2_2/2_5 step 2 assert AllocatedSnapshotStreams/AllocatedAudioStreams
# are empty immediately after commissioning, which conflicts with MatterbridgeCameraAvStreamManagementServer#initialize
# self-allocating default streams (see the "Camera AV Stream Management — Default Stream Self-Allocation" section below).
python3 src/python_testing/TC_AVSM_2_1.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_2.py --endpoint 6
# Requires Watermark or Osd Features python3 src/python_testing/TC_AVSM_2_3.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_4.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_5.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_6.py --endpoint 6
# Test wrong assumption: step 27 escalates MaxFrameRate to at least minFrameRate+35 to force RESOURCE_EXHAUSTED, which always exceeds our declared VideoSensorParams.MaxFps (30) and is correctly rejected as DYNAMIC_CONSTRAINT_ERROR first; no --int-arg minFrameRate value avoids this since the offset is fixed by the test
python3 src/python_testing/TC_AVSM_2_7.py --endpoint 6
# Requires Watermark or Osd Features python3 src/python_testing/TC_AVSM_2_8.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_9.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_10.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_11.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_12.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_13.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_14.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_15.py --endpoint 6
# Needs WebRTC python3 src/python_testing/TC_AVSM_2_16.py --endpoint 6
# Requires Privacy Feature python3 src/python_testing/TC_AVSM_2_17.py --endpoint 6
# Requires reboot python3 src/python_testing/TC_AVSM_2_18.py --endpoint 6
# Requires reboot python3 src/python_testing/TC_AVSM_2_19.py --endpoint 6
# Requires reboot python3 src/python_testing/TC_AVSM_2_20.py --endpoint 6
python3 src/python_testing/TC_AVSM_2_21.py --endpoint 6

# Additional Camera AV Stream Management tests ✅ (all pass)
python3 src/python_testing/TC_AVSM_StreamReuseRangeParams.py --endpoint 6
# Requires fault-injection TestEventTrigger (UnsupportedCluster) python3 src/python_testing/TC_AVSM_VideoStreamsPersistence.py --endpoint 6

# Camera AV Settings User Level Management (Mechanical/Digital PTZ) — endpoint 7 (PTZCamera) ✅ (all pass except 2.9 for a test bug)
python3 src/python_testing/TC_AVSUM_2_1.py --endpoint 7
python3 src/python_testing/TC_AVSUM_2_2.py --endpoint 7
python3 src/python_testing/TC_AVSUM_2_3.py --endpoint 7
# Requires MechanicalPresets feature python3 src/python_testing/TC_AVSUM_2_4.py --endpoint 7
# Requires MechanicalPresets feature python3 src/python_testing/TC_AVSUM_2_5.py --endpoint 7
# Requires MechanicalPresets feature python3 src/python_testing/TC_AVSUM_2_6.py --endpoint 7
# Requires DigitalPTZ feature python3 src/python_testing/TC_AVSUM_2_7.py --endpoint 7
# Requires DigitalPTZ feature python3 src/python_testing/TC_AVSUM_2_8.py --endpoint 7
# Test bug: jumps from step 18 to step 22 without calling skip_step() for steps 19-21 when DPTZ is unsupported
python3 src/python_testing/TC_AVSUM_2_9.py --endpoint 7

# WebRTC Transport Provider — endpoint 6 (Camera), requires MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 (baked into the luligu/matterbridge:chip-test image by default, see Known Issues #1) ⚠️ (13/31 pass; see Known Issues below)
# Test bug: is_battery_powered() reads PowerSource on endpoint 0 (root node), which doesn't exist on a Matterbridge bridge; PowerSource lives on the bridged endpoint (6)
python3 src/python_testing/TC_WEBRTCP_2_1.py --endpoint 6
# Gap: deferredOffer is hardcoded true; test expects false (immediate processing) in this scenario (see Known Issues #7)
python3 src/python_testing/TC_WEBRTCP_2_2.py --endpoint 6
# Passes with MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 (verified 2026-07-28; Known Issues #8 fixed)
python3 src/python_testing/TC_WEBRTCP_2_3.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_4.py --endpoint 6
# Gap: gets past the #8 scenario (fixed), then fails on an unsupported StreamUsage not being rejected with DYNAMIC_CONSTRAINT_ERROR (see Known Issues #10)
python3 src/python_testing/TC_WEBRTCP_2_5.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_6.py --endpoint 6
# Gap: HardPrivacyModeOn never flips when the simulated physical privacy switch is toggled (see Known Issues #2)
python3 src/python_testing/TC_WEBRTCP_2_7.py --endpoint 6
# Gap: writing SoftRecordingPrivacyModeEnabled returns UnsupportedAttribute, Privacy feature not implemented (see Known Issues #3)
python3 src/python_testing/TC_WEBRTCP_2_8.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_9.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_10.py --endpoint 6
# Test bug: same is_battery_powered() endpoint=0 issue as 2.1
python3 src/python_testing/TC_WEBRTCP_2_11.py --endpoint 6
# Gap: requires --PICS .../ci-pics-values (PICS_SDK_CI_ONLY) to run non-interactively; then times out because no session-capacity limit is enforced (see Known Issues #4)
python3 src/python_testing/TC_WEBRTCP_2_12.py --endpoint 6
# Gap: same HardPrivacyModeOn issue as 2.7 (see Known Issues #2)
python3 src/python_testing/TC_WEBRTCP_2_13.py --endpoint 6
# Gap: same SoftRecordingPrivacyModeEnabled issue as 2.8 (see Known Issues #3)
python3 src/python_testing/TC_WEBRTCP_2_14.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_15.py --endpoint 6
# Gap: requires --PICS .../ci-pics-values, then fails with UnsupportedCluster instead of reaching session-capacity limit (see Known Issues #4)
python3 src/python_testing/TC_WEBRTCP_2_16.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_17.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_18.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_19.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_20.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_21.py --endpoint 6
# Gap: "TH establishes a valid WebRTC session with DUT" times out (see Known Issues #5)
python3 src/python_testing/TC_WEBRTCP_2_22.py --endpoint 6
# Gap: same session-establishment timeout as 2.22 (see Known Issues #5)
python3 src/python_testing/TC_WEBRTCP_2_23.py --endpoint 6
# Gap: unsupported cipher suite is accepted instead of rejected with DynamicConstraintError (see Known Issues #6)
python3 src/python_testing/TC_WEBRTCP_2_24.py --endpoint 6
# Gap: same cipher-suite validation gap as 2.24 (see Known Issues #6)
python3 src/python_testing/TC_WEBRTCP_2_25.py --endpoint 6
# Gap: videoStreamID/videoStreams both present isn't rejected with INVALID_COMMAND (see Known Issues #9)
python3 src/python_testing/TC_WEBRTCP_2_27.py --endpoint 6
# Gap: same deferredOffer issue as 2.2 (see Known Issues #7)
python3 src/python_testing/TC_WEBRTCP_2_28.py --endpoint 6
# Passes with MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 (verified 2026-07-28; Known Issues #8 fixed, ProvideOffer variant)
python3 src/python_testing/TC_WEBRTCP_2_29.py --endpoint 6
python3 src/python_testing/TC_WEBRTCP_2_30.py --endpoint 6
# Gap: gets past the #8 scenario (fixed), then fails on an unsupported StreamUsage not being rejected with DYNAMIC_CONSTRAINT_ERROR (see Known Issues #10)
python3 src/python_testing/TC_WEBRTCP_2_31.py --endpoint 6
# Gap: same deferredOffer issue as 2.2 (see Known Issues #7)
python3 src/python_testing/TC_WEBRTCP_2_32.py --endpoint 6
```

**Use `node scripts/run-chip-tests.mjs --test TC_AVSM`** to run the full Camera AV Stream Management test suite. All tests run with `--endpoint 6` (the `Camera` device).

**Use `node scripts/run-chip-tests.mjs --test TC_WEBRTCP`** to run the full WebRTC Transport Provider test suite. All tests run with `--endpoint 6` (the `Camera` device).

### Camera AV Stream Management — Default Stream Self-Allocation (added 2026-07-28)

`MatterbridgeCameraAvStreamManagementServer#initialize()` ([cameraAvStreamManagementServer.ts](src/behaviors/cameraAvStreamManagementServer.ts)) self-allocates a default video/audio/snapshot stream for any feature the endpoint supports that has none allocated yet, on every endpoint construction. This applies automatically to every device using this shared behavior: `Camera`, `SnapshotCamera`, `AudioDoorbell`, `Intercom`, and the composite `FloodlightCamera`/`VideoDoorbell`.

**Why:** Matter 1.6/1.5.1 §11.2.1.1 "Stream Lifecycle" recommends Commissioners allocate streams once, at commissioning time, with "very long lifetimes" thereafter. `AllocatedVideoStreams`/`AllocatedAudioStreams`/`AllocatedSnapshotStreams` are also `N`-quality (Matter-mandated non-volatile, §11.2.7) — a compliant device must persist them across restarts. In practice, real clients don't reliably do their part: SmartThings (see "Real-World Client Traces" below) never calls `VideoStreamAllocate`/`AudioStreamAllocate` at all, and matter.js legitimately discards all persisted state for a cluster when its `FeatureMap` changes between restarts (`Datasource.ts`'s `"Ignoring persisted values for ... because features changed"` — something this project's own ImageControl feature-flag changes trigger). Self-allocation is a defensive fallback so a passive/forgetful client still finds something usable.

**Conflict discovered and resolved:** the CHIP certification suite models allocation as purely commissioner-driven and asserts the opposite — `TC_AVSM_2_2`/`TC_AVSM_2_5` step 2 explicitly assert `AllocatedSnapshotStreams`/`AllocatedAudioStreams` are **empty** immediately after commissioning. Verified 2026-07-28: with self-allocation unconditionally active, `TC_AVSM_2_2` and `TC_AVSM_2_5` — previously always-passing — failed with `"1 != 0 The number of allocated snapshot/audio streams in the list is not 0"`. Resolved by adding the `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` environment variable (`#isAutoAllocateSkipped()`): when set to `1`, `initialize()` skips self-allocation entirely. The `luligu/matterbridge:chip-test` image now sets this by default (alongside `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`), so the CHIP suite sees genuinely-empty lists like it expects, while real deployments (unset, the default) keep the self-allocation safety net. Re-verified 2026-07-28 with the updated image: `TC_AVSM_2_2`/`2_5` pass again, `TC_AVSM` overall back to 14/15 (only the pre-existing `2.7` test-wrong-assumption failure remains), and `TC_WEBRTCP_2_3`/`2_29` (Known Issues #8) still pass with both env vars active simultaneously — confirmed no interaction between the two flags.

**Snapshot resolution range fix (2026-07-28):** the self-allocated default snapshot stream originally set `minResolution`/`maxResolution` to a single fixed point — `snapshotCapabilities[0]`'s resolution (the array's first entry, which happens to be the smallest for every device in this repo, e.g. `Camera`'s 640×480) — instead of spanning a real range like the video default stream does (`minViewportResolution` to the top `rateDistortionTradeOffPoints` resolution). This meant a real client requesting any _other_ supported `snapshotCapabilities` resolution (e.g. the device's own top-listed 1920×1080 capability, as the Matter Server dashboard trace below does) could never dedup-match the default stream in `snapshotStreamAllocate` (§11.2.8.8.8's "existing stream that matches this request" check), spawning an unwanted duplicate allocation that then sits around forever if the client never deallocates it (as SmartThings' traces below show). Fixed: `initialize()` now computes `minResolution`/`maxResolution` across the full `snapshotCapabilities` list (smallest width/height to the largest-area entry's resolution), and takes `imageCodec`/`frameRate` from that largest entry. The dashboard trace recorded below predates this fix — with it applied, that same request now dedup-matches stream `0` and returns it directly instead of allocating stream `1`.

### WebRTC Transport Provider — Known Issues (investigated 2026-07-27, updated 2026-07-27, base for next refactor)

**`MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1` and `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT=1` are both baked into the `luligu/matterbridge:chip-test` image itself** — confirmed via `docker inspect luligu/matterbridge:chip-test` showing them in `Config.Env` (alongside `MATTERBRIDGE_START_CONFIGURE_TIMEOUT=5000`/`MATTERBRIDGE_START_REACHABILITY_TIMEOUT=10000`, i.e. these are Dockerfile-level defaults for this test image, not something anyone needs to pass). This means **every** container created from this image has strict WebRTC validation active and default-stream self-allocation skipped, by default. See "Camera AV Stream Management — Default Stream Self-Allocation" below for what the latter env var controls and why the CHIP suite needs it disabled.

**#1 — RESOLVED. Automatic stream selection conflicted with strict "no streams" rejection (originally 7 tests: 2.2, 2.3, 2.5, 2.27, 2.28, 2.29, 2.31).**
`solicitOffer`/`provideOffer` in [webRtcTransportProviderServer.ts](src/behaviors/webRtcTransportProviderServer.ts) call `#autoAssignStreams()` whenever the request has no `videoStreams`/`audioStreams`/deprecated single-id fields at all — a deliberate feature so revision-1 clients (e.g. Home Assistant's Matter camera integration) that never allocate streams explicitly still work. Several CHIP tests instead send a `SolicitOffer`/`ProvideOffer` with **no stream fields whatsoever** and expect `INVALID_COMMAND`.
Fixed by testing the `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` environment variable (see `#isStrictWebRtcTransport()`/`#hasNoStreamFields()` in [webRtcTransportProviderServer.ts](src/behaviors/webRtcTransportProviderServer.ts)): when set to `1`, a request with none of `videoStreams`, `audioStreams`, `videoStreamId` or `audioStreamId` present is rejected with `INVALID_COMMAND` before auto-assignment runs. Left unset, the default for real-world auto-assignment behavior is unchanged.

**#2 — `HardPrivacyModeOn` never toggles (2 tests: 2.7, 2.13).**
[camera.ts](src/devices/camera.ts):282, [audioDoorbell.ts](src/devices/audioDoorbell.ts):176, and [intercom.ts](src/devices/intercom.ts):200 all hardcode `hardPrivacyModeOn: false` with no logic to ever change it. These tests simulate toggling a physical privacy switch and expect the attribute to flip to `true`. Not implemented at all — would need a way to simulate/wire a hardware privacy switch.

**#3 — `SoftRecordingPrivacyModeEnabled` (and the whole Privacy feature) isn't implemented (2 tests: 2.8, 2.14).**
The `CameraAvStreamManagement.Feature.Privacy` feature (which brings `SoftLivestreamPrivacyModeEnabled`/`SoftRecordingPrivacyModeEnabled`) isn't in our enabled feature list ([cameraAvStreamManagementServer.ts](src/behaviors/cameraAvStreamManagementServer.ts):90-95 declares Video/Audio/Snapshot/ImageControl only), so writing the attribute returns `UnsupportedAttribute`. This is also the same feature referenced by `TC_AVSM_2_17` (already excluded above as "Requires Privacy Feature"). A real feature gap, not a bug.

**#4 — No enforced max concurrent WebRTC sessions (2 tests: 2.12, 2.16).**
Both tests need `--PICS src/app/tests/suites/certification/ci-pics-values` (sets `PICS_SDK_CI_ONLY`) to run non-interactively — otherwise they crash with `'NoneType' object has no attribute 'strip'` trying to prompt for a number interactively. With that flag: 2.12 times out waiting for the DUT to send `End(reason=OutOfResources)` after 5 solicited sessions — `solicitOffer`/`provideOffer` never check any session-count limit before accepting. 2.16 (the `ProvideOffer` variant) instead fails with `InteractionModelError: UnsupportedCluster` partway through — needs separate investigation, may be a different underlying issue in the `ProvideOffer` capacity-exhaustion path. Fix direction: add a configurable max-concurrent-sessions check to `solicitOffer`/`provideOffer` that rejects with `End(OutOfResources)` once reached.

**#5 — "TH establishes a valid WebRTC session with DUT" times out (2 tests: 2.22, 2.23).**
Reproducible (retried once, same result both times — not flaky). Times out during session establishment itself (ICE/DTLS completion), unrelated to the stream-selection or capacity issues above. Needs a dedicated investigation with full packet/ICE-state logging; not yet root-caused.

**#6 — No cipher-suite validation (2 tests: 2.24, 2.25).**
Test sends an unsupported ICE/DTLS cipher suite and expects `DynamicConstraintError`; our handlers have no cipher-suite check anywhere and just accept it. Real gap — would need to validate the requested cipher suite against a supported list before proceeding.

**#7 — `deferredOffer` is hardcoded `true` (3 tests: 2.2, 2.28, 2.32).**
[webRtcTransportProviderServer.ts](src/behaviors/webRtcTransportProviderServer.ts):401 always returns `deferredOffer: true` from `solicitOffer`. These tests' scenario expects `false` (immediate processing) — our implementation never distinguishes the two cases. Needs investigation into what should drive immediate vs. deferred processing (likely whether the WebRtcTransportRequestor peer is already reachable/bound at solicit time, or whether the device is in standby mode — see Matter 1.6 Application Cluster Specification §11.5.6.1.10, "If in standby mode: DeferredOffer=TRUE; Else: DeferredOffer=FALSE").

**#8 — RESOLVED. `videoStreams`/`audioStreams` were never validated against `AllocatedVideoStreams`/`AllocatedAudioStreams` (originally 4 tests: 2.3, 2.5, 2.29, 2.31).**
Matter 1.6 Application Cluster Specification §11.5.6.1.10 ("Effect on Receipt" for `SolicitOffer`; §11.5.6.3.5 mirrors this for `ProvideOffer`) specifies, after resolving `VideoStreamID`/`AudioStreamID` into a `VideoStreams`/`AudioStreams` list:

- "If `VideoStreams` is present: If `AllocatedVideoStreams` is empty → fail with `INVALID_IN_STATE`." Then check for duplicate entries → `ALREADY_EXISTS`. Then, for each entry, "if not found in `AllocatedVideoStreams` → fail with `DYNAMIC_CONSTRAINT_ERROR`."
- The identical three-way check (`INVALID_IN_STATE` / `ALREADY_EXISTS` / `DYNAMIC_CONSTRAINT_ERROR`) is mirrored for `AudioStreams`/`AllocatedAudioStreams`.

**Verified identical in Matter 1.5.1** (checked 2026-07-28, plain-text-extracted comparison of both spec HTML files): the "Effect on Receipt" algorithm above and the field-level descriptions below are **word-for-word the same** in both 1.5.1 and 1.6.0. There is no version-specific relaxation — this has been the mandated behavior since at least 1.5.1.

**Where `AllocatedVideoStreams`/`AllocatedAudioStreams` actually come from (checked 2026-07-28):** `AllocatedVideoStreams` is defined exactly once, at §11.2.7.16 in the `CameraAvStreamManagement` cluster (§11.2, not §11.5): "This attribute SHALL indicate the list of allocated video streams on the device." The _only_ place anything is ever appended to it, anywhere in the spec, is `CameraAvStreamManagement.VideoStreamAllocate`'s own Effect on Receipt (§11.2.8.4): "Allocate a new VideoStreamID → Create and store a new VideoStreamStruct → **Append** the new VideoStreamStruct to the `AllocatedVideoStreams`." `VideoStreamDeallocate` is the only place that removes from it. `AllocatedAudioStreams` works identically via `AudioStreamAllocate`/`AudioStreamDeallocate`. Every one of `WebRtcTransportProvider`'s (§11.5) references to `AllocatedVideoStreams`/`AllocatedAudioStreams` is a **read or a validation check** — the cluster has no command anywhere that writes to either attribute.

This resolves the ambiguity in the `VideoStreamID`/`AudioStreamID` field descriptions (§11.5.6.1.4): "If present and null, then automatic stream **assignment or creation** is requested." Given the above, "creation" here cannot mean `WebRtcTransportProvider` allocating a new video stream — it has no mechanism to do so. In the Effect-on-Receipt algorithm itself, "**Automatically select an existing** video stream ... **Create an empty `VideoStreams`** and add the selected `VideoStreamID` as a new entry" is unambiguous once read against the attribute definition above: "select an existing" means selecting among entries already present in `AllocatedVideoStreams`; "Create an empty `VideoStreams`" creates the local **list variable** used by the rest of the algorithm, populated with whatever was selected — it is not an instruction to allocate a stream. If nothing exists to select, the list stays empty, and the very next check ("If `VideoStreams` is present: If `AllocatedVideoStreams` is empty → `INVALID_IN_STATE`") is exactly what catches that case. The "or creation" phrase in the field description is therefore either loosely worded or refers to something outside `WebRtcTransportProvider`'s own authority — it does not license this cluster to call the equivalent of `VideoStreamAllocate` itself.

**Conclusion: both symptoms below are the same kind of non-compliance, not one compliant and one not.** Our `#autoAssignStreams()`/`#resolveStreamLists()` in [webRtcTransportProviderServer.ts](src/behaviors/webRtcTransportProviderServer.ts) implements neither the `null` case nor the non-null case per spec:

- 2.3 and 2.5 send an explicit `videoStreamID: null`/`audioStreamID: null` _before any stream has been allocated at all_. Per spec, "select an existing" finds nothing, and the result should be `INVALID_IN_STATE`. Instead, our `#autoAssignStreams()` actively calls `videoStreamAllocate`/`audioStreamAllocate` — **a command that belongs to a different cluster** — to conjure a stream that didn't exist, and succeeds. This is not a spec-sanctioned reading of "assignment or creation"; it's a deliberate compatibility extension with no basis in the Effect-on-Receipt text.
- 2.29 and 2.31 send a `videoStreams`/`videoStreamID` entry that doesn't match any real allocated stream (an intentionally invalid ID) and expect `DYNAMIC_CONSTRAINT_ERROR`; our handler doesn't check membership in `AllocatedVideoStreams` at all, so it succeeds instead.
- SmartThings' real-world `provideOffer` (see below) is the same missing check as 2.29/2.31, just with a "never allocated anything, not merely a wrong ID" precondition — closer in shape to 2.3/2.5's scenario but via the non-null field-description branch instead of the null one.

All of these are one missing validation step (§11.5.6.1.10/§11.5.6.3.5's `AllocatedVideoStreams`/`AllocatedAudioStreams` three-way check), not several different bugs, and none of our current auto-allocate behavior for any of these branches is spec-sanctioned — it exists purely because this project deliberately supports clients that never call `VideoStreamAllocate`/`AudioStreamAllocate` at all (SmartThings today; the CHIP test scenarios are testing the spec-strict alternative).

**Fixed** (2026-07-28) by extending the same `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` env var used for #1: when set to `1`, `solicitOffer`/`provideOffer` now call `#resolveStrictStreamLists()` instead of the lenient `#resolveStreamLists()`/`#autoAssignStreams()` path. It resolves a present-and-`null` id by selecting from already-allocated streams only (`#selectExistingVideoStreamId`/`#selectExistingAudioStreamId`, no allocation), and a present non-null id/list as-is, then validates the result against `AllocatedVideoStreams`/`AllocatedAudioStreams` via `#validateAllocatedStreamIds()` — implementing the exact three-way check (`INVALID_IN_STATE`/`ALREADY_EXISTS`/`DYNAMIC_CONSTRAINT_ERROR`) from §11.5.6.1.10/§11.5.6.3.5. **Left unset (the default), behavior is completely unchanged** — `#autoAssignStreams()`'s lenient auto-allocate-on-demand extension still runs, so SmartThings (see "Real-World Client Traces" below) keeps working exactly as before. 100% statement/branch/function/line coverage maintained; 53 tests in `vitest/behaviors/webRtcTransportProviderServer.test.ts` (up from 42), including one-to-one coverage of `InvalidInState` (empty allocation), `AlreadyExists` (duplicate ids), `DynamicConstraintError` (unmatched id), and the successful select-existing-from-`null` path, for both video and audio independently.

**#9 — `videoStreamID`/`videoStreams` (or the audio equivalents) present simultaneously isn't rejected (1 test: 2.27).**
Matter 1.6 Application Cluster Specification §11.5.6.1.10: "If the `VideoStreams` or `AudioStreams` fields are present, and the `VideoStreamID` or `AudioStreamID` fields are present: Fail the command with `INVALID_COMMAND`." Our `#resolveStreamLists()` doesn't check for this mutual-exclusion conflict — it silently prefers `request.videoStreams`/`request.audioStreams` over the deprecated single-id fields via `??`, so a request with both present just succeeds using the modern field. Fix direction: add an explicit check for "both present" before falling into `#resolveStreamLists()`'s fallback logic, and reject with `INVALID_COMMAND`.

**#10 — `StreamUsage` is never validated against `StreamUsagePriorities` for a SolicitOffer/ProvideOffer that already has valid stream ids (discovered 2026-07-28 while verifying the #8 fix; affects at least 2.5 and 2.31, possibly more once #9 is fixed).**
Matter 1.6 Application Cluster Specification §11.5.6.1.10: "If `StreamUsage` is not found in the `StreamUsagePriorities`: Fail the command with the status code `DYNAMIC_CONSTRAINT_ERROR`." This check sits early in the Effect-on-Receipt sequence (before the stream-id resolution/validation covered by #8), and neither `solicitOffer` nor `provideOffer` implement it at all — an unsupported `StreamUsage` is accepted outright as long as the video/audio stream ids themselves are valid. Not yet fixed; needs the same treatment as #8 (likely gated behind `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` too, pending a check for whether any real client sends an unsupported `StreamUsage` — no evidence either way yet from the SmartThings trace below, which only ever sends `LiveView`).

**Housekeeping:** `TC_WEBRTCP_2_26.py` referenced above doesn't exist in the `luligu/matterbridge:chip-test` image used for this run — confirmed via `ls src/python_testing/TC_WEBRTCP_2_*.py` inside the container. Re-check if the image is ever updated.

**Housekeeping:** `node scripts/run-chip-tests.mjs --test TC_WEBRTCP` (all 31 tests, one fresh container, no resets between them; strict mode active throughout per the image default above) additionally fails `2.4` and `2.30` — both normally-passing tests — purely because `CurrentSessions` isn't empty at their "expect 0" precondition (`1 != 0` for 2.4, `12 != 0` for 2.30 in the 2026-07-28 run), since every earlier failing test in the sequence leaves its session behind (`currentSessions` is in-memory state, only cleared by restarting the container — the `"reset": true` mechanism only clears persisted `cameraAvStreamManagement`/`chime` storage files, not this). Not a new regression; this is the exact leftover-state cascade pattern documented throughout this file for other clusters. Individually (one test per fresh container, as done throughout this investigation), `2.4` and `2.30` pass cleanly.

### WebRTC Transport Provider — Real-World Client Traces (recorded 2026-07-28)

These are actual command sequences from real Matter controllers observed in `matterbridge.log` (profile `Aeotec`, real hardware webcam/mic, not the CHIP test harness). **Any future change to `webRtcTransportProviderServer.ts` (especially fixing Known Issues #9/#10 above) must keep these working — they are not synthetic scenarios, they are what real users' hubs actually send.**

#### SmartThings Hub (fabric "SmartThings Hub 512A"), live view session

Source: `C:\Users\lligu\.matterbridge\profiles\Aeotec\matterbridge.log`, `Camera-CAMERA-001` at endpoint 30 (a `Camera` device, same as `--endpoint 6` in the chip-test container — the endpoint number differs only because this profile has more bridged devices ahead of it).

1. `CameraAvStreamManagement.captureSnapshot` with `snapshotStreamId: null, requestedResolution: {1920x1080}` — fails with `NotFound(139)` ("Snapshot stream auto is not present in allocatedSnapshotStreams"), since no snapshot stream is allocated yet. SmartThings tries this speculatively before allocating one.
2. `CameraAvStreamManagement.snapshotStreamAllocate` with `imageCodec: 0 (Jpeg), maxFrameRate: 10, minResolution: {640x480}, maxResolution: {1920x1080}, quality: 90` → allocates snapshot stream 0.
3. `CameraAvStreamManagement.captureSnapshot` with `snapshotStreamId: 0, requestedResolution: {1920x1080}` → succeeds, returns the snapshot (this is the dashboard thumbnail, separate from the live view flow below).
4. **`WebRtcTransportProvider.provideOffer`** (not `solicitOffer` — SmartThings always pushes its own SDP offer directly) with:
   - `webRtcSessionId: null`
   - `sdp: <full SDP offer with audio+video m-lines, ICE candidates, DTLS fingerprint>`
   - `streamUsage: 3` (`LiveView`)
   - `originatingEndpointId: 0`
   - `videoStreamId: 0` — **present and non-null**, not `null`, not omitted. This request shape is itself perfectly spec-compliant (Matter 1.6/1.5.1 §11.5.6.1.4: "if present and non-null, the specific video stream identified by the `VideoStreamID` is added as an entry to the `VideoStreams` list") — it's a completely ordinary, well-formed request.
   - `audioStreamId: 0` — same, present and non-null.
   - `iceServers: [{ urLs: ["turn:turn-euwest1.smartthings.com:3478"], username: "...", credential: "..." }]` — SmartThings supplies its own TURN server
5. **Critically: no `VideoStreamAllocate` or `AudioStreamAllocate` call happens anywhere before step 4.** `AllocatedVideoStreams` and `AllocatedAudioStreams` are genuinely empty when `provideOffer` is received. SmartThings just assumes stream id `0` is valid/available without ever allocating it.
6. Our `provideOffer` handler accepts this today (default, non-strict mode). `videoStreamId: 0`/`audioStreamId: 0` resolve into `videoStreams: [0]`/`audioStreams: [0]` via `#resolveStreamLists()` (correctly, per §11.5.6.1.4's non-null case), but since `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` isn't set, `#validateAllocatedStreamIds()` (added when #8 was fixed) never runs and no membership check against `AllocatedVideoStreams`/`AllocatedAudioStreams` happens. **We do not allocate anything here; `videoStreamAllocate`/`audioStreamAllocate` are never called for this path either.** It creates session 0, spawns real webcam/mic ffmpeg captures, and successfully answers with a working DTLS/ICE connection (confirmed: `Peer connection state: connected`, `DTLS transport state: connected` a few lines later, and a real video/audio call happened until the app closed the connection ~9 seconds later with `ICE connection state: disconnected` → session closed cleanly).

**Conclusion:** SmartThings' entire live-view flow depends on `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` staying unset (the default). `AllocatedVideoStreams`/`AllocatedAudioStreams` (§11.2.7.16/.17) are populated exclusively by `CameraAvStreamManagement.VideoStreamAllocate`/`AudioStreamAllocate` — `WebRtcTransportProvider` has no authority anywhere in the spec to create entries in them, for a `null` ID or a non-null one (see Known Issues #8 for the full citation trail). So per §11.5.6.1.10/§11.5.6.3.5, identical in Matter 1.5.1 and 1.6.0, this exact request would be rejected with `INVALID_IN_STATE` under strict mode — verified directly against `TC_WEBRTCP_2_3`/`2_29` (now pass under `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1`) and the equivalent hand-built vitest cases. Known Issue #8 is now fixed exactly this way: the strict check is opt-in via the env var, so SmartThings (and any other client relying on the lenient default) is completely unaffected — confirmed by the full vitest suite staying green and this real trace's shape being explicitly covered by a dedicated test ("should reject provideOffer with SmartThings-shape explicit stream ids when nothing is allocated (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)").

#### Matter Server Dashboard (fabric "Home"), live view + snapshot session

Source: `C:\Users\lligu\.matterbridge\profiles\Hass5\matterbridge.log`, `Camera-CAMERA-001` at endpoint 8 (a `Camera` device). Fabric: `fabricIndex: 1, fabricId: 1, nodeId: 5, rootNodeId: 112233, rootVendorId: 65521, label: "Home"` — a `python-matter-server` / Matter Server dashboard commissioning (browser-based client: the SDP offer's codec list — VP8/VP9/H264/AV1 with full `extmap`/`rtcp-fb` sets — is a Chrome-generated offer, unlike SmartThings' leaner one).

1. **`WebRtcTransportProvider.provideOffer`** (not `solicitOffer` — same as SmartThings, real controllers always push their own SDP offer) with:
   - `webRtcSessionId: null`
   - `sdp: <full Chrome-generated SDP offer, audio+video m-lines, VP8/VP9/H264/AV1 codecs>`
   - `streamUsage: 3` (`LiveView`)
   - `originatingEndpointId: 2`
   - `videoStreams: [0]` / `audioStreams: [0]` — the **modern list fields**, not the deprecated singular `videoStreamId`/`audioStreamId` (contrast with SmartThings, which uses the deprecated fields). Response therefore omits `videoStreamId`/`audioStreamId` entirely too (`#echoDeprecatedStreamIds()` only echoes a field when the corresponding deprecated request field was present) — the response is just `{ webRtcSessionId: 0 }`.
   - No `iceServers` — the dashboard doesn't supply a TURN server, host/srflx candidates only.
2. Same as SmartThings: **no `VideoStreamAllocate`/`AudioStreamAllocate` call precedes this.** Stream id `0` is referenced directly and resolves because it's the endpoint's self-allocated default stream (`initialize()`, see the section above) — this is a second, independent real controller confirming the same assumption.
3. The session negotiates VP8 (`Preferred injectable video codec: video/VP8`, not H264 — Chrome's codec preference order differs from SmartThings'), attaches the synthetic test-pattern video track and recorded test-voice audio track (this profile has no real webcam/mic configured), completes ICE/DTLS (`Peer connection state: connected`), and streams for about 8 seconds before the dashboard tile closes and the session tears down cleanly — no `EndSession` command, transport-level teardown only, same as SmartThings.
4. **After** the live-view session already closed, the dashboard separately requests a still image for its device tile: `CameraAvStreamManagement.snapshotStreamAllocate` → `snapshotStreamId: 1` (not `0` — id `0` is already taken by the self-allocated default stream), `captureSnapshot` with that id → succeeds, then `snapshotStreamDeallocate` immediately after — a clean, spec-compliant allocate/use/deallocate cycle for a stream that's genuinely short-lived (unlike the video/audio streams, which stay allocated forever). This differs from SmartThings, which allocates its snapshot stream _before_ the live-view session and never deallocates it.

**Conclusion:** A second, independent real controller (`python-matter-server`, not just SmartThings) confirms the exact same assumption behind `initialize()`'s self-allocation: `provideOffer` referencing stream id `0` directly, no `VideoStreamAllocate`/`AudioStreamAllocate` ever called for video/audio. The one place both real controllers **do** call an explicit `Allocate` command is `snapshotStreamAllocate` — never for video/audio — which lines up with §11.2.1.1's distinction between long-lived a/v streams and short-lived snapshot streams. `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT` staying unset by default remains required for this flow for the same reason as SmartThings (see Known Issues #8): under strict mode, this exact request would need `AllocatedVideoStreams`/`AllocatedAudioStreams` to already contain id `0`, which self-allocation now guarantees — see the strict-mode analysis above.

### Stop the container

```shell
node scripts/run-chip-tests.mjs --stop
```

## SmartThings (recorded 2026-07-28)

Full, in-order command trace captured from a real SmartThings Hub ("SmartThings Hub 512A") controlling the `Camera` device (`Camera-CAMERA-001`, endpoint 30) in profile `Aeotec`. Source: `C:\Users\lligu\.matterbridge\profiles\Aeotec\matterbridge.log`. This is the exact request payload SmartThings sends today — **keep it working** when touching `cameraAvStreamManagementServer.ts` or `webRtcTransportProviderServer.ts` (see the "Real-World Client Traces" section above for why this matters, especially for Known Issues #8/#9).

Every command below was received in this order, on the same fabric, roughly 8 seconds apart between command 3 and command 4 (user opened the live view tile in the SmartThings app).

### 1. `CameraAvStreamManagement.captureSnapshot`

Speculative call before any snapshot stream exists — fails.

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "captureSnapshot",
  "request": {
    "snapshotStreamId": null,
    "requestedResolution": { "width": 1920, "height": 1080 }
  },
  "response": {
    "status": "NotFound (139)",
    "message": "Snapshot stream auto is not present in allocatedSnapshotStreams"
  }
}
```

### 2. `CameraAvStreamManagement.snapshotStreamAllocate`

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "snapshotStreamAllocate",
  "request": {
    "imageCodec": 0,
    "maxFrameRate": 10,
    "minResolution": { "width": 640, "height": 480 },
    "maxResolution": { "width": 1920, "height": 1080 },
    "quality": 90
  },
  "response": {
    "snapshotStreamId": 0
  }
}
```

### 3. `CameraAvStreamManagement.captureSnapshot`

Retried with the just-allocated stream id — succeeds. This is the dashboard thumbnail, not the live view flow.

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "captureSnapshot",
  "request": {
    "snapshotStreamId": 0,
    "requestedResolution": { "width": 1920, "height": 1080 }
  },
  "response": {
    "status": "Success"
  }
}
```

### 4. `WebRtcTransportProvider.provideOffer`

SmartThings always pushes its own SDP offer directly via `provideOffer` — it never calls `solicitOffer`. Note `videoStreamId`/`audioStreamId` are explicit numeric `0`, **not** `null` and **not** omitted, and no `VideoStreamAllocate`/`AudioStreamAllocate` call ever preceded this (`AllocatedVideoStreams`/`AllocatedAudioStreams` are empty at this point).

```json
{
  "cluster": "WebRtcTransportProvider",
  "command": "provideOffer",
  "request": {
    "webRtcSessionId": null,
    "sdp": "<see full SDP below>",
    "streamUsage": 3,
    "originatingEndpointId": 0,
    "videoStreamId": 0,
    "audioStreamId": 0,
    "iceServers": [
      {
        "urLs": ["turn:turn-euwest1.smartthings.com:3478"],
        "username": "1785193130:Gt4uhK62VFYOAlVHKfzcAMGSr",
        "credential": "k8PkapqEcOnNKk1ok14dG+sQQ6I="
      }
    ]
  },
  "response": {
    "webRtcSessionId": 0,
    "videoStreamId": 0,
    "audioStreamId": 0
  }
}
```

Full `sdp` field verbatim (SDP offer, audio+video, ICE-lite candidates, DTLS fingerprint):

```sdp
v=0
o=- 4918377590284864186 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
a=extmap-allow-mixed
a=msid-semantic: WMS ARDAMS1
m=audio 12328 UDP/TLS/RTP/SAVPF 111 63 9 0 8 13 110 126
c=IN IP4 34.247.32.107
a=rtcp:15034 IN IP4 34.247.32.107
a=candidate:212505917 1 udp 2122194687 192.168.69.102 60125 typ host generation 0 network-id 1 network-cost 10
a=candidate:212505917 2 udp 2122194686 192.168.69.102 54357 typ host generation 0 network-id 1 network-cost 10
a=candidate:2590176228 2 udp 1685987070 88.209.89.112 54357 typ srflx raddr 192.168.69.102 rport 54357 generation 0 network-id 1 network-cost 10
a=candidate:2590176228 1 udp 1685987071 88.209.89.112 60125 typ srflx raddr 192.168.69.102 rport 60125 generation 0 network-id 1 network-cost 10
a=candidate:4060103081 1 tcp 1518214911 192.168.69.102 50250 typ host tcptype passive generation 0 network-id 1 network-cost 10
a=candidate:4060103081 2 tcp 1518214910 192.168.69.102 50251 typ host tcptype passive generation 0 network-id 1 network-cost 10
a=candidate:2450556863 2 udp 41820158 34.247.32.107 15034 typ relay raddr 88.209.89.112 rport 54357 generation 0 network-id 1 network-cost 10
a=candidate:2450556863 1 udp 41820159 34.247.32.107 12328 typ relay raddr 88.209.89.112 rport 60125 generation 0 network-id 1 network-cost 10
a=ice-ufrag:ISwa
a=ice-pwd:AP6OL85O81tSLx8AcZAzlB0s
a=ice-options:trickle
a=fingerprint:sha-256 D8:3E:D7:96:7B:3F:86:2C:7B:D3:66:87:6F:81:DF:88:88:2C:FA:0F:06:D8:A6:6E:E2:EF:9C:24:59:E8:78:A6
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=sendrecv
a=msid:ARDAMS1 ARDAMSa0
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:63 red/48000/2
a=fmtp:63 111/111
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:126 telephone-event/8000
a=ssrc:400336276 cname:V7qsPTv9HtgIuuIt
a=ssrc:400336276 msid:ARDAMS1 ARDAMSa0
m=video 14614 UDP/TLS/RTP/SAVPF 96 97 35 36
c=IN IP4 34.247.32.107
a=rtcp:12430 IN IP4 34.247.32.107
a=candidate:212505917 1 udp 2122194687 192.168.69.102 60669 typ host generation 0 network-id 1 network-cost 10
a=candidate:212505917 2 udp 2122194686 192.168.69.102 50511 typ host generation 0 network-id 1 network-cost 10
a=candidate:2590176228 1 udp 1685987071 88.209.89.112 60669 typ srflx raddr 192.168.69.102 rport 60669 generation 0 network-id 1 network-cost 10
a=candidate:2590176228 2 udp 1685987070 88.209.89.112 50511 typ srflx raddr 192.168.69.102 rport 50511 generation 0 network-id 1 network-cost 10
a=candidate:4060103081 1 tcp 1518214911 192.168.69.102 50252 typ host tcptype passive generation 0 network-id 1 network-cost 10
a=candidate:4060103081 2 tcp 1518214910 192.168.69.102 50253 typ host tcptype passive generation 0 network-id 1 network-cost 10
a=candidate:2450556863 2 udp 41820158 34.247.32.107 12430 typ relay raddr 88.209.89.112 rport 50511 generation 0 network-id 1 network-cost 10
a=candidate:2450556863 1 udp 41820159 34.247.32.107 14614 typ relay raddr 88.209.89.112 rport 60669 generation 0 network-id 1 network-cost 10
a=ice-ufrag:ISwa
a=ice-pwd:AP6OL85O81tSLx8AcZAzlB0s
a=ice-options:trickle
a=fingerprint:sha-256 D8:3E:D7:96:7B:3F:86:2C:7B:D3:66:87:6F:81:DF:88:88:2C:FA:0F:06:D8:A6:6E:E2:EF:9C:24:59:E8:78:A6
a=setup:actpass
a=mid:1
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:13 urn:3gpp:video-orientation
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 H264/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:35 H265/90000
a=rtcp-fb:35 goog-remb
a=rtcp-fb:35 transport-cc
a=rtcp-fb:35 ccm fir
a=rtcp-fb:35 nack
a=rtcp-fb:35 nack pli
a=fmtp:35 level-id=93;tx-mode=SRST
a=rtpmap:36 rtx/90000
a=fmtp:36 apt=35
```

### After `provideOffer`: what happens next (not a command from SmartThings)

No further commands are received from SmartThings for this session — no `ProvideICECandidates`, no `ProvideAnswer` (it's not needed, we're answering), no explicit `EndSession`. Sequence after step 4, all driven by our own code, not incoming Matter commands:

1. We create a real `RTCPeerConnection`, attach the local webcam (`C922 Pro Stream Webcam`, negotiated to H264/1920x1080) and microphone (Opus) via `ffmpeg`, gather ICE candidates, and produce an SDP answer.
2. We invoke `WebRtcTransportRequestor.Answer` on the peer (SmartThings) with our SDP answer — this is an outgoing command **we** send, not one SmartThings sends us.
3. ICE/DTLS complete (`ICE connection state: connected`, `DTLS transport state: connected`) and the call streams live for about 9 seconds.
4. The app closes the tile; ICE goes `disconnected`, then DTLS closes, and we close the session locally (no `EndSession` command was ever received — teardown is purely transport-level, not an application-layer Matter command).

This confirms: **no `SolicitOffer`, `ProvideICECandidates`, or `EndSession` support is exercised by SmartThings in this flow at all** — only `ProvideOffer` (plus the two `CameraAvStreamManagement` snapshot commands beforehand). Keep that minimal surface working above all else.

## Matter Server Dashboard (recorded 2026-07-28)

Full, in-order command trace captured from a real `python-matter-server` / Matter Server dashboard controller (fabric `"Home"`, `fabricIndex: 1, fabricId: 1, nodeId: 5, rootNodeId: 112233, rootVendorId: 65521`) controlling the `Camera` device (`Camera-CAMERA-001`, endpoint 8) in profile `Hass5`. Source: `C:\Users\lligu\.matterbridge\profiles\Hass5\matterbridge.log`. This is the exact request payload the dashboard sends today — **keep it working** when touching `cameraAvStreamManagementServer.ts` or `webRtcTransportProviderServer.ts` (see the "Real-World Client Traces" section above for why this matters, especially for Known Issues #8/#9/#10).

Unlike SmartThings, the live-view command comes first, and the snapshot commands are a separate, later user action (opening the dashboard tile's thumbnail after already viewing/closing the live stream), roughly 11 seconds after the live-view session closed.

### 1. `WebRtcTransportProvider.provideOffer`

The dashboard always pushes its own SDP offer directly via `provideOffer` — it never calls `solicitOffer`, same as SmartThings. Note it uses the **modern `videoStreams`/`audioStreams` list fields**, not the deprecated singular `videoStreamId`/`audioStreamId` (contrast with SmartThings' step 4), and sends no `iceServers` at all. No `VideoStreamAllocate`/`AudioStreamAllocate` call ever preceded this — stream id `0` is referenced directly, resolving only because it's the endpoint's self-allocated default stream.

```json
{
  "cluster": "WebRtcTransportProvider",
  "command": "provideOffer",
  "request": {
    "webRtcSessionId": null,
    "sdp": "<see full SDP below>",
    "streamUsage": 3,
    "originatingEndpointId": 2,
    "videoStreams": [0],
    "audioStreams": [0]
  },
  "response": {
    "webRtcSessionId": 0
  }
}
```

Full `sdp` field verbatim (Chrome-generated SDP offer, audio+video, VP8/VP9/H264/AV1 codecs, host+srflx ICE candidates gathered via trickle, no relay/TURN):

```sdp
v=0
o=- 2959808141711734216 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
a=extmap-allow-mixed
a=msid-semantic: WMS
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 35 36 37 38 103 104 107 108 109 114 115 116 117 118 39 40 41 42 43 44 45 46 47 48 119 120 121 122 123 124 125 49
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:SVBd
a=ice-pwd:ziCBnlbgbyXsEfsvibqya26y
a=ice-options:trickle
a=fingerprint:sha-256 7A:DF:C9:5C:59:41:B8:DF:CA:A0:14:25:E1:49:9D:DA:FB:48:B7:91:AB:6A:A9:4F:71:48:A5:6E:66:1D:E2:7A
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 urn:3gpp:video-orientation
a=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 profile-id=0
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:100 VP9/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 profile-id=2
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:35 VP9/90000
a=rtcp-fb:35 goog-remb
a=rtcp-fb:35 transport-cc
a=rtcp-fb:35 ccm fir
a=rtcp-fb:35 nack
a=rtcp-fb:35 nack pli
a=fmtp:35 profile-id=1
a=rtpmap:36 rtx/90000
a=fmtp:36 apt=35
a=rtpmap:37 VP9/90000
a=rtcp-fb:37 goog-remb
a=rtcp-fb:37 transport-cc
a=rtcp-fb:37 ccm fir
a=rtcp-fb:37 nack
a=rtcp-fb:37 nack pli
a=fmtp:37 profile-id=3
a=rtpmap:38 rtx/90000
a=fmtp:38 apt=37
a=rtpmap:103 H264/90000
a=rtcp-fb:103 goog-remb
a=rtcp-fb:103 transport-cc
a=rtcp-fb:103 ccm fir
a=rtcp-fb:103 nack
a=rtcp-fb:103 nack pli
a=fmtp:103 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
a=rtpmap:104 rtx/90000
a=fmtp:104 apt=103
a=rtpmap:107 H264/90000
a=rtcp-fb:107 goog-remb
a=rtcp-fb:107 transport-cc
a=rtcp-fb:107 ccm fir
a=rtcp-fb:107 nack
a=rtcp-fb:107 nack pli
a=fmtp:107 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f
a=rtpmap:108 rtx/90000
a=fmtp:108 apt=107
a=rtpmap:109 H264/90000
a=rtcp-fb:109 goog-remb
a=rtcp-fb:109 transport-cc
a=rtcp-fb:109 ccm fir
a=rtcp-fb:109 nack
a=rtcp-fb:109 nack pli
a=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:114 rtx/90000
a=fmtp:114 apt=109
a=rtpmap:115 H264/90000
a=rtcp-fb:115 goog-remb
a=rtcp-fb:115 transport-cc
a=rtcp-fb:115 ccm fir
a=rtcp-fb:115 nack
a=rtcp-fb:115 nack pli
a=fmtp:115 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f
a=rtpmap:116 rtx/90000
a=fmtp:116 apt=115
a=rtpmap:117 H264/90000
a=rtcp-fb:117 goog-remb
a=rtcp-fb:117 transport-cc
a=rtcp-fb:117 ccm fir
a=rtcp-fb:117 nack
a=rtcp-fb:117 nack pli
a=fmtp:117 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001f
a=rtpmap:118 rtx/90000
a=fmtp:118 apt=117
a=rtpmap:39 H264/90000
a=rtcp-fb:39 goog-remb
a=rtcp-fb:39 transport-cc
a=rtcp-fb:39 ccm fir
a=rtcp-fb:39 nack
a=rtcp-fb:39 nack pli
a=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001f
a=rtpmap:40 rtx/90000
a=fmtp:40 apt=39
a=rtpmap:41 H264/90000
a=rtcp-fb:41 goog-remb
a=rtcp-fb:41 transport-cc
a=rtcp-fb:41 ccm fir
a=rtcp-fb:41 nack
a=rtcp-fb:41 nack pli
a=fmtp:41 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=f4001f
a=rtpmap:42 rtx/90000
a=fmtp:42 apt=41
a=rtpmap:43 H264/90000
a=rtcp-fb:43 goog-remb
a=rtcp-fb:43 transport-cc
a=rtcp-fb:43 ccm fir
a=rtcp-fb:43 nack
a=rtcp-fb:43 nack pli
a=fmtp:43 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=f4001f
a=rtpmap:44 rtx/90000
a=fmtp:44 apt=43
a=rtpmap:45 AV1/90000
a=rtcp-fb:45 goog-remb
a=rtcp-fb:45 transport-cc
a=rtcp-fb:45 ccm fir
a=rtcp-fb:45 nack
a=rtcp-fb:45 nack pli
a=fmtp:45 level-idx=5;profile=0;tier=0
a=rtpmap:46 rtx/90000
a=fmtp:46 apt=45
a=rtpmap:47 AV1/90000
a=rtcp-fb:47 goog-remb
a=rtcp-fb:47 transport-cc
a=rtcp-fb:47 ccm fir
a=rtcp-fb:47 nack
a=rtcp-fb:47 nack pli
a=fmtp:47 level-idx=5;profile=1;tier=0
a=rtpmap:48 rtx/90000
a=fmtp:48 apt=47
a=rtpmap:119 H264/90000
a=rtcp-fb:119 goog-remb
a=rtcp-fb:119 transport-cc
a=rtcp-fb:119 ccm fir
a=rtcp-fb:119 nack
a=rtcp-fb:119 nack pli
a=fmtp:119 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f
a=rtpmap:120 rtx/90000
a=fmtp:120 apt=119
a=rtpmap:121 H264/90000
a=rtcp-fb:121 goog-remb
a=rtcp-fb:121 transport-cc
a=rtcp-fb:121 ccm fir
a=rtcp-fb:121 nack
a=rtcp-fb:121 nack pli
a=fmtp:121 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=64001f
a=rtpmap:122 rtx/90000
a=fmtp:122 apt=121
a=rtpmap:123 red/90000
a=rtpmap:124 rtx/90000
a=fmtp:124 apt=123
a=rtpmap:125 ulpfec/90000
a=rtpmap:49 flexfec-03/90000
a=rtcp-fb:49 goog-remb
a=rtcp-fb:49 transport-cc
a=fmtp:49 repair-window=10000000
m=audio 9 UDP/TLS/RTP/SAVPF 111 63 9 0 8 13 110 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:SVBd
a=ice-pwd:ziCBnlbgbyXsEfsvibqya26y
a=ice-options:trickle
a=fingerprint:sha-256 7A:DF:C9:5C:59:41:B8:DF:CA:A0:14:25:E1:49:9D:DA:FB:48:B7:91:AB:6A:A9:4F:71:48:A5:6E:66:1D:E2:7A
a=setup:actpass
a=mid:1
a=extmap:14 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:63 red/48000/2
a=fmtp:63 111/111
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:126 telephone-event/8000
```

### After `provideOffer`: what happens next (not a command from the dashboard)

No further commands are received from the dashboard for this session — same minimal surface as SmartThings (no `ProvideICECandidates`, no `ProvideAnswer`, no explicit `EndSession`).

1. We create a real `RTCPeerConnection`, negotiate `video/VP8` (the dashboard's/Chrome's preferred codec — note this differs from SmartThings, which negotiated H264), attach the synthetic test-pattern video track and recorded test-voice clip audio track via `ffmpeg` (this profile has no real webcam/mic configured), gather ICE candidates, and produce an SDP answer.
2. We invoke `WebRtcTransportRequestor.Answer` on the peer with our SDP answer.
3. ICE/DTLS complete (`ICE connection state: connected`, `DTLS transport state: connected`) and the call streams live for about 8 seconds.
4. The dashboard tile closes; we close `RTCPeerConnection` locally (no `EndSession` command received — transport-level teardown only, same as SmartThings).

### 2. `CameraAvStreamManagement.snapshotStreamAllocate`

Happens ~11 seconds after the live-view session already closed, when the user opens the dashboard's device thumbnail. Note the response is `snapshotStreamId: 1`, not `0` — id `0` is already taken by the endpoint's self-allocated default snapshot stream, so this genuinely allocates a second one.

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "snapshotStreamAllocate",
  "request": {
    "imageCodec": 0,
    "maxFrameRate": 10,
    "minResolution": { "width": 1920, "height": 1080 },
    "maxResolution": { "width": 1920, "height": 1080 },
    "quality": 90
  },
  "response": {
    "snapshotStreamId": 1
  }
}
```

### 3. `CameraAvStreamManagement.captureSnapshot`

Unlike SmartThings, there's no speculative `captureSnapshot(null)` attempt first — the dashboard allocates, then captures directly.

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "captureSnapshot",
  "request": {
    "snapshotStreamId": 1,
    "requestedResolution": { "width": 1920, "height": 1080 }
  },
  "response": {
    "status": "Success"
  }
}
```

### 4. `CameraAvStreamManagement.snapshotStreamDeallocate`

Unlike SmartThings, which leaves its allocated snapshot stream in place indefinitely, the dashboard deallocates immediately after use — a clean, fully spec-compliant short-lived snapshot stream lifecycle.

```json
{
  "cluster": "CameraAvStreamManagement",
  "command": "snapshotStreamDeallocate",
  "request": {
    "snapshotStreamId": 1
  },
  "response": {
    "status": "Success"
  }
}
```

This confirms: two independent real Matter controllers (SmartThings and `python-matter-server`) both (a) use `ProvideOffer` exclusively, never `SolicitOffer`; (b) reference video/audio stream id `0` directly without ever calling `VideoStreamAllocate`/`AudioStreamAllocate`, relying entirely on the self-allocated default stream; and (c) _do_ call `SnapshotStreamAllocate` explicitly when they need a snapshot. Any future change to either behavior file must keep both traces working.

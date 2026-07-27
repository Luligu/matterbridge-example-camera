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

# Camera AV Stream Management ✅ (all pass except 2.7 for test bug)
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

```

### Stop the container

```shell
node scripts/run-chip-tests.mjs --stop
```

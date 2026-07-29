---
description: 'How the CHIP conformance test harness works for a Matterbridge plugin v.1.3.0'
paths:
  - 'chipTests.json'
  - 'chipTests.md'
  - 'chipTests.log'
  - 'chipTestsSummary.log'
  - 'scripts/run-chip-tests.mjs'
---

# CHIP Conformance Test Harness

A Matterbridge plugin can be validated against the Matter CHIP certification test suite — both the Python
test scripts and the YAML certification tests used by the CSA's own CI — running inside the
`luligu/matterbridge:chip-test` Docker image. The harness is driven entirely by
`scripts/run-chip-tests.mjs` and configured by `chipTests.json`, both dropped into the plugin repo's root.
The script is not specific to any one plugin: it reads the plugin name, config, and test list from
`chipTests.json`, so the same `run-chip-tests.mjs` works unmodified across plugin repos — copy it as-is and
only author a `chipTests.json` for the new repo.

## 1. What the container is

- Image `luligu/matterbridge:chip-test` bundles a Matterbridge instance plus a full
  `connectedhomeip`/`chip-tool` checkout with the Python test suite under `src/python_testing/` (relative
  to the container's default working directory), the YAML certification test suite under
  `src/app/tests/suites/certification/`, the YAML test runner CLI at
  `scripts/tests/chipyaml/chiptool.py`, and `chip-tool` itself at `/root/connectedhomeip/out/host/chip-tool`.
- The container is always named `chip-test` (`containerName` in the script).
- `chip-tool`'s own persistent storage inside the image already holds a fabric paired with the matterbridge
  instance — this is what makes the YAML tests runnable without a separate commissioning step (see §5).
  There is no long-running server process baked into the image; each YAML test invocation spawns its own
  short-lived `chip-tool interactive server`, runs, and tears it down again.
- It runs on the `matterbridge` docker network, mapping the frontend to host port `8585`, mounting `./temp`
  to `/tmp/matter_testing/logs` (test artifacts) and the plugin repo to `/root/Matterbridge/<pluginName>`,
  where `<pluginName>` comes from `chipTests.json`'s `config.name`.
- A curated PICS (Protocol Implementation Conformance Statement) file is baked into the image at
  `/root/matterbridge.pics`, hand-verified against Matterbridge's own default cluster server
  implementations (see `matterbridge/docker/chip-test/matterbridge.pics` in the `matterbridge` repo — the
  source lives there, not in the plugin repo). Prefer this file over the generic
  `src/app/tests/suites/certification/ci-pics-values` (the CSA's own near-blanket CI profile) whenever a
  hand-verified section exists for the cluster under test — it is what makes tests like
  `TC_BINFO_*`/`TC_BRBINFO_*` behave correctly instead of asserting on attributes a real device doesn't
  support. If the cluster you're testing has no section yet in `matterbridge.pics`, either add one there
  (cross-referencing the Matter spec and the real cluster-server source) or fall back to the generic PICS
  file for that test.

## 2. Lifecycle commands

```shell
node scripts/run-chip-tests.mjs --start   # create the container, npm install/link/build, copy the plugin in, matterbridge --add, write config, restart
node scripts/run-chip-tests.mjs           # run every test in chipTests.json's "yamlTests" and "phytonTests" arrays against the running container
node scripts/run-chip-tests.mjs --test X  # run only tests whose "name" or "test" (filename) includes X, case-insensitive substring match
node scripts/run-chip-tests.mjs --stop    # docker stop the container, then npm install/link/build locally to restore the local dev environment
```

Expose these as `npm run` shortcuts in `package.json`, e.g. `chip:start`, `chip:test`, `chip:test:<cluster>`
(filtered by the `TC_*` prefix of the test file), `chip:stop`. Add a new `chip:test:<name>` shortcut
whenever a new cluster's tests are added to `chipTests.json`.

**Always run `--stop` after any container-based investigation.** On Windows especially, `--start`/`--stop`
swap `node_modules` native binaries (oxlint/oxfmt/tsc addons/etc.) between the container's platform (Linux,
from the container-side npm install) and the local platform — until `--stop` has run and rebuilt cleanly,
do not trust local lint/format/typecheck output.

## 3. `chipTests.json` shape

```jsonc
{
  "config": {
    /* the plugin's config.json content, written into the container as
       /root/.matterbridge/<config.name>.config.json before the final restart in --start.
       "config.name" is also used as the plugin (npm package) name for the container's
       volume mount and `matterbridge --add`. */
  },
  "resetClusterGlobs": [
    /* filename globs, matched against files under this plugin's node storage directory for the
       bridged endpoints, cleared by any test entry that sets "reset": true. Required (non-empty)
       if any test uses "reset": true — the script fails loudly rather than silently skipping the
       reset if this is empty. */
  ],
  "yamlTests": [
    // optional, defaults to []. "test" is a YAML certification test name (no extension, e.g.
    // "Test_TC_I_2_1") from src/app/tests/suites/certification/, run via:
    //   python3 scripts/tests/chipyaml/chiptool.py tests <test.test> <args...>
    // This spawns a short-lived "chip-tool interactive server" for the duration of the one test, reusing
    // chip-tool's own persisted fabric pairing baked into the image — see §5. Config values the YAML file
    // declares (e.g. "endpoint") become CLI flags, so "args": ["--endpoint 6"] overrides the file's own
    // default. Pass "--PICS /root/matterbridge.pics" in args when a hand-verified section exists for the
    // cluster under test (see §1) — the tool's own default is the generic ci-pics-values file.
    {
      "name": "Human-readable label, matched by --test",
      "test": "Test_TC_SOMETHING_1_2",
      "args": ["--endpoint 6"],
    },
  ],
  "phytonTests": [
    // optional, defaults to [].
    {
      "name": "Human-readable label, matched by --test",
      "test": "TC_SOMETHING_1_2.py", // filename under src/python_testing/ inside the container
      "args": ["--endpoint 6", "--PICS /root/matterbridge.pics"], // optional, split on whitespace per entry
      "input": "y\ny\n", // optional, piped to stdin for tests that prompt for interactive confirmation
      "reset": true, // optional: clear resetClusterGlobs + restart matterbridge before this test
      "comment": "optional free text, printed under a failing/skipped result in the summary log",
    },
  ],
}
```

## 4. Mapping the plugin's own endpoint/cluster composition

Every plugin composes its own device tree, so there is no universal endpoint map — discover it fresh for
each plugin rather than assuming numbers carry over between repos, and re-verify after adding, removing, or
reordering registered devices. Endpoint 0 is always the root node (`BasicInformation`, not
`BridgedDeviceBasicInformation` — use `matterbridge.pics`'s `BINFO.*` section there, not `BRBINFO.*`).
Endpoint 1 is typically the aggregator. Everything above that depends on registration order in the plugin's
own platform/module code.

To discover which endpoint exposes which cluster, write a throwaway Python script using the same
`matter.testing` framework the real tests use (it already handles commissioning against the container's
fixed pairing credentials), copy it into `src/python_testing/` inside the container, run it, then delete it
— it is not part of the image and must not be left behind:

```python
import matter.clusters as Clusters
from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main

class DumpEndpoints(MatterBaseTest):
    @async_test_body
    async def test_dump(self):
        wildcard = await self.default_controller.ReadAttribute(self.dut_node_id, [()])
        for ep, clusters in sorted(wildcard.items()):
            print(f"EP {ep}: {sorted(c.__name__ for c in clusters.keys())}")

if __name__ == "__main__":
    default_matter_test_main()
```

`chip-tool` is also present (`/root/connectedhomeip/out/host/chip-tool`) but needs its own separate
commissioning (different fabric/storage) — the Python-script approach above is simpler since it reuses the
test framework's own commissioning path.

Once discovered, note the endpoint/cluster map for the plugin (e.g. in its own `chipTests.md`) so future
work doesn't have to rediscover it from scratch — but re-verify before trusting it if the plugin's device
registration has changed since.

## 5. YAML certification tests vs. Python test files

Not every `TC_<CLUSTER>_<n>_<m>` certification test ID has a corresponding `.py` file in
`src/python_testing/`. Some certification tests are YAML-only — e.g. for Identify, `TC_I_2_1`/`2_2`/`2_3`
are YAML-only (`Test_TC_I_2_1.yaml` etc. under `src/app/tests/suites/certification/`), while only
`TC_I_2_4.py` exists as a Python test. These are not unrunnable — run them as `yamlTests` entries (§3), not
as a documented gap. Before assuming a test is "missing" from `chipTests.json`, check both:

```shell
docker exec chip-test bash -c "cd /root/connectedhomeip && timeout 30 python3 scripts/tests/chipyaml/chiptool.py list" | grep -iE 'Test_TC_<CLUSTER>_'
docker exec chip-test bash -c "ls src/python_testing/ | grep -E '^TC_<CLUSTER>_'"
```

(prefix with `MSYS_NO_PATHCONV=1` on Windows, see §7) — do not assume a numbering gap is an oversight.

### Running a YAML test manually

```shell
docker exec -i chip-test python3 scripts/tests/chipyaml/chiptool.py tests Test_TC_I_2_1 --endpoint 7
```

- Do **not** add `--server_name`/`--server_path`. Left at its default (`server_name='chip-tool'`), the
  runner resolves the `chip-tool` binary and spawns its own `chip-tool interactive server --port 9002` for
  the duration of the test, then tears it down — this works cleanly against a freshly-started container.
  A stray leftover `chip-tool interactive server` process from a killed/timed-out previous invocation (e.g.
  a shell-level `timeout` that killed the parent but orphaned its spawned child) can end up bound to port
  9002 and make the _next_ spawn attempt fail with `lws_create_vhost: init server failed` →
  `CHIP Error 0x000000AC: Internal error`. If that happens, find and kill the orphan
  (`docker exec chip-test bash -c "ps aux | grep 'chip-tool interactive'"`) rather than working around it
  with `--server_name ""` — reusing an ad hoc orphaned process is not a documented or supported mode.
- `tests <TestName>` (no `.yaml` extension) is the subcommand; extra flags after the test name (e.g.
  `--endpoint 7`) override that test's own `config:` block in the YAML file.
- `chiptool.py list` prints every runnable YAML test name (individual tests and named collections) — use it
  to discover what exists for a cluster instead of guessing filenames.
- The default `--PICS` is the generic `src/app/tests/suites/certification/ci-pics-values` (see §1); pass
  `--PICS /root/matterbridge.pics` explicitly only if that file has a hand-verified section for the cluster
  under test — check its content first (and diff step counts with/without it), since an inaccurate section
  will silently under- or over-skip steps rather than erroring.

## 6. Test exclusion reasons — do not assume PICS can fix everything

Some certification tests are permanently inapplicable regardless of PICS content, because they are gated by
something other than a PICS flag:

- `@run_if_endpoint_matches(has_attribute(...))` — probes the **live** attribute list on the real DUT, not
  PICS. If the attribute genuinely isn't implemented by the plugin/Matterbridge (e.g. `ProductAppearance`),
  the test always skips.
- `write_to_app_pipe(...)` / `--app-pipe` — a debug named-pipe protocol only the CSA's own reference
  `all-clusters-app`/`bridge-app` implements to simulate out-of-band config changes. No real device
  (including a Matterbridge plugin) can support this.
- Tests requiring `fabric-sync-app`/`fabric-admin`/`fabric-bridge`/`TH_ICD_SERVER` — an entirely different
  multi-app test topology, not something `--endpoint` against a single bridge can satisfy.

Check a test's actual gating (`grep -n 'run_if_endpoint_matches\|has_attribute\|app_pipe\|app-pipe' src/python_testing/TC_X.py`
inside the container) before concluding a PICS change would unlock it.

## 7. Windows/Git Bash quoting

Manual `docker exec`/`docker cp` invocations via a POSIX-shell tool on Windows must be prefixed with
`MSYS_NO_PATHCONV=1`, otherwise Git Bash mangles POSIX-style container paths (e.g. `/root/matterbridge.pics`
gets translated to a Windows path before reaching `docker`).

## 8. Verifying any change to this harness

After editing `chipTests.json`, `chipTests.md`, `run-chip-tests.mjs`, or `matterbridge.pics` (in the
`matterbridge` repo), always re-verify end-to-end rather than trusting the edit alone:

1. `node scripts/run-chip-tests.mjs --start`
2. `node scripts/run-chip-tests.mjs --test <NAME>` for the affected test(s)
3. `node scripts/run-chip-tests.mjs --stop`
4. Run the plugin's formatter/linter check on the touched files.

Keep `chipTests.md`'s manual-run shell block and prose in sync with `chipTests.json` whenever tests are
added, removed, or re-gated on a different PICS file/endpoint.

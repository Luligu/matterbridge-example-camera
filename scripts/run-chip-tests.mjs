/**
 * run-chip-tests.mjs
 * Version: 1.0.0
 *
 * Manage the `luligu/matterbridge:chip-test` docker container for this plugin and run the
 * Matter CHIP python test suite defined in chipTests.json, logging full results to chipTests.log
 * and just the pass/fail summary to chipTestsSummary.log.
 * Each chipTests.json entry may set an "input" string, piped to the test's stdin, for tests
 * that prompt for interactive confirmation (for example "y\ny\n").
 *
 * Usage:
 *   node scripts/run-chip-tests.mjs --start          Create the chip-test container and add/enable the plugin inside it.
 *   node scripts/run-chip-tests.mjs --stop           Stop the chip-test container, then reinstall, relink, and rebuild the local matterbridge instance.
 *   node scripts/run-chip-tests.mjs                  Run the tests listed in chipTests.json inside the running container.
 *   node scripts/run-chip-tests.mjs --test NAME       Run only the tests whose "name" or "test" property includes NAME (case-insensitive).
 *
 * A chipTests.json entry may set "reset": true to clear persisted stateful cluster storage (for example
 * CameraAvStreamManagement allocated streams) and restart the matterbridge process before that test runs,
 * without recreating the container (no docker rm/pull/npm install/build). This is much cheaper than --start
 * and is only needed for tests that depend on starting from a clean, un-allocated device state.
 */

/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const containerName = 'plugin-chip-test';
const image = 'luligu/matterbridge:chip-test';
const pluginName = 'matterbridge-example-camera';
const testsFile = resolve(root, 'chipTests.json');
const logFile = resolve(root, 'chipTests.log');
const summaryLogFile = resolve(root, 'chipTestsSummary.log');
// Node storage for the bridged endpoints; only stateful cluster attributes that get written during a
// test create a file here, so these globs only ever remove test-mutated state, never device identity.
const matterstorageRoot = '/root/.matterbridge/matterstorage/Matterbridge';
const statefulClusterGlobs = ['*.cameraAvStreamManagement.*', '*.chime.*'];
// Printed once the plugin has finished (re)configuring its devices after a restart; polled from `docker
// logs`. The node coming online happens well before this and is not sufficient: on an already-commissioned
// restart the node skips straight to "online", but the plugin (and its cluster state) isn't ready for
// another ~30s after that, so waiting on the node-online line alone lets tests race a half-configured plugin.
const readyLogMarker = `Platform ${pluginName} configured successfully`;
const isWindows = process.platform === 'win32';
// On Windows npm is a .cmd shim, not a PE executable: spawnSync can't CreateProcess it directly
// (ENOENT/EINVAL even when resolved to npm.cmd), so it must be run through the shell.
const npmCommand = 'npm';

class ExitError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function fail(message, code = 1) {
  throw new ExitError(message, code);
}

function run(command, args, options = {}) {
  const { capture = false, shell = false } = options;
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
    shell,
  });

  if (result.error) {
    fail(`Failed to run "${command} ${args.join(' ')}": ${result.error.message}`);
  }

  return result;
}

function runOrFail(command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    fail(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
  }
  return result;
}

// Safe for the plain alphanumeric/path-like tokens this script passes to npm; quotes anything else for cmd.exe.
function quoteShellArg(arg) {
  if (/^[A-Za-z0-9_.\-:/=]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '""')}"`;
}

function runNpm(args, options) {
  if (!isWindows) {
    return run(npmCommand, args, options);
  }

  // Node deprecates passing an args array together with shell: true (DEP0190) because the
  // arguments are not escaped; fold the already-quoted command line into a single string instead.
  const commandLine = [npmCommand, ...args].map(quoteShellArg).join(' ');
  return run(commandLine, [], { ...options, shell: true });
}

function runNpmOrFail(args, options) {
  const result = runNpm(args, options);
  if (result.status !== 0) {
    fail(`Command failed (exit ${result.status}): npm ${args.join(' ')}`);
  }
  return result;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// npm prune renames native addon files (oxlint/oxfmt .node bindings) as it removes them, which
// briefly races with editors/LSPs that keep those binaries open on Windows (EBUSY/EPERM). Retry
// a few times, then warn and continue rather than aborting the whole container setup, mirroring
// the locked-file handling in scripts/clean.mjs and scripts/deep-clean.mjs.
function pruneDevDependencies() {
  const args = ['prune', '--omit=dev', '--no-fund', '--no-audit', '--verbose'];
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runNpm(args);
    if (result.status === 0) {
      return;
    }

    if (attempt === maxAttempts) {
      console.warn(
        `npm prune failed after ${maxAttempts} attempts (exit ${result.status}) — likely a devDependency binary locked by an editor process. Continuing without pruning.`,
      );
      return;
    }

    console.warn(`npm prune failed (exit ${result.status}), retrying in 1s...`);
    sleepSync(1000);
  }
}

function start() {
  console.log('Removing any existing chip-test container...');
  run('docker', ['rm', containerName, '-f']);

  console.log(`Pulling ${image}...`);
  runOrFail('docker', ['pull', image]);

  console.log('Starting the chip-test container...');
  runOrFail('docker', [
    'run',
    '-dit',
    '--network',
    'matterbridge',
    '--restart',
    'always',
    '--stop-timeout',
    '60',
    '--name',
    containerName,
    '-p',
    '8585:8283',
    '-v',
    `${join(root, 'temp')}:/tmp/matter_testing/logs`,
    '-v',
    `${root}:/root/Matterbridge/${pluginName}`,
    image,
  ]);

  console.log('Installing dependencies and building the plugin...');
  runNpmOrFail(['install', '--no-fund', '--no-audit', '--verbose']);
  runNpmOrFail(['link', 'matterbridge', '--no-fund', '--no-audit', '--verbose']);
  runNpmOrFail(['run', 'build']);
  pruneDevDependencies();

  console.log('Adding the plugin to the container...');
  runOrFail('docker', ['exec', containerName, 'matterbridge', '--add', pluginName]);

  console.log('Restarting the container...');
  runOrFail('docker', ['restart', containerName]);

  console.log('Chip-test container ready.');
}

function stop() {
  console.log('Stopping the chip-test container...');
  run('docker', ['stop', containerName]);

  console.log('Restoring devDependencies and relinking the local matterbridge instance...');
  runNpmOrFail(['install', '--no-fund', '--no-audit', '--verbose']);
  runNpmOrFail(['link', 'matterbridge', '--no-fund', '--no-audit', '--verbose']);
  runNpmOrFail(['run', 'build']);

  console.log('Chip-test container stopped.');
}

// Waits for matterbridge to finish re-commissioning its server node after a restart by polling the
// container logs for readyLogMarker, so the next test doesn't race a not-yet-ready device.
function waitForContainerReady(timeoutMs = 45000, pollMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = run('docker', ['logs', '--tail', '80', containerName], { capture: true });
    // Matterbridge colorizes its log output with ANSI escapes even without a TTY, splitting the marker
    // text across escape sequences (e.g. "Matterbridge " <esc> "is online"); strip them before matching.
    // eslint-disable-next-line no-control-regex
    const plainOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    if (plainOutput.includes(readyLogMarker)) {
      return;
    }
    sleepSync(pollMs);
  }
  console.warn(`Timed out waiting for "${readyLogMarker}" in container logs; continuing anyway.`);
}

// Clears persisted stateful cluster storage and restarts the matterbridge process inside the already
// running container, without recreating it (no docker rm/pull/npm install/build), so tests that need a
// clean, un-allocated device state can run fast without paying the full --start cost between every test.
function resetContainerState() {
  console.log('Resetting stateful cluster storage...');
  const findExpr = statefulClusterGlobs.map((glob) => `-name '${glob}'`).join(' -o ');
  run('docker', ['exec', containerName, 'sh', '-c', `find ${matterstorageRoot} -type f \\( ${findExpr} \\) -delete`]);

  console.log('Restarting matterbridge...');
  runOrFail('docker', ['restart', containerName]);
  waitForContainerReady();
}

function loadTests() {
  let raw;
  try {
    raw = readFileSync(testsFile, 'utf8');
  } catch (error) {
    fail(`Unable to read ${testsFile}: ${error.message}`);
    return [];
  }

  const parsed = JSON.parse(raw);
  const tests = parsed.phytonTest;
  if (!Array.isArray(tests)) {
    fail(`Expected a "phytonTest" array in ${testsFile}`);
  }
  for (const test of tests) {
    if (!test.test) {
      fail(`Missing "test" file name for entry ${JSON.stringify(test)} in ${testsFile}`);
    }
  }
  return tests;
}

function buildArgs(test) {
  const scriptArgs = [];
  for (const entry of test.args ?? []) {
    scriptArgs.push(...entry.split(/\s+/).filter(Boolean));
  }
  return scriptArgs;
}

function filterTests(tests, nameFilter) {
  if (!nameFilter) {
    return tests;
  }

  const needle = nameFilter.toLowerCase();
  const filtered = tests.filter((test) => test.name.toLowerCase().includes(needle) || test.test.toLowerCase().includes(needle));
  if (filtered.length === 0) {
    fail(`No test found with "name" or "test" including ${JSON.stringify(nameFilter)}`);
  }
  return filtered;
}

function runTests(nameFilter) {
  const tests = filterTests(loadTests(), nameFilter);
  const startedAt = `Chip tests run started at ${new Date().toISOString()}\n\n`;
  writeFileSync(logFile, startedAt);

  const results = [];
  for (const test of tests) {
    const scriptPath = `src/python_testing/${test.test}`;
    const args = buildArgs(test);
    const commandLine = ['python3', scriptPath, ...args].join(' ');
    const label = `${test.name} (${test.test})`;

    if (test.reset) {
      appendFileSync(logFile, `--- reset stateful cluster storage before ${label} ---\n`);
      resetContainerState();
    }

    console.log(`Running: ${label}`);
    appendFileSync(logFile, `=== ${label} ===\n${commandLine}\n`);

    const result = spawnSync('docker', ['exec', '-i', containerName, 'python3', scriptPath, ...args], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      input: test.input ?? '',
    });

    appendFileSync(logFile, `${result.stdout ?? ''}${result.stderr ?? ''}\n`);

    const passed = result.status === 0;
    appendFileSync(logFile, `Result: ${passed ? 'PASS' : 'FAIL'} (exit ${result.status})\n\n`);
    console.log(passed ? `PASS: ${label}` : `FAIL: ${label} (exit ${result.status})`);

    results.push({ label, passed, comment: test.comment });
  }

  const passedCount = results.filter((result) => result.passed).length;
  const resultLines = results.flatMap((result) => {
    const line = `${result.passed ? '✅' : '❌'} ${result.label}`;
    return result.passed || !result.comment ? [line] : [line, `   ↳ ${result.comment}`];
  });
  const summary = `Summary: ${passedCount}/${results.length} tests passed.`;

  appendFileSync(logFile, `${resultLines.join('\n')}\n\n${summary}\n`);
  writeFileSync(summaryLogFile, `${startedAt}${resultLines.join('\n')}\n\n${summary}\n`);
  console.log(resultLines.join('\n'));
  console.log(summary);

  if (passedCount !== results.length) {
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--start')) {
    start();
    return;
  }

  if (args.includes('--stop')) {
    stop();
    return;
  }

  const testFlagIndex = args.indexOf('--test');
  if (testFlagIndex === -1) {
    runTests();
    return;
  }

  const nameFilter = args[testFlagIndex + 1];
  if (!nameFilter) {
    fail('--test requires a NAME argument');
  }
  runTests(nameFilter);
}

try {
  main();
} catch (error) {
  if (error instanceof ExitError) {
    if (error.message) console.error(error.message);
    process.exitCode = error.code;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

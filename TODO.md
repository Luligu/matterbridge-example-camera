# To do list

## Validate the TLS processing order of PR #40 (local session)

PR [#40](https://github.com/Luligu/matterbridge-example-camera/pull/40) changed the processing order of the TLS Certificate Management and TLS Client Management servers to follow Matter 1.6.1. It was written in a cloud session that has no IPv6, so neither the vitest suite nor the CHIP harness could run there: matter.js mDNS cannot bind `[::]:5353` (`EAFNOSUPPORT`). The vitest suite passed in CI; the CHIP tests still need a local run.

1. Run the unit tests with coverage and confirm the 100% threshold:

   ```bash
   npm run test:coverage
   ```

2. Run the CHIP TLS tests (see `.agents/rules/chip-tests.instructions.md`):

   ```bash
   npm run chip:start
   npm run chip:test
   npm run chip:stop
   ```

3. **TC-TLSCERT-2.x**: confirm the tests accept the new check in `provisionRootCertificate` (`src/tlsCertificateManagementServer.ts`), which fails with `INVALID_IN_STATE` while the Time Synchronization UTCTime is null (Matter 1.6.1 Core § 14.4.6.1). Also confirm the new order: constraints, `INVALID_IN_STATE`, `DYNAMIC_CONSTRAINT_ERROR`, `ALREADY_EXISTS`, `NOT_FOUND` / `RESOURCE_EXHAUSTED`.

4. **TC-TLSCERT-2.10**: confirm the order of `provisionClientCertificate`: constraints, `ALREADY_EXISTS`, `NOT_FOUND`, then `DYNAMIC_CONSTRAINT_ERROR` (Matter 1.6.1 Core § 14.4.6.10).

5. **TC-TLSCLIENT-3.x**: confirm the order of `provisionEndpoint` (`src/tlsClientManagementServer.ts`): for a null EndpointID `RESOURCE_EXHAUSTED`, for a non-null EndpointID `NOT_FOUND`, before `EndpointAlreadyInstalled` (Matter 1.6.1 Core § 14.5.7.1).

6. **TC-TLSCLIENT-3.x**: check which status `removeEndpoint` must return for a TLS endpoint in use. The code returns the cluster status code `EndpointInUse` (§ 14.5.5.1), while the § 14.5.7.5 text says `INVALID_IN_STATE`. Change the code, its `// Matter 1.6.1 §` comment and the test in `vitest/tlsClientManagementServer.test.ts` only if the CHIP tests expect `INVALID_IN_STATE`.

7. If a CHIP test fails, fix the server, keep the `verify-server-endpoint-context` rules (run `/verify-server-endpoint-context`), update the tests and the CHANGELOG, then remove the completed items from this list.

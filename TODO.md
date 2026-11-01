# To do list

## TLS and Time Synchronization follow-ups of the Server Camera CHIP run

The TLS processing order of PR [#40](https://github.com/Luligu/matterbridge-example-camera/pull/40) was validated locally on 2026-11-01: the unit tests pass with 100% coverage, and all TC-TLSCERT-2.x, TC-TLSCLIENT-x.x and TC-TIMESYNC-x.x CHIP tests pass against the Server Camera (`npm run chip:test:servercamera`, see the Server Camera Root Node section of `chipTests.md`).

1. **TC-TLSCLIENT-3.x**: check which status `removeEndpoint` must return for a TLS endpoint in use. The code returns the cluster status code `EndpointInUse` (§ 14.5.5.1), while the § 14.5.7.5 text says `INVALID_IN_STATE`. No TC-TLSCLIENT test of the image covers it (TC-TLSCLIENT-3.20 checks `INVALID_IN_STATE` only for RemoveRootCertificate and RemoveClientCertificate of a certificate in use), so it stays open.

2. Run `/verify-server-endpoint-context` on the changes to `src/tlsCertificateManagementServer.ts` (context-aware ProvisionedRootCertificates and ProvisionedClientCertificates) and `src/timeSynchronizationServer.ts` (TimeZoneStatus of a scheduled TimeZone entry, SetTimeZone field constraint moved to the handler).

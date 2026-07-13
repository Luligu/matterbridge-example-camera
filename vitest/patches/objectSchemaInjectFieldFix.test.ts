/**
 * @file vitest/patches/objectSchemaInjectFieldFix.test.ts
 * @description This file contains the tests for the objectSchemaInjectFieldFix patch.
 * @author Ludovic BOUÉ
 */

const NAME = 'ObjectSchemaInjectFieldFixPatch';

// oxlint-disable-next-line import/no-unassigned-import -- side effect import: applies the patch under test.
import '../../src/patches/objectSchemaInjectFieldFix.js';

import { TlvField, TlvObject, TlvOptionalField, TlvUInt8 } from 'matterbridge/matter/types';
import { setupTest } from 'matterbridge/vitest-utils';

await setupTest(NAME);

describe('objectSchemaInjectFieldFix', () => {
  // Mirrors the WebRtcTransportProvider ProvideOfferRequest/SFrame shape that triggers
  // https://github.com/matter-js/matter.js/issues/4083: a mandatory top-level field (fabricIndex, injected by matter.js),
  // and an optional nested struct field (sFrameConfig) that a real client typically omits.
  const NestedStruct = TlvObject({ cipherSuite: TlvField(0, TlvUInt8) });
  const TestSchema = TlvObject({
    fabricIndex: TlvField(1, TlvUInt8),
    sFrameConfig: TlvOptionalField(2, NestedStruct),
  });

  it('should inject a field without throwing when an optional nested struct field is undefined', () => {
    // intentional any: simulates the partially-decoded struct matter.js injects fields into, before all mandatory fields are set.
    const value: any = {};

    expect(() => TestSchema.injectField(value, 1, 5, (fieldValue) => fieldValue === undefined)).not.toThrow();
    expect(value.fabricIndex).toBe(5);
    expect(value.sFrameConfig).toBeUndefined();
  });

  it('should still recurse into a present optional nested struct field', () => {
    // intentional any: simulates the partially-decoded struct matter.js injects fields into, before all mandatory fields are set.
    const value: any = { sFrameConfig: { cipherSuite: 1 } };

    expect(() => TestSchema.injectField(value, 1, 5, (fieldValue) => fieldValue === undefined)).not.toThrow();
    expect(value.fabricIndex).toBe(5);
    // The nested struct does not itself declare a fabricIndex field, so injection recurses into it but has nothing to set.
    expect(value.sFrameConfig).toEqual({ cipherSuite: 1 });
  });

  it('should not overwrite the target field when injectChecker rejects the current value', () => {
    // intentional any: simulates a struct where the target field was already decoded from the wire.
    const value: any = { fabricIndex: 7 };

    expect(() => TestSchema.injectField(value, 1, 5, (fieldValue) => fieldValue === undefined)).not.toThrow();
    expect(value.fabricIndex).toBe(7);
  });
});

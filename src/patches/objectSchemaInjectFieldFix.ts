/**
 * @file src/patches/objectSchemaInjectFieldFix.ts
 * @description Works around a matter.js bug in ObjectSchema.injectField (see https://github.com/matter-js/matter.js/issues/4083).
 * @author Ludovic BOUÉ
 * @created 2026-07-13
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ObjectSchema } from 'matterbridge/matter/types';

/**
 * Temporary workaround for a matter.js bug: when decoding a fabric-scoped command, matter.js injects the accessing
 * fabric index into every nested struct field of the request via `ObjectSchema.injectField`, recursing into optional
 * struct-typed fields even when the caller omitted them. When such a field is `undefined` (the common case, e.g. the
 * WebRtcTransportProvider cluster's `sFrameConfig` field), the recursive call crashes trying to read a property off
 * that `undefined` value, before any command handler runs.
 *
 * This module replaces `ObjectSchema.prototype.injectField` with the same logic, guarded to skip recursion into
 * fields that are `undefined` or `null` — matching the guard already present in the sibling `removeField` method.
 *
 * Tracking issue: https://github.com/matter-js/matter.js/issues/4083. Remove this file (and its import in module.ts)
 * once a matter.js release with the fix is picked up by matterbridge.
 */
/**
 * Replacement for ObjectSchema.prototype.injectField that skips recursing into fields whose decoded value is
 * `undefined` or `null` (the field was not provided), fixing https://github.com/matter-js/matter.js/issues/4083.
 *
 * @param {unknown} value - The struct value being decoded.
 * @param {number} fieldId - The id of the field to inject fieldValue into.
 * @param {unknown} fieldValue - The value to inject (e.g. the accessing fabric index).
 * @param {(fieldValue: unknown) => boolean} injectChecker - Returns whether injection should occur for the current field value.
 * @returns {unknown} The mutated struct value.
 */
// intentional any: patching a private field of a third-party class (TS-only privacy, not a real JS private field), and
// replacing a method with a signature typed against a generic that can't be reproduced here, to work around the
// upstream bug described above.
// oxlint-disable-next-line typescript/no-explicit-any -- see comment above.
function patchedInjectField(this: any, value: any, fieldId: number, fieldValue: unknown, injectChecker: (fieldValue: unknown) => boolean): unknown {
  for (const k in this.fieldDefinitions) {
    const field = this.fieldDefinitions[k];
    if (field.id === fieldId) {
      if (injectChecker(value[k])) {
        field.schema.validate(fieldValue);
        value[k] = fieldValue;
      }
    } else if (value[k] !== undefined && value[k] !== null) {
      value[k] = field.schema.injectField(value[k], fieldId, fieldValue, injectChecker);
    }
  }
  return value;
}
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see patchedInjectField's doc comment above.
ObjectSchema.prototype.injectField = patchedInjectField as unknown as typeof ObjectSchema.prototype.injectField;

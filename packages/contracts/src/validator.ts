import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const commonSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/common.schema.json'), 'utf-8')
);
const sosSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/sos-message.schema.json'), 'utf-8')
);

ajv.addSchema(commonSchema);
const validateSos = ajv.compile(sosSchema);

export function validateSosMessage(data: unknown): { valid: boolean; errors?: string } {
  const valid = validateSos(data);
  if (!valid) {
    return { valid: false, errors: JSON.stringify(validateSos.errors, null, 2) };
  }
  return { valid: true };
}

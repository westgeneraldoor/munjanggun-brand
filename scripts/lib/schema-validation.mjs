import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function validateAgainstSchema(data, schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return {
    valid: Boolean(valid),
    errors: (validate.errors ?? []).map((entry) => ({
      instancePath: entry.instancePath || '/',
      schemaPath: entry.schemaPath,
      keyword: entry.keyword,
      message: entry.message ?? 'schema validation failed',
    })),
  };
}

export function formatSchemaErrors(errors) {
  return errors.map((entry) => `${entry.instancePath}: ${entry.message} (${entry.schemaPath})`);
}

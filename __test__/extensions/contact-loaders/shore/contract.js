// Checks values against docs/shore-contract.openapi.json, so the tests fail
// when the code and the published contract drift apart.
//
// A small validator for the JSON Schema subset the contract uses (type, enum,
// required, properties, additionalProperties, items, minItems, maxItems,
// minimum, maximum, maxLength, pattern, oneOf, $ref), to avoid adding a
// dependency to Spoke.
//
// strict (default true): properties the schema doesn't declare are errors.
// That catches Spoke returning a field the contract doesn't document.
// Consumers are told to ignore unknown fields, so the published schemas
// themselves don't forbid them.

import path from "path";
import fs from "fs";

export const CONTRACT_PATH = path.join(
  __dirname,
  "../../../../docs/shore-contract.openapi.json"
);
export const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));

export function resolveRef(ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Unsupported $ref ${ref}`);
  }
  const target = ref
    .slice(2)
    .split("/")
    .reduce((node, key) => (node ? node[key] : undefined), contract);
  if (!target) {
    throw new Error(`Unresolved $ref ${ref}`);
  }
  return target;
}

const isType = (type, value) => {
  switch (type) {
    case "null":
      return value === null;
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return (
        value !== null && typeof value === "object" && !Array.isArray(value)
      );
    default:
      throw new Error(`Unsupported type ${type}`);
  }
};

export function validate(schema, value, { strict = true } = {}, at = "$") {
  if (schema.$ref) {
    return validate(resolveRef(schema.$ref), value, { strict }, at);
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      s => validate(s, value, { strict }, at).length === 0
    );
    return matches.length === 1
      ? []
      : [`${at}: matches ${matches.length} of oneOf, expected exactly 1`];
  }
  const errors = [];
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some(t => isType(t, value))) {
      return [
        `${at}: expected ${types.join("|")}, got ${JSON.stringify(value)}`
      ];
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} not in enum`);
  }
  if (typeof value === "string") {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${at}: longer than ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(
        `${at}: ${JSON.stringify(value)} doesn't match ${schema.pattern}`
      );
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${at}: below ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${at}: above ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${at}: fewer than ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${at}: more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) =>
        errors.push(...validate(schema.items, item, { strict }, `${at}[${i}]`))
      );
    }
  }
  if (isType("object", value) && (schema.properties || schema.required)) {
    const props = schema.properties || {};
    (schema.required || []).forEach(key => {
      if (!(key in value)) {
        errors.push(`${at}: missing ${key}`);
      }
    });
    Object.keys(value).forEach(key => {
      if (props[key]) {
        errors.push(
          ...validate(props[key], value[key], { strict }, `${at}.${key}`)
        );
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        errors.push(
          ...validate(
            schema.additionalProperties,
            value[key],
            { strict },
            `${at}.${key}`
          )
        );
      } else if (strict || schema.additionalProperties === false) {
        errors.push(`${at}: undocumented property ${key}`);
      }
    });
  }
  return errors;
}

export const schemaFor = name => ({ $ref: `#/components/schemas/${name}` });

// The documented schema for a response, e.g. responseSchema("/messages", "get", 200).
export function responseSchema(pathKey, method, status) {
  const op = contract.paths[pathKey] && contract.paths[pathKey][method];
  if (!op) {
    throw new Error(`No operation ${method} ${pathKey} in the contract`);
  }
  const response = op.responses[String(status)];
  if (!response) {
    throw new Error(
      `Status ${status} isn't documented for ${method} ${pathKey}`
    );
  }
  return response.content["application/json"].schema;
}

export function expectValid(schema, value, opts) {
  const errors = validate(schema, value, opts);
  if (errors.length) {
    throw new Error(`Contract violation:\n  ${errors.join("\n  ")}`);
  }
}

// For a supertest response from one of Spoke's endpoints.
export function expectResponseMatches(res, pathKey, method = "get") {
  expectValid(responseSchema(pathKey, method, res.status), res.body);
}

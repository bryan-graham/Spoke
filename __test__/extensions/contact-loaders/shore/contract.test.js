import fs from "fs";
import path from "path";
import {
  contract,
  resolveRef,
  validate,
  schemaFor,
  responseSchema
} from "./contract";
import {
  computeSignature,
  verifySignature
} from "../../../../src/extensions/contact-loaders/shore/lib/signing";
import { BASE_PATH } from "../../../../src/extensions/contact-loaders/shore/lib/routes";

// Keeps docs/shore-contract.md and docs/shore-contract.openapi.json honest:
// every example in the prose validates against the schema it's labeled with,
// every $ref resolves, and the signing test vectors match Spoke's code.

const MARKDOWN = fs.readFileSync(
  path.join(__dirname, "../../../../docs/shore-contract.md"),
  "utf8"
);

const labeledBlocks = label => {
  const re = new RegExp(
    `<!-- ${label}(?:: (\\w+))? -->\\n\`\`\`json\\n([\\s\\S]*?)\\n\`\`\``,
    "g"
  );
  const out = [];
  let match;
  while ((match = re.exec(MARKDOWN))) {
    out.push({ name: match[1], json: JSON.parse(match[2]) });
  }
  return out;
};

describe("shore contract documents", () => {
  it("resolves every $ref in the OpenAPI file", () => {
    const refs = [];
    const walk = node => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === "object") {
        if (typeof node.$ref === "string") {
          refs.push(node.$ref);
        }
        Object.values(node).forEach(walk);
      }
    };
    walk(contract);
    expect(refs.length).toBeGreaterThan(20);
    refs.forEach(ref => expect(() => resolveRef(ref)).not.toThrow());
  });

  it("documents a JSON body for every response", () => {
    Object.entries(contract.paths).forEach(([pathKey, item]) => {
      ["get", "post"].forEach(method => {
        if (!item[method]) {
          return;
        }
        Object.keys(item[method].responses).forEach(status => {
          expect(() => responseSchema(pathKey, method, status)).not.toThrow();
        });
      });
    });
  });

  it("has every labeled example in shore-contract.md match its schema exactly", () => {
    const examples = labeledBlocks("example");
    expect(examples.map(e => e.name).sort()).toEqual(
      [
        "CampaignsPage",
        "ContactPage",
        "ContactStatePage",
        "MessagesPage",
        "OptOutRequest",
        "OptOutResponse",
        "OptOutsPage",
        "QuestionResponsesPage",
        "SegmentList",
        "StartLoadRequest",
        "StartLoadResponse",
        "TagsPage"
      ].sort()
    );
    examples.forEach(({ name, json }) => {
      expect({ name, errors: validate(schemaFor(name), json) }).toEqual({
        name,
        errors: []
      });
    });
  });

  it("catches drift: missing, extra, mistyped and out-of-enum fields", () => {
    const [{ json }] = labeledBlocks("example: MessagesPage");
    const good = json.messages[0];
    const check = message =>
      validate(schemaFor("MessagesPage"), {
        messages: [message],
        nextAfterId: 1
      });
    expect(check(good)).toEqual([]);
    const { text, ...missing } = good;
    expect(check(missing)).toEqual(["$.messages[0]: missing text"]);
    expect(check({ ...good, extra: 1 })).toEqual([
      "$.messages[0]: undocumented property extra"
    ]);
    expect(check({ ...good, id: "1001" })[0]).toMatch(
      /\$\.messages\[0\]\.id: expected integer/
    );
    expect(check({ ...good, sendStatus: "LOST" })[0]).toMatch(/not in enum/);
    // Consumers ignore unknown fields, so non-strict mode allows them.
    expect(
      validate(
        schemaFor("MessagesPage"),
        { messages: [{ ...good, extra: 1 }], nextAfterId: 1 },
        { strict: false }
      )
    ).toEqual([]);
  });

  it("serves Spoke's endpoints under the documented base path", () => {
    expect(BASE_PATH).toBe("/integrations/shore/v1/:organizationId");
    expect(contract.paths["/messages"].servers[0].url).toBe(
      "{spokeBaseUrl}/integrations/shore/v1/{organizationId}"
    );
  });

  it("has signing test vectors that match Spoke's implementation", () => {
    const [{ json: vectors }] = labeledBlocks("signing-vectors");
    const key = "shore-test-vector-key-0123456789abcdef";
    expect(vectors).toHaveLength(4);
    vectors.forEach(v => {
      expect(
        computeSignature({
          key,
          timestamp: v.timestamp,
          method: v.method,
          path: v.pathWithQuery,
          body: v.body
        })
      ).toBe(v.signature);
      expect(
        verifySignature({
          key,
          timestamp: v.timestamp,
          signature: v.signature,
          method: v.method,
          path: v.pathWithQuery,
          body: Buffer.from(v.body, "utf8"),
          now: Number(v.timestamp)
        })
      ).toEqual({ ok: true });
    });
  });
});

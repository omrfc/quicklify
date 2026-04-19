// tests/property/mcp-schemas.test.ts
import fc from "fast-check";
import { z } from "zod";
import { serverAuditSchema } from "../../src/mcp/tools/serverAudit.js";
import { guardStateEntrySchema } from "../../src/core/guard.js";
import { fixHistoryEntrySchema } from "../../src/core/audit/fix-history.js";
import { isoTimestampArb } from "./schema-arbitraries.js";

const serverAuditZod = z.object(serverAuditSchema);

describe("Property-based: MCP + Config Schemas", () => {
  describe("serverAuditSchema", () => {
    it("accepts all valid generated audit params", () => {
      fc.assert(
        fc.property(
          fc.record({
            server: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
            format: fc.option(fc.constantFrom("summary", "json", "score"), { nil: undefined }),
            framework: fc.option(fc.constantFrom("cis-level1", "cis-level2", "pci-dss", "hipaa"), { nil: undefined }),
            explain: fc.option(fc.boolean(), { nil: undefined }),
            category: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
            severity: fc.option(fc.constantFrom("critical", "warning", "info"), { nil: undefined }),
            snapshot: fc.option(fc.oneof(fc.boolean(), fc.string({ minLength: 1, maxLength: 30 })), { nil: undefined }),
            compare: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
            threshold: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            profile: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
          }),
          (params) => {
            const cleaned = Object.fromEntries(
              Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
            );
            const result = serverAuditZod.safeParse(cleaned);
            if (!result.success) {
              throw new Error(
                `Valid params rejected: ${JSON.stringify(cleaned)}\nError: ${result.error.message}`
              );
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it("rejects invalid format values", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => !["summary", "json", "score"].includes(s)),
          (badFormat) => {
            const result = serverAuditZod.safeParse({ format: badFormat });
            return !result.success;
          },
        ),
        { numRuns: 50 },
      );
    });

    it("rejects threshold outside 1-100 range", () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 101 })),
          (badThreshold) => {
            const result = serverAuditZod.safeParse({ threshold: badThreshold });
            return !result.success;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("guardStateEntrySchema", () => {
    it("accepts all valid generated guard state entries", () => {
      fc.assert(
        fc.property(
          fc.record({
            installedAt: isoTimestampArb,
            cronExpr: fc.constant("*/5 * * * *"),
          }),
          (entry) => {
            const result = guardStateEntrySchema.safeParse(entry);
            if (!result.success) {
              throw new Error(
                `Valid entry rejected: ${JSON.stringify(entry)}\nError: ${result.error.message}`
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("rejects entries with missing installedAt", () => {
      fc.assert(
        fc.property(
          fc.record({ cronExpr: fc.constant("*/5 * * * *") }),
          (entry) => {
            const broken = { cronExpr: entry.cronExpr };
            const result = guardStateEntrySchema.safeParse(broken);
            return !result.success;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe("fixHistoryEntrySchema", () => {
    it("accepts all valid generated fix history entries", () => {
      fc.assert(
        fc.property(
          fc.record({
            fixId: fc.string({ minLength: 1, maxLength: 30 }),
            serverIp: fc.string({ minLength: 7, maxLength: 45 }),
            serverName: fc.string({ minLength: 1, maxLength: 64 }),
            timestamp: isoTimestampArb,
            checks: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
            scoreBefore: fc.integer({ min: 0, max: 100 }),
            scoreAfter: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.constant(null)),
            status: fc.constantFrom("applied", "rolled-back", "failed"),
            backupPath: fc.stringMatching(/^\/root\/\.kastell\/fix-backups\/fix-[\d-]+$/),
          }),
          (entry) => {
            const result = fixHistoryEntrySchema.safeParse(entry);
            if (!result.success) {
              throw new Error(
                `Valid entry rejected: ${JSON.stringify(entry).slice(0, 200)}\nError: ${result.error.message}`
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("rejects entries with invalid backup path format", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^\/root\/\.kastell\/fix-backups\/fix-[\d-]+$/.test(s)),
          (badPath) => {
            const entry = {
              fixId: "fix-2024-01-01-001",
              serverIp: "1.2.3.4",
              serverName: "test-server",
              timestamp: new Date().toISOString(),
              checks: ["SSH-001"],
              scoreBefore: 50,
              scoreAfter: null,
              status: "applied" as const,
              backupPath: badPath,
            };
            const result = fixHistoryEntrySchema.safeParse(entry);
            return !result.success;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});

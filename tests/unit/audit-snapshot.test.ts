/**
 * Unit tests for audit snapshot persistence module.
 * Tests: saveSnapshot, loadSnapshot, listSnapshots
 * Includes schema v2 + v1-to-v2 migration tests (Plan 45-02).
 */

import {
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
} from "../../src/core/audit/snapshot.js";
import type { AuditResult } from "../../src/core/audit/types.js";
import * as fs from "fs";

jest.mock("fs");
jest.mock("../../src/utils/config.js", () => ({
  CONFIG_DIR: "/home/user/.kastell",
}));
jest.mock("../../src/utils/fileLock", () => ({
  withFileLock: jest.fn((_path: string, fn: () => unknown) => fn()),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

function makeAuditResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    serverName: "test-server",
    serverIp: "1.2.3.4",
    platform: "bare",
    timestamp: "2026-03-08T10:00:00.000Z",
    auditVersion: "1.10.0",
    categories: [
      { name: "SSH", checks: [], score: 80, maxScore: 100 },
      { name: "Firewall", checks: [], score: 60, maxScore: 100 },
    ],
    overallScore: 70,
    quickWins: [],
    ...overrides,
  };
}

describe("saveSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it("should write JSON to ~/.kastell/snapshots/{safeIp}/{timestamp}.json", async () => {
    await saveSnapshot(makeAuditResult());

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    const writePath = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
    expect(writePath).toContain("snapshots");
    expect(writePath).toContain("1-2-3-4");
    expect(writePath).toContain(".tmp");
  });

  it("should replace dots with hyphens in directory name", async () => {
    await saveSnapshot(makeAuditResult({ serverIp: "10.0.0.1" }));

    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    const mkdirPath = (mockedFs.mkdirSync as jest.Mock).mock.calls[0][0] as string;
    expect(mkdirPath).toContain("10-0-0-1");
    expect(mkdirPath).not.toContain("10.0.0.1");
  });

  it("should create directory with mode 0o700", async () => {
    await saveSnapshot(makeAuditResult());

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("snapshots"),
      expect.objectContaining({ mode: 0o700 }),
    );
  });

  it("should produce JSON with schemaVersion: 2 (v2 schema)", async () => {
    await saveSnapshot(makeAuditResult());

    const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsed = JSON.parse(writeContent);
    expect(parsed.schemaVersion).toBe(2);
  });

  it("should include auditVersion in saved audit object", async () => {
    await saveSnapshot(makeAuditResult({ auditVersion: "1.10.0" }));

    const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsed = JSON.parse(writeContent);
    expect(parsed.audit.auditVersion).toBe("1.10.0");
  });

  it("should contain full audit result in envelope", async () => {
    const result = makeAuditResult({ overallScore: 85 });
    await saveSnapshot(result);

    const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsed = JSON.parse(writeContent);
    expect(parsed.audit.overallScore).toBe(85);
    expect(parsed.audit.serverIp).toBe("1.2.3.4");
  });

  it("should use atomic write (tmp + rename)", async () => {
    await saveSnapshot(makeAuditResult());

    const writePath = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
    expect(writePath).toMatch(/\.tmp$/);
    expect(mockedFs.renameSync).toHaveBeenCalled();

    const renameDest = (mockedFs.renameSync as jest.Mock).mock.calls[0][1] as string;
    expect(renameDest).not.toMatch(/\.tmp$/);
    expect(renameDest).toMatch(/\.json$/);
  });

  describe("named snapshots (SNAP-03)", () => {
    it("should include name in filename when provided", async () => {
      await saveSnapshot(makeAuditResult(), "pre-upgrade");

      const writePath = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
      expect(writePath).toContain("pre-upgrade");
    });

    it("should store name in SnapshotFile.name field", async () => {
      await saveSnapshot(makeAuditResult(), "pre-upgrade");

      const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
      const parsed = JSON.parse(writeContent);
      expect(parsed.name).toBe("pre-upgrade");
    });

    it("should sanitize name — replace non-[a-zA-Z0-9_-] with underscore", async () => {
      await saveSnapshot(makeAuditResult(), "my name! @here");

      const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
      const parsed = JSON.parse(writeContent);
      expect(parsed.name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(parsed.name).not.toContain(" ");
      expect(parsed.name).not.toContain("!");
      expect(parsed.name).not.toContain("@");
    });

    it("should neutralize path traversal in name", async () => {
      await saveSnapshot(makeAuditResult(), "../../../etc/passwd");

      const writePath = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
      expect(writePath).not.toContain("etc/passwd");
      expect(writePath).not.toContain("..");
    });

    it("should truncate name to 64 characters max", async () => {
      const longName = "a".repeat(100);
      await saveSnapshot(makeAuditResult(), longName);

      const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
      const parsed = JSON.parse(writeContent);
      expect(parsed.name!.length).toBeLessThanOrEqual(64);
    });

    it("should not include name field when no name provided", async () => {
      await saveSnapshot(makeAuditResult());

      const writeContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
      const parsed = JSON.parse(writeContent);
      expect(parsed.name).toBeUndefined();
    });
  });
});

describe("loadSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return parsed SnapshotFile for valid v2 JSON", async () => {
    const snapshotData = {
      schemaVersion: 2,
      savedAt: "2026-03-08T10:00:00.000Z",
      audit: makeAuditResult({ auditVersion: "1.10.0" }),
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    const result = await loadSnapshot("1.2.3.4", "2026-03-08T10-00-00-000Z.json");
    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(2);
    expect(result!.audit.serverIp).toBe("1.2.3.4");
    expect(result!.audit.auditVersion).toBe("1.10.0");
  });

  it("should migrate v1 file: returns schemaVersion=2 and auditVersion=1.0.0", async () => {
    // V1 snapshot: no auditVersion in audit object
    const v1AuditResult = {
      serverName: "test-server",
      serverIp: "1.2.3.4",
      platform: "bare",
      timestamp: "2026-03-08T10:00:00.000Z",
      categories: [
        { name: "SSH", checks: [], score: 80, maxScore: 100 },
      ],
      overallScore: 80,
      quickWins: [],
      // no auditVersion — v1 format
    };
    const v1SnapshotData = {
      schemaVersion: 1,
      savedAt: "2026-03-08T10:00:00.000Z",
      audit: v1AuditResult,
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(v1SnapshotData));

    const result = await loadSnapshot("1.2.3.4", "old.json");
    expect(result).not.toBeNull();
    // Migration: schemaVersion bumped to 2
    expect(result!.schemaVersion).toBe(2);
    // Migration: auditVersion defaults to "1.0.0" for legacy snapshots
    expect(result!.audit.auditVersion).toBe("1.0.0");
    // Original data preserved
    expect(result!.audit.overallScore).toBe(80);
    expect(result!.audit.serverIp).toBe("1.2.3.4");
  });

  it("should return null for missing file", async () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    });

    const result = await loadSnapshot("1.2.3.4", "nonexistent.json");
    expect(result).toBeNull();
  });

  it("should return null for corrupt JSON", async () => {
    mockedFs.readFileSync.mockReturnValue("not valid json {{{");

    const result = await loadSnapshot("1.2.3.4", "bad.json");
    expect(result).toBeNull();
  });

  it("should return null for unknown schema version (SNAP-04)", async () => {
    const unknownSchema = {
      schemaVersion: 99,
      savedAt: "2026-03-08T10:00:00.000Z",
      audit: makeAuditResult(),
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(unknownSchema));

    const result = await loadSnapshot("1.2.3.4", "future.json");
    expect(result).toBeNull();
  });

  it("should return null for missing required fields", async () => {
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ schemaVersion: 1 }));

    const result = await loadSnapshot("1.2.3.4", "partial.json");
    expect(result).toBeNull();
  });
});

describe("Schema migration (v1 -> v2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle v1 snapshot with complianceRefs/tags — migrated to v2", async () => {
    const v1Audit = {
      serverName: "test-server",
      serverIp: "1.2.3.4",
      platform: "bare",
      timestamp: "2026-03-08T10:00:00.000Z",
      categories: [
        {
          name: "SSH",
          score: 80,
          maxScore: 100,
          checks: [
            {
              id: "SSH-PASSWORD-AUTH",
              category: "SSH",
              name: "Password Auth",
              severity: "critical",
              passed: false,
              currentValue: "yes",
              expectedValue: "no",
              complianceRefs: [
                {
                  framework: "CIS",
                  controlId: "5.2.1",
                  version: "1.0",
                  description: "SSH MaxAuthTries",
                  coverage: "full",
                },
              ],
              tags: ["ssh", "authentication"],
            },
          ],
        },
      ],
      overallScore: 80,
      quickWins: [],
      // no auditVersion
    };

    const snapshotData = {
      schemaVersion: 1,
      savedAt: "2026-03-08T10:00:00.000Z",
      audit: v1Audit,
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    const result = await loadSnapshot("1.2.3.4", "old-with-refs.json");
    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(2);
    expect(result!.audit.auditVersion).toBe("1.0.0");
    const check = result!.audit.categories[0].checks[0];
    expect(check.complianceRefs).toHaveLength(1);
    expect(check.tags).toEqual(["ssh", "authentication"]);
  });

  it("should reject v1 snapshot with complianceRefs missing required coverage field", async () => {
    const auditWithBadRefs = {
      serverName: "test-server",
      serverIp: "1.2.3.4",
      platform: "bare",
      timestamp: "2026-03-08T10:00:00.000Z",
      categories: [
        {
          name: "SSH",
          score: 80,
          maxScore: 100,
          checks: [
            {
              id: "SSH-PASSWORD-AUTH",
              category: "SSH",
              name: "Password Auth",
              severity: "critical",
              passed: false,
              currentValue: "yes",
              expectedValue: "no",
              complianceRefs: [
                {
                  framework: "CIS",
                  controlId: "5.2.1",
                  version: "1.0",
                  description: "SSH MaxAuthTries",
                  // coverage intentionally omitted
                },
              ],
            },
          ],
        },
      ],
      overallScore: 80,
      quickWins: [],
    };

    const snapshotData = {
      schemaVersion: 1,
      savedAt: "2026-03-08T10:00:00.000Z",
      audit: auditWithBadRefs,
    };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    const result = await loadSnapshot("1.2.3.4", "bad-compliance.json");
    expect(result).toBeNull();
  });
});

describe("listSnapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array when snapshots directory does not exist", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const entries = await listSnapshots("1.2.3.4");
    expect(entries).toEqual([]);
  });

  it("should return list sorted chronologically (oldest first) with v1 files", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T12-00-00-000Z.json",
      "2026-03-06T10-00-00-000Z.json",
      "2026-03-07T08-00-00-000Z.json",
    ] as unknown as ReturnType<typeof fs.readdirSync>);

    // V1 format snapshots (no auditVersion)
    const makeV1Entry = (ts: string) =>
      JSON.stringify({
        schemaVersion: 1,
        savedAt: ts,
        audit: {
          serverName: "test-server",
          serverIp: "1.2.3.4",
          platform: "bare",
          timestamp: ts,
          categories: [],
          overallScore: 70,
          quickWins: [],
        },
      });

    mockedFs.readFileSync
      .mockReturnValueOnce(makeV1Entry("2026-03-08T12:00:00.000Z"))
      .mockReturnValueOnce(makeV1Entry("2026-03-06T10:00:00.000Z"))
      .mockReturnValueOnce(makeV1Entry("2026-03-07T08:00:00.000Z"));

    const entries = await listSnapshots("1.2.3.4");
    expect(entries).toHaveLength(3);
    expect(entries[0].filename).toBe("2026-03-06T10-00-00-000Z.json");
    expect(entries[2].filename).toBe("2026-03-08T12-00-00-000Z.json");
    // V1 entries should be valid (not corrupt) after migration
    expect(entries[0].corrupt).toBeFalsy();
  });

  it("should return list sorted chronologically with v2 files", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T12-00-00-000Z.json",
      "2026-03-06T10-00-00-000Z.json",
    ] as unknown as ReturnType<typeof fs.readdirSync>);

    const makeV2Entry = (ts: string) =>
      JSON.stringify({
        schemaVersion: 2,
        savedAt: ts,
        audit: makeAuditResult({ overallScore: 70 }),
      });

    mockedFs.readFileSync
      .mockReturnValueOnce(makeV2Entry("2026-03-08T12:00:00.000Z"))
      .mockReturnValueOnce(makeV2Entry("2026-03-06T10:00:00.000Z"));

    const entries = await listSnapshots("1.2.3.4");
    expect(entries).toHaveLength(2);
    expect(entries[0].filename).toBe("2026-03-06T10-00-00-000Z.json");
  });

  it("should include savedAt, overallScore in each entry", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T10-00-00-000Z.json",
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        schemaVersion: 2,
        savedAt: "2026-03-08T10:00:00.000Z",
        audit: makeAuditResult({ overallScore: 85 }),
      }),
    );

    const entries = await listSnapshots("1.2.3.4");
    expect(entries[0].savedAt).toBe("2026-03-08T10:00:00.000Z");
    expect(entries[0].overallScore).toBe(85);
    expect(entries[0].filename).toBe("2026-03-08T10-00-00-000Z.json");
  });

  it("should include name in entry when snapshot was named", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T10-00-00-000Z_pre-upgrade.json",
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        schemaVersion: 2,
        name: "pre-upgrade",
        savedAt: "2026-03-08T10:00:00.000Z",
        audit: makeAuditResult(),
      }),
    );

    const entries = await listSnapshots("1.2.3.4");
    expect(entries[0].name).toBe("pre-upgrade");
  });

  it("should mark corrupt files with corrupt flag instead of crashing", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T10-00-00-000Z.json",
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    mockedFs.readFileSync.mockReturnValue("not valid json {{{");

    const entries = await listSnapshots("1.2.3.4");
    expect(entries).toHaveLength(1);
    expect(entries[0].corrupt).toBe(true);
  });

  it("should skip non-.json files", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "2026-03-08T10-00-00-000Z.json",
      "not-a-snapshot.txt",
      ".lock",
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        schemaVersion: 2,
        savedAt: "2026-03-08T10:00:00.000Z",
        audit: makeAuditResult(),
      }),
    );

    const entries = await listSnapshots("1.2.3.4");
    expect(entries).toHaveLength(1);
  });
});

/**
 * MCP server_fix handler unit tests (FIX-07 + FIX-08 scenarios)
 *
 * Covers:
 *   - Empty server list error path
 *   - dryRun:true default (no backup, no SSH)
 *   - SAFE_MODE forces dryRun even when dryRun:false passed
 *   - FORBIDDEN check ID rejection (TypeScript enforcement, FIX-08)
 *   - Non-existent check ID rejection
 *   - checks + category AND filter
 *   - Empty SAFE plan after filter early exit
 *   - Backup failure hard-abort
 *   - Live fix success (backup called, SSH called, scoreAfter populated)
 */

// ─── Module mocks (hoisted by Jest) ─────────────────────────────────────────

jest.mock("../../src/utils/config");
jest.mock("../../src/core/audit/index");
jest.mock("../../src/core/audit/fix");
jest.mock("../../src/core/backup");
jest.mock("../../src/core/manage");
jest.mock("../../src/utils/ssh");
jest.mock("../../src/utils/errorMapper", () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import * as config from "../../src/utils/config";
import * as auditIndex from "../../src/core/audit/index";
import * as fix from "../../src/core/audit/fix";
import * as backup from "../../src/core/backup";
import * as manage from "../../src/core/manage";
import * as ssh from "../../src/utils/ssh";
import { handleServerFix } from "../../src/mcp/tools/serverFix";

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedAudit = auditIndex as jest.Mocked<typeof auditIndex>;
const mockedFix = fix as jest.Mocked<typeof fix>;
const mockedBackup = backup as jest.Mocked<typeof backup>;
const mockedManage = manage as jest.Mocked<typeof manage>;
const mockedSsh = ssh as jest.Mocked<typeof ssh>;

// ─── Test fixtures ────────────────────────────────────────────────────────────

const sampleServer = {
  id: "s1",
  name: "test-srv",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00Z",
};

type CheckOpts = {
  passed?: boolean;
  fixCommand?: string;
  safeToAutoFix?: "SAFE" | "GUARDED" | "FORBIDDEN";
  severity?: "critical" | "warning" | "info";
};

const makeCheck = (
  id: string,
  category: string,
  opts: CheckOpts = {},
) => ({
  id,
  category,
  name: `Check ${id}`,
  severity: opts.severity ?? ("warning" as const),
  passed: opts.passed ?? false,
  currentValue: "bad",
  expectedValue: "good",
  fixCommand: opts.fixCommand ?? `sysctl -w test.${id.toLowerCase()}=1`,
  safeToAutoFix: opts.safeToAutoFix ?? ("SAFE" as const),
});

type SimpleCheck = ReturnType<typeof makeCheck>;

const makeAuditResult = (
  categories: Array<{ name: string; checks: SimpleCheck[] }>,
) => ({
  serverName: "test-srv",
  serverIp: "1.2.3.4",
  platform: "bare" as const,
  timestamp: "2026-01-01T00:00:00Z",
  auditVersion: "1.14.0",
  categories: categories.map((c) => ({ ...c, score: 50, maxScore: 100 })),
  overallScore: 65,
  quickWins: [],
});

/** A FixCheck object matching src/core/audit/fix.ts interface */
const makeFixCheck = (
  id: string,
  category: string,
  severity: "critical" | "warning" | "info" = "warning",
) => ({
  id,
  category,
  name: `Check ${id}`,
  severity,
  fixCommand: `sysctl -w test.${id.toLowerCase()}=1`,
  estimatedImpact: 5,
});

// Default audit result with Kernel (SAFE checks) + SSH (FORBIDDEN check)
const defaultAuditResult = makeAuditResult([
  {
    name: "Kernel",
    checks: [
      makeCheck("KERN-SYNCOOKIES", "Kernel", { safeToAutoFix: "SAFE" }),
      makeCheck("KERN-RANDOMIZE", "Kernel", { safeToAutoFix: "SAFE" }),
    ],
  },
  {
    name: "SSH",
    checks: [
      makeCheck("SSH-PERMIT-ROOT", "SSH", { safeToAutoFix: "FORBIDDEN" }),
    ],
  },
]);

// Default safe plan returned by previewSafeFixes mock
const defaultSafePlan = {
  safePlan: {
    groups: [
      {
        severity: "warning" as const,
        checks: [
          makeFixCheck("KERN-SYNCOOKIES", "Kernel"),
          makeFixCheck("KERN-RANDOMIZE", "Kernel"),
        ],
        estimatedImpact: 5,
      },
    ],
  },
  guardedCount: 0,
  forbiddenCount: 1,
  guardedIds: [],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();

  mockedConfig.getServers.mockReturnValue([sampleServer] as never);
  // findServer is used by resolveServerForMcp when there is 1 server
  (mockedConfig as jest.Mocked<typeof config> & { findServer?: jest.Mock }).findServer?.mockReturnValue(sampleServer as never);

  mockedManage.isSafeMode.mockReturnValue(false);

  mockedAudit.runAudit.mockResolvedValue({
    success: true,
    data: defaultAuditResult as never,
  });

  mockedFix.previewSafeFixes.mockReturnValue(defaultSafePlan as never);

  mockedFix.resolveTier.mockImplementation(
    (check: { safeToAutoFix?: string }, catName: string) => {
      if (catName === "SSH" || catName === "Firewall" || catName === "Docker")
        return "FORBIDDEN";
      return (check.safeToAutoFix as "SAFE" | "GUARDED" | "FORBIDDEN") ?? "GUARDED";
    },
  );

  mockedFix.isFixCommandAllowed.mockReturnValue(true);

  mockedBackup.backupServer.mockResolvedValue({
    success: true,
    backupPath: "/tmp/backup",
  });

  mockedSsh.sshExec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });

  mockedFix.runScoreCheck.mockResolvedValue(72);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MCP server_fix tool", () => {
  // ── Server resolution ────────────────────────────────────────────────────

  describe("server resolution", () => {
    it("returns mcpError when no servers configured", async () => {
      mockedConfig.getServers.mockReturnValue([]);

      const result = await handleServerFix({});

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed.error).toContain("No servers found");
    });
  });

  // ── dryRun default ───────────────────────────────────────────────────────

  describe("dryRun default", () => {
    it("defaults to dryRun:true — returns preview, no backup or SSH called", async () => {
      const result = await handleServerFix({});

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed.dryRun).toBe(true);
      expect(parsed.preview).toBeDefined();
      expect(mockedBackup.backupServer).not.toHaveBeenCalled();
      expect(mockedSsh.sshExec).not.toHaveBeenCalled();
    });

    it("SAFE_MODE=true forces dryRun even when dryRun:false passed", async () => {
      mockedManage.isSafeMode.mockReturnValue(true);

      const result = await handleServerFix({ dryRun: false });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed.safeModeForcedDryRun).toBe(true);
      expect(mockedBackup.backupServer).not.toHaveBeenCalled();
    });

    it("dryRun:true explicitly also returns preview without backup", async () => {
      const result = await handleServerFix({ dryRun: true });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed.dryRun).toBe(true);
      expect(mockedBackup.backupServer).not.toHaveBeenCalled();
    });
  });

  // ── FORBIDDEN rejection (FIX-08) ─────────────────────────────────────────

  describe("FORBIDDEN rejection (FIX-08)", () => {
    it("rejects FORBIDDEN check IDs with reason containing FORBIDDEN", async () => {
      const result = await handleServerFix({ checks: ["SSH-PERMIT-ROOT"] });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      const rejected = parsed.rejectedChecks as Array<{
        id: string;
        reason: string;
      }>;
      expect(rejected).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "SSH-PERMIT-ROOT",
            reason: expect.stringContaining("FORBIDDEN"),
          }),
        ]),
      );
    });

    it("rejects non-existent check IDs with 'not found' reason", async () => {
      const result = await handleServerFix({ checks: ["NONEXIST-CHECK"] });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      const rejected = parsed.rejectedChecks as Array<{
        id: string;
        reason: string;
      }>;
      expect(rejected).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "NONEXIST-CHECK",
            reason: expect.stringContaining("not found"),
          }),
        ]),
      );
    });
  });

  // ── AND filter ───────────────────────────────────────────────────────────

  describe("checks + category AND filter", () => {
    it("AND filter: returns only checks matching both checks[] and category", async () => {
      // safePlan has KERN-SYNCOOKIES and KERN-RANDOMIZE (both Kernel)
      // checks: ["KERN-SYNCOOKIES"] + category: "Kernel" → only KERN-SYNCOOKIES
      const result = await handleServerFix({
        checks: ["KERN-SYNCOOKIES"],
        category: "Kernel",
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      // In dryRun mode, preview groups should contain only KERN-SYNCOOKIES
      const preview = parsed.preview as { groups: Array<{ checks: Array<{ id: string }> }> };
      const allCheckIds = preview.groups.flatMap((g) => g.checks.map((c) => c.id));
      expect(allCheckIds).toContain("KERN-SYNCOOKIES");
      expect(allCheckIds).not.toContain("KERN-RANDOMIZE");
    });

    it("category filter alone returns only checks from that category", async () => {
      const result = await handleServerFix({ category: "Kernel" });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      const preview = parsed.preview as { groups: Array<{ checks: Array<{ id: string; category: string }> }> };
      const allChecks = preview.groups.flatMap((g) => g.checks);
      expect(allChecks.every((c) => c.category === "Kernel")).toBe(true);
    });
  });

  // ── Empty plan early exit ─────────────────────────────────────────────────

  describe("empty plan early exit", () => {
    it("returns message when no SAFE fixes match filter", async () => {
      mockedFix.previewSafeFixes.mockReturnValue({
        safePlan: { groups: [] },
        guardedCount: 0,
        forbiddenCount: 0,
        guardedIds: [],
      } as never);

      const result = await handleServerFix({});

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      expect(String(parsed.message)).toMatch(/No matching SAFE fixes/i);
    });
  });

  // ── Live fix path ─────────────────────────────────────────────────────────

  describe("live fix path", () => {
    it("aborts on backup failure — returns isError:true with Backup failed", async () => {
      mockedBackup.backupServer.mockResolvedValue({
        success: false,
        error: "disk full",
      });

      const result = await handleServerFix({ dryRun: false });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      expect(String(parsed.error)).toContain("Backup failed");
    });

    it("applies fixes and returns score delta", async () => {
      const result = await handleServerFix({ dryRun: false });

      expect(result.isError).toBeUndefined();
      expect(mockedBackup.backupServer).toHaveBeenCalledTimes(1);
      expect(mockedSsh.sshExec).toHaveBeenCalled();

      const parsed = JSON.parse(result.content[0].text) as Record<
        string,
        unknown
      >;
      expect(Array.isArray(parsed.applied)).toBe(true);
      expect(typeof parsed.scoreBefore).toBe("number");
      // scoreAfter may be null if nothing was applied, but we mock sshExec success
      // so applied should be non-empty → scoreAfter should be a number
      expect(parsed.scoreAfter).toBe(72);
    });

    it("dryRun:false with SAFE_MODE=false executes backup and SSH", async () => {
      mockedManage.isSafeMode.mockReturnValue(false);

      await handleServerFix({ dryRun: false });

      expect(mockedBackup.backupServer).toHaveBeenCalledWith(sampleServer);
    });
  });
});

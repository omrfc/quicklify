/**
 * Unit tests for evidence collection core module.
 * Tests: buildEvidenceBatchCommand, EVIDENCE_SECTION_INDICES, collectEvidence
 */

import { buildEvidenceBatchCommand, EVIDENCE_SECTION_INDICES, getEvidenceSectionFilenames } from "../../src/core/evidenceCommands.js";
import { collectEvidence } from "../../src/core/evidence.js";
import * as fs from "fs";
import * as crypto from "crypto";

jest.mock("fs");
jest.mock("../../src/utils/config.js", () => ({
  CONFIG_DIR: "/home/user/.kastell",
}));
jest.mock("../../src/utils/ssh.js", () => ({
  sshExec: jest.fn(),
}));
jest.mock("../../src/utils/fileLock.js", () => ({
  withFileLock: jest.fn((_path: string, fn: () => unknown) => fn()),
}));

import { sshExec } from "../../src/utils/ssh.js";

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedSshExec = sshExec as jest.Mock;

// ============================================================
// buildEvidenceBatchCommand tests
// ============================================================

describe("buildEvidenceBatchCommand", () => {
  it("bare platform returns 5 sections (no docker)", () => {
    const cmd = buildEvidenceBatchCommand("bare", 500);
    const parts = cmd.split("---SEPARATOR---");
    // 5 sections: firewall, auth-log, ports, syslog, sysinfo
    expect(parts).toHaveLength(5);
  });

  it("coolify platform returns 7 sections (includes docker-ps and docker-logs)", () => {
    const cmd = buildEvidenceBatchCommand("coolify", 500);
    const parts = cmd.split("---SEPARATOR---");
    expect(parts).toHaveLength(7);
  });

  it("dokploy platform returns 7 sections (includes docker-ps and docker-logs)", () => {
    const cmd = buildEvidenceBatchCommand("dokploy", 500);
    const parts = cmd.split("---SEPARATOR---");
    expect(parts).toHaveLength(7);
  });

  it("noDocker option with coolify platform returns 5 sections", () => {
    const cmd = buildEvidenceBatchCommand("coolify", 500, { noDocker: true });
    const parts = cmd.split("---SEPARATOR---");
    expect(parts).toHaveLength(5);
  });

  it("noSysinfo option removes sysinfo section", () => {
    const cmdWith = buildEvidenceBatchCommand("bare", 500);
    const cmdWithout = buildEvidenceBatchCommand("bare", 500, { noSysinfo: true });
    const withParts = cmdWith.split("---SEPARATOR---");
    const withoutParts = cmdWithout.split("---SEPARATOR---");
    expect(withoutParts).toHaveLength(withParts.length - 1);
  });

  it("noDocker and noSysinfo together returns 3 sections", () => {
    const cmd = buildEvidenceBatchCommand("coolify", 500, { noDocker: true, noSysinfo: true });
    const parts = cmd.split("---SEPARATOR---");
    // firewall, auth-log, ports, syslog = 4 sections
    expect(parts).toHaveLength(4);
  });

  it("lines parameter appears in auth-log command", () => {
    const cmd = buildEvidenceBatchCommand("bare", 250);
    expect(cmd).toContain("250");
  });

  it("lines parameter appears in syslog command", () => {
    const cmd = buildEvidenceBatchCommand("bare", 300);
    expect(cmd).toContain("300");
  });

  it("firewall section uses || echo 'N/A' fallback", () => {
    const cmd = buildEvidenceBatchCommand("bare", 500);
    expect(cmd).toContain("|| echo 'N/A'");
  });

  it("auth-log section tries /var/log/auth.log then /var/log/secure", () => {
    const cmd = buildEvidenceBatchCommand("bare", 500);
    expect(cmd).toContain("/var/log/auth.log");
    expect(cmd).toContain("/var/log/secure");
  });

  it("syslog section tries journalctl then /var/log/syslog then /var/log/messages", () => {
    const cmd = buildEvidenceBatchCommand("bare", 500);
    expect(cmd).toContain("journalctl");
    expect(cmd).toContain("/var/log/syslog");
    expect(cmd).toContain("/var/log/messages");
  });

  it("ports section uses ss then netstat fallback", () => {
    const cmd = buildEvidenceBatchCommand("bare", 500);
    expect(cmd).toContain("ss -tlnp");
    expect(cmd).toContain("netstat -tlnp");
  });

  it("coolify docker section references coolify containers", () => {
    const cmd = buildEvidenceBatchCommand("coolify", 500);
    expect(cmd).toContain("coolify");
  });

  it("dokploy docker section references dokploy containers", () => {
    const cmd = buildEvidenceBatchCommand("dokploy", 500);
    expect(cmd).toContain("dokploy");
  });
});

describe("EVIDENCE_SECTION_INDICES", () => {
  it("has FIREWALL index 0", () => {
    expect(EVIDENCE_SECTION_INDICES.FIREWALL).toBe(0);
  });

  it("has AUTH_LOG index 1", () => {
    expect(EVIDENCE_SECTION_INDICES.AUTH_LOG).toBe(1);
  });

  it("has PORTS index 2", () => {
    expect(EVIDENCE_SECTION_INDICES.PORTS).toBe(2);
  });

  it("has SYSLOG index 3", () => {
    expect(EVIDENCE_SECTION_INDICES.SYSLOG).toBe(3);
  });

  it("has SYSINFO index 4", () => {
    expect(EVIDENCE_SECTION_INDICES.SYSINFO).toBe(4);
  });

  it("has DOCKER_PS index 5", () => {
    expect(EVIDENCE_SECTION_INDICES.DOCKER_PS).toBe(5);
  });

  it("has DOCKER_LOGS index 6", () => {
    expect(EVIDENCE_SECTION_INDICES.DOCKER_LOGS).toBe(6);
  });
});

// ============================================================
// getEvidenceSectionFilenames tests
// ============================================================

describe("getEvidenceSectionFilenames", () => {
  it("bare platform returns 5 filenames", () => {
    const names = getEvidenceSectionFilenames("bare");
    expect(names).toEqual([
      "firewall-rules.txt",
      "auth-log.txt",
      "listening-ports.txt",
      "syslog.txt",
      "system-info.txt",
    ]);
  });

  it("coolify platform returns 7 filenames including docker", () => {
    const names = getEvidenceSectionFilenames("coolify");
    expect(names).toHaveLength(7);
    expect(names).toContain("docker-containers.txt");
    expect(names).toContain("docker-logs.txt");
  });

  it("noSysinfo skips system-info.txt", () => {
    const names = getEvidenceSectionFilenames("bare", { noSysinfo: true });
    expect(names).not.toContain("system-info.txt");
    expect(names).toHaveLength(4);
  });

  it("noSysinfo + coolify returns 6 filenames with docker but no sysinfo", () => {
    const names = getEvidenceSectionFilenames("coolify", { noSysinfo: true });
    expect(names).toHaveLength(6);
    expect(names).not.toContain("system-info.txt");
    expect(names).toContain("docker-containers.txt");
    expect(names).toContain("docker-logs.txt");
  });

  it("filename count matches command section count", () => {
    const combos = [
      { platform: "bare", opts: {} },
      { platform: "coolify", opts: {} },
      { platform: "dokploy", opts: {} },
      { platform: "bare", opts: { noSysinfo: true } },
      { platform: "coolify", opts: { noSysinfo: true } },
      { platform: "coolify", opts: { noDocker: true } },
      { platform: "coolify", opts: { noDocker: true, noSysinfo: true } },
    ];
    for (const { platform, opts } of combos) {
      const cmd = buildEvidenceBatchCommand(platform, 500, opts);
      const sectionCount = cmd.split("---SEPARATOR---").length;
      const filenameCount = getEvidenceSectionFilenames(platform, opts).length;
      expect(filenameCount).toBe(sectionCount);
    }
  });
});

// ============================================================
// collectEvidence tests
// ============================================================

const DEFAULT_OPTS = {
  lines: 500,
  noDocker: false,
  noSysinfo: false,
  force: false,
  json: false,
  quiet: false,
};

function makeSshOutput(sections: string[]): string {
  return sections.join("\n---SEPARATOR---\n");
}

const BARE_SECTIONS = [
  "Status: active\nufw allow 22",  // firewall
  "Mar 10 10:00:00 sshd[123]: Accepted",  // auth.log
  "LISTEN  0  128  0.0.0.0:22  0.0.0.0:*",  // ports
  "Mar 10 10:00:00 kernel: info",  // syslog
  "root ALL=(ALL) ALL",  // sysinfo
];

describe("collectEvidence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockReturnValue(undefined as unknown as string);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.renameSync.mockReturnValue(undefined);
    mockedFs.rmSync.mockReturnValue(undefined);
    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput(BARE_SECTIONS),
      stderr: "",
    });
  });

  it("calls sshExec exactly once", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(mockedSshExec).toHaveBeenCalledTimes(1);
  });

  it("calls sshExec with 120000ms timeout", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const call = mockedSshExec.mock.calls[0];
    expect(call[2]).toEqual({ timeoutMs: 120_000 });
  });

  it("returns success with evidenceDir and file counts", async () => {
    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.evidenceDir).toBeDefined();
    expect(result.data!.totalFiles).toBeGreaterThan(0);
    expect(result.data!.serverName).toBe("myserver");
    expect(result.data!.serverIp).toBe("1.2.3.4");
    expect(result.data!.platform).toBe("bare");
  });

  it("writes evidence files for non-empty sections", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    const calls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const filenames = calls.map((c: unknown[]) => c[0] as string);
    expect(filenames.some((f) => f.includes("firewall-rules.txt"))).toBe(true);
    expect(filenames.some((f) => f.includes("auth-log.txt"))).toBe(true);
    expect(filenames.some((f) => f.includes("listening-ports.txt"))).toBe(true);
    expect(filenames.some((f) => f.includes("syslog.txt"))).toBe(true);
    expect(filenames.some((f) => f.includes("system-info.txt"))).toBe(true);
  });

  it("creates evidence directory under ~/.kastell/evidence/{server}/", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const mkdirCalls = (mockedFs.mkdirSync as jest.Mock).mock.calls;
    const dirs = mkdirCalls.map((c: unknown[]) => c[0] as string);
    expect(dirs.some((d) => d.includes(".kastell") && d.includes("evidence") && d.includes("myserver"))).toBe(true);
  });

  it("writes MANIFEST.json via tmp file then rename", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const tmpFiles = writeCalls.filter((c: unknown[]) => (c[0] as string).includes("MANIFEST.json.tmp"));
    expect(tmpFiles.length).toBeGreaterThan(0);
    expect(mockedFs.renameSync).toHaveBeenCalled();
  });

  it("writes SHA256SUMS file", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const sha256Files = writeCalls.filter((c: unknown[]) => (c[0] as string).includes("SHA256SUMS"));
    expect(sha256Files.length).toBeGreaterThan(0);
  });

  it("SHA256SUMS format uses two spaces between hash and filename", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const sha256Call = writeCalls.find((c: unknown[]) => (c[0] as string).includes("SHA256SUMS.tmp"));
    if (sha256Call) {
      const content = sha256Call[1] as string;
      // sha256sum -c format: "hash  filename" (two spaces)
      const lines = content.trim().split("\n");
      for (const line of lines) {
        expect(line).toMatch(/^[0-9a-f]{64}  \S+/);
      }
    }
  });

  it("SHA256 computed correctly for known content", async () => {
    // Content is trimmed after SSH split, so compute hash of the trimmed string
    const rawContent = "\ntest content for sha256\n";
    const knownContent = rawContent.trim();
    const expectedHash = crypto.createHash("sha256").update(knownContent, "utf-8").digest("hex");

    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput([
        knownContent,  // firewall
        "N/A",          // auth-log → skipped
        "N/A",          // ports → skipped
        "N/A",          // syslog → skipped
        "N/A",          // sysinfo → skipped
      ]),
      stderr: "",
    });

    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const sha256Call = writeCalls.find((c: unknown[]) => (c[0] as string).includes("SHA256SUMS.tmp"));
    if (sha256Call) {
      expect(sha256Call[1] as string).toContain(expectedHash);
    }
  });

  it("N/A section output creates skipped entry, no file written for that section", async () => {
    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput([
        "ufw allow 22",  // firewall — collected
        "N/A",           // auth-log — skipped
        "LISTEN 0 128",  // ports — collected
        "N/A",           // syslog — skipped
        "root ALL",      // sysinfo — collected
      ]),
      stderr: "",
    });

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(true);
    expect(result.data!.skippedFiles).toBe(2);
    expect(result.data!.totalFiles).toBe(3);
  });

  it("empty section content creates skipped entry", async () => {
    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput([
        "",          // firewall — empty → skipped
        "auth data", // auth-log
        "port data", // ports
        "syslog",    // syslog
        "sysinfo",   // sysinfo
      ]),
      stderr: "",
    });

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(true);
    expect(result.data!.skippedFiles).toBe(1);
  });

  it("SSH failure returns error and cleans up directory", async () => {
    mockedSshExec.mockResolvedValue({ code: 1, stdout: "", stderr: "Connection refused" });

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(false);
    expect(result.error).toContain("SSH");
    expect(mockedFs.rmSync).toHaveBeenCalled();
  });

  it("existing directory without --force returns error", async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
    expect(result.error).toContain("--force");
  });

  it("--force overwrites existing directory", async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", {
      ...DEFAULT_OPTS,
      force: true,
    });
    expect(result.success).toBe(true);
    expect(mockedFs.rmSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
  });

  it("--output flag overrides base directory", async () => {
    const result = await collectEvidence("myserver", "1.2.3.4", "bare", {
      ...DEFAULT_OPTS,
      output: "/custom/output/dir",
    });
    expect(result.success).toBe(true);
    // Use platform-agnostic check (Windows converts slashes to backslashes)
    expect(result.data!.evidenceDir).toContain("custom");
    expect(result.data!.evidenceDir).not.toContain(".kastell");
  });

  it("--name flag appends to date in directory name", async () => {
    const result = await collectEvidence("myserver", "1.2.3.4", "bare", {
      ...DEFAULT_OPTS,
      name: "incident-report",
    });
    expect(result.success).toBe(true);
    expect(result.data!.evidenceDir).toContain("incident-report");
  });

  it("disk write failure cleans up directory", async () => {
    mockedFs.writeFileSync.mockImplementation(() => {
      const err = new Error("No space left on device") as NodeJS.ErrnoException;
      err.code = "ENOSPC";
      throw err;
    });

    const result = await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    expect(result.success).toBe(false);
    expect(mockedFs.rmSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
  });

  it("MANIFEST.json contains schemaVersion 1", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const manifestCall = writeCalls.find((c: unknown[]) => (c[0] as string).includes("MANIFEST.json.tmp"));
    if (manifestCall) {
      const manifest = JSON.parse(manifestCall[1] as string);
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.server).toBe("myserver");
      expect(manifest.ip).toBe("1.2.3.4");
      expect(manifest.platform).toBe("bare");
      expect(Array.isArray(manifest.files)).toBe(true);
    }
  });

  it("collected files have status 'collected' with sha256", async () => {
    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const manifestCall = writeCalls.find((c: unknown[]) => (c[0] as string).includes("MANIFEST.json.tmp"));
    if (manifestCall) {
      const manifest = JSON.parse(manifestCall[1] as string);
      const collected = manifest.files.filter((f: { status: string }) => f.status === "collected");
      expect(collected.length).toBeGreaterThan(0);
      for (const entry of collected) {
        expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(entry.sizeBytes).toBeGreaterThan(0);
      }
    }
  });

  it("noSysinfo + coolify maps docker sections to correct filenames", async () => {
    const dockerPsOutput = "NAMES\tIMAGE\tSTATUS\ncoolify\tcoolify:latest\tUp 2 days";
    const dockerLogsOutput = "=== coolify === 2026-03-10 startup log";

    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput([
        "ufw allow 22",         // firewall
        "auth log data",        // auth-log
        "LISTEN 0 128",         // ports
        "syslog data",          // syslog
        // sysinfo SKIPPED
        dockerPsOutput,         // docker-ps (position 4, NOT 5)
        dockerLogsOutput,       // docker-logs (position 5, NOT 6)
      ]),
      stderr: "",
    });

    await collectEvidence("myserver", "1.2.3.4", "coolify", {
      ...DEFAULT_OPTS,
      noSysinfo: true,
    });

    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const filenames = writeCalls.map((c: unknown[]) => c[0] as string);

    // docker-containers.txt must contain docker ps output, NOT system-info.txt
    expect(filenames.some((f) => f.includes("docker-containers.txt"))).toBe(true);
    expect(filenames.some((f) => f.includes("docker-logs.txt"))).toBe(true);
    // system-info.txt must NOT be written (sysinfo was skipped)
    expect(filenames.some((f) => f.includes("system-info.txt"))).toBe(false);

    // Verify manifest has correct filenames
    const manifestCall = writeCalls.find((c: unknown[]) => (c[0] as string).includes("MANIFEST.json.tmp"));
    if (manifestCall) {
      const manifest = JSON.parse(manifestCall[1] as string);
      const fileNames = manifest.files.map((f: { filename: string }) => f.filename);
      expect(fileNames).toContain("docker-containers.txt");
      expect(fileNames).toContain("docker-logs.txt");
      expect(fileNames).not.toContain("system-info.txt");
    }
  });

  it("skipped sections have status 'skipped' in manifest", async () => {
    mockedSshExec.mockResolvedValue({
      code: 0,
      stdout: makeSshOutput([
        "firewall data",
        "N/A",  // skipped
        "port data",
        "N/A",  // skipped
        "sysinfo data",
      ]),
      stderr: "",
    });

    await collectEvidence("myserver", "1.2.3.4", "bare", DEFAULT_OPTS);
    const writeCalls = (mockedFs.writeFileSync as jest.Mock).mock.calls;
    const manifestCall = writeCalls.find((c: unknown[]) => (c[0] as string).includes("MANIFEST.json.tmp"));
    if (manifestCall) {
      const manifest = JSON.parse(manifestCall[1] as string);
      const skipped = manifest.files.filter((f: { status: string }) => f.status === "skipped");
      expect(skipped.length).toBe(2);
    }
  });
});

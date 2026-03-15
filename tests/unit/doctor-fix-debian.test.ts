/**
 * Tests for BUG-01: doctor --fix DEBIAN_FRONTEND=noninteractive prefix.
 *
 * Verifies that:
 * 1. checkStalePackages fixCommand includes DEBIAN_FRONTEND=noninteractive
 * 2. KNOWN_FIX_COMMANDS whitelist matches the updated apt command
 * 3. runDoctorFix with force=true executes the DEBIAN_FRONTEND-prefixed command
 */

jest.mock("../../src/utils/ssh", () => ({
  assertValidIp: jest.fn(),
  sshExec: jest.fn(),
}));

jest.mock("os", () => ({
  homedir: () => "/home/test",
}));

import { sshExec } from "../../src/utils/ssh";
import { runDoctorFix } from "../../src/core/doctor-fix";
import { checkStalePackages } from "../../src/core/doctor";
import type { DoctorFinding } from "../../src/core/doctor";

const mockedSshExec = sshExec as jest.MockedFunction<typeof sshExec>;

const SERVER_IP = "1.2.3.4";

describe("BUG-01 — doctor --fix DEBIAN_FRONTEND=noninteractive", () => {
  beforeEach(() => jest.resetAllMocks());

  describe("checkStalePackages fixCommand", () => {
    it("includes DEBIAN_FRONTEND=noninteractive prefix", () => {
      // Simulate output with more than 10 upgradable packages
      const aptOutput = [
        "Listing...",
        "pkg1/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg2/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg3/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg4/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg5/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg6/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg7/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg8/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg9/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg10/focal 1.0 amd64 [upgradable from: 0.9]",
        "pkg11/focal 1.0 amd64 [upgradable from: 0.9]",
      ].join("\n");

      const finding = checkStalePackages(aptOutput);
      expect(finding).not.toBeNull();
      expect(finding!.fixCommand).toContain("DEBIAN_FRONTEND=noninteractive");
      expect(finding!.fixCommand).toBe(
        "DEBIAN_FRONTEND=noninteractive sudo apt update && sudo apt upgrade -y",
      );
    });

    it("fixCommand does not include bare 'sudo apt update && sudo apt upgrade -y' without DEBIAN_FRONTEND", () => {
      const aptOutput = [
        "Listing...",
        ...Array.from({ length: 11 }, (_, i) => `pkg${i}/focal 1.0 amd64`),
      ].join("\n");

      const finding = checkStalePackages(aptOutput);
      expect(finding).not.toBeNull();
      // Should NOT be the bare command (missing DEBIAN_FRONTEND prefix)
      expect(finding!.fixCommand).not.toBe("sudo apt update && sudo apt upgrade -y");
    });
  });

  describe("KNOWN_FIX_COMMANDS whitelist", () => {
    it("accepts DEBIAN_FRONTEND-prefixed apt command (no 'unrecognized fix command' error)", async () => {
      const finding: DoctorFinding = {
        id: "STALE_PACKAGES",
        severity: "warning",
        description: "11 packages available for upgrade",
        command: "sudo apt update && sudo apt upgrade",
        fixCommand: "DEBIAN_FRONTEND=noninteractive sudo apt update && sudo apt upgrade -y",
      };

      mockedSshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });

      const result = await runDoctorFix(SERVER_IP, [finding], {
        dryRun: false,
        force: true,
      });

      // Should be applied, not failed with "unrecognized fix command"
      expect(result.applied).toContain("STALE_PACKAGES");
      expect(result.failed).toHaveLength(0);
    });

    it("rejects the old bare apt command without DEBIAN_FRONTEND prefix", async () => {
      const oldFinding: DoctorFinding = {
        id: "STALE_PACKAGES",
        severity: "warning",
        description: "11 packages available for upgrade",
        command: "sudo apt update && sudo apt upgrade",
        fixCommand: "sudo apt update && sudo apt upgrade -y",
      };

      const result = await runDoctorFix(SERVER_IP, [oldFinding], {
        dryRun: false,
        force: true,
      });

      // Old command should now be rejected (no longer in whitelist)
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toContain("unrecognized fix command");
      expect(result.applied).toHaveLength(0);
    });
  });

  describe("runDoctorFix executes DEBIAN_FRONTEND-prefixed command via sshExec", () => {
    it("calls sshExec with the DEBIAN_FRONTEND-prefixed apt command in force mode", async () => {
      const finding: DoctorFinding = {
        id: "STALE_PACKAGES",
        severity: "warning",
        description: "11 packages available for upgrade",
        command: "sudo apt update && sudo apt upgrade",
        fixCommand: "DEBIAN_FRONTEND=noninteractive sudo apt update && sudo apt upgrade -y",
      };

      mockedSshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });

      await runDoctorFix(SERVER_IP, [finding], { dryRun: false, force: true });

      expect(mockedSshExec).toHaveBeenCalledWith(
        SERVER_IP,
        "DEBIAN_FRONTEND=noninteractive sudo apt update && sudo apt upgrade -y",
      );
    });
  });
});

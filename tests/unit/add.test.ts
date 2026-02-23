import inquirer from "inquirer";
import * as config from "../../src/utils/config";
import * as serverSelect from "../../src/utils/serverSelect";
import * as providerFactory from "../../src/utils/providerFactory";
import * as ssh from "../../src/utils/ssh";
import { addCommand } from "../../src/commands/add";
import type { CloudProvider } from "../../src/providers/base";

jest.mock("../../src/utils/config");
jest.mock("../../src/utils/serverSelect");
jest.mock("../../src/utils/providerFactory");
jest.mock("../../src/utils/ssh");

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedConfig = config as jest.Mocked<typeof config>;
const mockedServerSelect = serverSelect as jest.Mocked<typeof serverSelect>;
const mockedProviderFactory = providerFactory as jest.Mocked<typeof providerFactory>;
const mockedSsh = ssh as jest.Mocked<typeof ssh>;

const mockProvider: CloudProvider = {
  name: "hetzner",
  displayName: "Hetzner Cloud",
  validateToken: jest.fn().mockResolvedValue(true),
  getRegions: jest.fn().mockReturnValue([]),
  getServerSizes: jest.fn().mockReturnValue([]),
  getAvailableLocations: jest.fn().mockResolvedValue([]),
  getAvailableServerTypes: jest.fn().mockResolvedValue([]),
  uploadSshKey: jest.fn(),
  createServer: jest.fn(),
  getServerStatus: jest.fn(),
  getServerDetails: jest.fn(),
  destroyServer: jest.fn(),
  rebootServer: jest.fn(),
};

describe("addCommand", () => {
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
    jest.clearAllMocks();

    mockedServerSelect.promptApiToken.mockResolvedValue("test-token");
    mockedProviderFactory.createProviderWithToken.mockReturnValue(mockProvider);
    (mockProvider.validateToken as jest.Mock).mockResolvedValue(true);
    mockedConfig.getServers.mockReturnValue([]);
    mockedConfig.saveServer.mockImplementation(() => {});
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "200", stderr: "" });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe("non-interactive mode", () => {
    it("should add server with all options provided", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "my-server", skipVerify: true });

      expect(mockedConfig.saveServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-server",
          provider: "hetzner",
          ip: "1.2.3.4",
        }),
      );
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Server added successfully");
    });

    it("should validate token before adding", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      expect(mockProvider.validateToken).toHaveBeenCalledWith("test-token");
    });

    it("should exit on invalid token", async () => {
      (mockProvider.validateToken as jest.Mock).mockResolvedValue(false);

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockedConfig.saveServer).not.toHaveBeenCalled();
    });

    it("should exit on invalid provider", async () => {
      await addCommand({ provider: "aws", ip: "1.2.3.4", name: "test" });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockedConfig.saveServer).not.toHaveBeenCalled();
    });

    it("should accept all valid providers", async () => {
      for (const p of ["hetzner", "digitalocean", "vultr", "linode"]) {
        jest.clearAllMocks();
        mockedServerSelect.promptApiToken.mockResolvedValue("token");
        mockedProviderFactory.createProviderWithToken.mockReturnValue(mockProvider);
        (mockProvider.validateToken as jest.Mock).mockResolvedValue(true);
        mockedConfig.getServers.mockReturnValue([]);
        mockedConfig.saveServer.mockImplementation(() => {});

        await addCommand({ provider: p, ip: "1.2.3.4", name: "test", skipVerify: true });

        expect(mockedConfig.saveServer).toHaveBeenCalledWith(
          expect.objectContaining({ provider: p }),
        );
      }
    });
  });

  describe("duplicate detection", () => {
    it("should reject duplicate IP", async () => {
      mockedConfig.getServers.mockReturnValue([
        {
          id: "123",
          name: "existing",
          provider: "hetzner",
          ip: "1.2.3.4",
          region: "nbg1",
          size: "cx33",
          createdAt: "2026-01-01",
        },
      ]);

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockedConfig.saveServer).not.toHaveBeenCalled();
    });
  });

  describe("Coolify verification", () => {
    it("should verify Coolify via health endpoint", async () => {
      mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "200", stderr: "" });

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test" });

      expect(mockedSsh.sshExec).toHaveBeenCalled();
      expect(mockedConfig.saveServer).toHaveBeenCalled();
    });

    it("should fallback to docker ps check when health fails", async () => {
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "connection refused" })
        .mockResolvedValueOnce({ code: 0, stdout: "OK", stderr: "" });

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test" });

      expect(mockedSsh.sshExec).toHaveBeenCalledTimes(2);
      expect(mockedConfig.saveServer).toHaveBeenCalled();
    });

    it("should add server even when verification fails", async () => {
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" });

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test" });

      expect(mockedConfig.saveServer).toHaveBeenCalled();
    });

    it("should skip verification with --skip-verify", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      expect(mockedSsh.sshExec).not.toHaveBeenCalled();
      expect(mockedConfig.saveServer).toHaveBeenCalled();
    });

    it("should exit when SSH not available and not skipping verify", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(false);

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test" });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockedConfig.saveServer).not.toHaveBeenCalled();
    });

    it("should handle ssh exception gracefully", async () => {
      mockedSsh.sshExec.mockRejectedValue(new Error("SSH timeout"));

      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test" });

      expect(mockedConfig.saveServer).toHaveBeenCalled();
    });
  });

  describe("interactive mode", () => {
    it("should prompt for provider when not given", async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ provider: "digitalocean" }) // provider
        .mockResolvedValueOnce({ ip: "5.6.7.8" }) // ip
        .mockResolvedValueOnce({ name: "my-do-server" }); // name

      await addCommand({});

      expect(mockedConfig.saveServer).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "digitalocean",
          ip: "5.6.7.8",
          name: "my-do-server",
        }),
      );
    });

    it("should prompt for IP when not given", async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ ip: "10.0.0.1" }) // ip
        .mockResolvedValueOnce({ name: "test-server" }); // name

      await addCommand({ provider: "hetzner" });

      expect(mockedConfig.saveServer).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "10.0.0.1" }),
      );
    });

    it("should prompt for name when not given", async () => {
      mockedInquirer.prompt.mockResolvedValueOnce({ name: "custom-name" });

      await addCommand({ provider: "hetzner", ip: "1.2.3.4" });

      expect(mockedConfig.saveServer).toHaveBeenCalledWith(
        expect.objectContaining({ name: "custom-name" }),
      );
    });
  });

  describe("prompt validators", () => {
    it("should validate IP address format", async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ ip: "10.0.0.1" })
        .mockResolvedValueOnce({ name: "test" });

      await addCommand({ provider: "hetzner" });

      // Extract IP prompt validate function
      const ipPromptCall = mockedInquirer.prompt.mock.calls[0][0] as any[];
      const ipValidator = ipPromptCall[0].validate;

      expect(ipValidator("")).toBe("IP address is required");
      expect(ipValidator("   ")).toBe("IP address is required");
      expect(ipValidator("not-an-ip")).toBe("Invalid IP address format");
      expect(ipValidator("999.999.999.999")).toBe("Invalid IP address (octets must be 0-255)");
      expect(ipValidator("256.1.1.1")).toBe("Invalid IP address (octets must be 0-255)");
      expect(ipValidator("1.2.3.4")).toBe(true);
      expect(ipValidator("0.0.0.0")).toBe(true);
      expect(ipValidator("255.255.255.255")).toBe(true);
    });

    it("should validate server name", async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ ip: "10.0.0.1" })
        .mockResolvedValueOnce({ name: "test" });

      await addCommand({ provider: "hetzner" });

      // Extract name prompt validate function
      const namePromptCall = mockedInquirer.prompt.mock.calls[1][0] as any[];
      const nameValidator = namePromptCall[0].validate;

      expect(nameValidator("")).toBe("Server name is required");
      expect(nameValidator("ab")).toBe("Server name must be 3-63 characters");
      expect(nameValidator("a".repeat(64))).toBe("Server name must be 3-63 characters");
      expect(nameValidator("UPPERCASE")).toBe(
        "Must start with a letter, end with letter/number, only lowercase letters, numbers, hyphens",
      );
      expect(nameValidator("-starts-dash")).toBe(
        "Must start with a letter, end with letter/number, only lowercase letters, numbers, hyphens",
      );
      expect(nameValidator("ends-dash-")).toBe(
        "Must start with a letter, end with letter/number, only lowercase letters, numbers, hyphens",
      );
      expect(nameValidator("valid-name")).toBe(true);
      expect(nameValidator("my-server-01")).toBe(true);
    });
  });

  describe("server record", () => {
    it("should save with manual- prefixed ID", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      const savedRecord = mockedConfig.saveServer.mock.calls[0][0];
      expect(savedRecord.id).toMatch(/^manual-\d+$/);
    });

    it("should save with unknown region and size", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      const savedRecord = mockedConfig.saveServer.mock.calls[0][0];
      expect(savedRecord.region).toBe("unknown");
      expect(savedRecord.size).toBe("unknown");
    });

    it("should save with ISO timestamp", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      const savedRecord = mockedConfig.saveServer.mock.calls[0][0];
      expect(savedRecord.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should display success message with provider displayName", async () => {
      await addCommand({ provider: "hetzner", ip: "1.2.3.4", name: "test", skipVerify: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Hetzner Cloud");
      expect(output).toContain("1.2.3.4");
      expect(output).toContain("test");
    });
  });
});

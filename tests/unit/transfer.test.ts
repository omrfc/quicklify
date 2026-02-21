import { readFileSync, writeFileSync } from "fs";
import * as config from "../../src/utils/config";
import { validateServerRecords, exportCommand, importCommand } from "../../src/commands/transfer";

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
}));
jest.mock("../../src/utils/config");

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const sampleServer2 = {
  id: "456",
  name: "coolify-prod",
  provider: "digitalocean",
  ip: "5.6.7.8",
  region: "fra1",
  size: "s-2vcpu-4gb",
  createdAt: "2026-02-01T00:00:00.000Z",
};

describe("transfer", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("validateServerRecords", () => {
    it("should validate valid array", () => {
      const result = validateServerRecords([sampleServer]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-array data", () => {
      const result = validateServerRecords({ not: "array" });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("JSON array");
    });

    it("should reject null data", () => {
      const result = validateServerRecords(null);
      expect(result.valid).toBe(false);
    });

    it("should reject non-object items", () => {
      const result = validateServerRecords(["not-an-object"]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must be an object");
    });

    it("should reject items with missing fields", () => {
      const result = validateServerRecords([{ id: "1", name: "test" }]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject items with non-string fields", () => {
      const result = validateServerRecords([{ ...sampleServer, id: 123 }]);
      expect(result.valid).toBe(false);
    });

    it("should validate empty array", () => {
      const result = validateServerRecords([]);
      expect(result.valid).toBe(true);
    });

    it("should reject null items in array", () => {
      const result = validateServerRecords([null]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must be an object");
    });
  });

  describe("exportCommand", () => {
    it("should export servers to default path", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      await exportCommand();

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("quicklify-export.json"),
        JSON.stringify([sampleServer], null, 2),
        "utf-8",
      );
    });

    it("should export servers to custom path", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      await exportCommand("/tmp/my-export.json");

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("my-export.json"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should show info when no servers to export", async () => {
      mockedConfig.getServers.mockReturnValue([]);

      await exportCommand();

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("No servers to export");
      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it("should handle write error", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await exportCommand();

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Failed to write");
    });
  });

  describe("importCommand", () => {
    it("should import servers from file", async () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify([sampleServer]));
      mockedConfig.getServers.mockReturnValue([]);

      await importCommand("/tmp/export.json");

      expect(mockedConfig.saveServer).toHaveBeenCalledWith(sampleServer);
    });

    it("should skip duplicate servers by ID", async () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify([sampleServer, sampleServer2]));
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      await importCommand("/tmp/export.json");

      expect(mockedConfig.saveServer).toHaveBeenCalledTimes(1);
      expect(mockedConfig.saveServer).toHaveBeenCalledWith(sampleServer2);
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Imported 1");
      expect(output).toContain("skipped 1");
    });

    it("should show error for missing path", async () => {
      await importCommand("");

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Usage");
    });

    it("should handle file read error", async () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      await importCommand("/tmp/nonexistent.json");

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Failed to read");
    });

    it("should handle invalid JSON", async () => {
      mockedReadFileSync.mockReturnValue("not json{{{");

      await importCommand("/tmp/bad.json");

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("not valid JSON");
    });

    it("should handle invalid server data", async () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({ not: "array" }));

      await importCommand("/tmp/bad.json");

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Invalid server data");
    });

    it("should skip all duplicates when all exist", async () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify([sampleServer]));
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      await importCommand("/tmp/export.json");

      expect(mockedConfig.saveServer).not.toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Imported 0");
      expect(output).toContain("skipped 1");
    });
  });
});

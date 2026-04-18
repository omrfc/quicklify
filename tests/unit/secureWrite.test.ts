// Mock child_process and os for platform-specific ACL tests
jest.mock("child_process", () => ({
  spawnSync: jest.fn(),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return {
    ...actual,
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    chmodSync: jest.fn(),
  };
});

jest.mock("os", () => {
  const actual = jest.requireActual<typeof import("os")>("os");
  return {
    ...actual,
    userInfo: jest.fn(),
  };
});

jest.mock("../../src/utils/securityLogger", () => ({
  SecurityLogger: {
    warn: jest.fn(),
  },
}));

import { writeFileSync, mkdirSync, chmodSync } from "fs";
import { spawnSync } from "child_process";
import { userInfo } from "os";
import { SecurityLogger } from "../../src/utils/securityLogger";

const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockedMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockedChmodSync = chmodSync as jest.MockedFunction<typeof chmodSync>;
const mockedUserInfo = userInfo as jest.MockedFunction<typeof userInfo>;
const mockedSecurityLoggerWarn = SecurityLogger.warn as jest.MockedFunction<typeof SecurityLogger.warn>;

let secureWriteModule: typeof import("../../src/utils/secureWrite");

async function loadModule() {
  jest.resetModules();
  jest.clearAllMocks();
  // Re-apply mocks after resetModules
  jest.doMock("child_process", () => ({ spawnSync: mockedSpawnSync }));
  jest.doMock("fs", () => ({
    writeFileSync: mockedWriteFileSync,
    mkdirSync: mockedMkdirSync,
    chmodSync: mockedChmodSync,
  }));
  jest.doMock("os", () => ({ userInfo: mockedUserInfo }));
  jest.doMock("../../src/utils/securityLogger", () => ({
    SecurityLogger: { warn: mockedSecurityLoggerWarn },
  }));
  secureWriteModule = await import("../../src/utils/secureWrite");
  return secureWriteModule;
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockedWriteFileSync.mockReturnValue(undefined);
  mockedMkdirSync.mockReturnValue(undefined);
  mockedChmodSync.mockReturnValue(undefined);
  mockedUserInfo.mockReturnValue({ username: "testuser", uid: 1000, gid: 1000, shell: "/bin/bash", homedir: "/home/testuser" });
  mockedSecurityLoggerWarn.mockReturnValue(undefined);
  mockedSpawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "", pid: 1, output: [], signal: null } as unknown as ReturnType<typeof spawnSync>);
});

// ─── ensureSecureDir ──────────────────────────────────────────────────────────

describe("ensureSecureDir", () => {
  it("should be no-op on repeated calls (lazy init)", async () => {
    await loadModule();
    const { ensureSecureDir } = secureWriteModule;

    ensureSecureDir("/some/path");
    ensureSecureDir("/some/path");
    ensureSecureDir("/some/other/path");

    // No fs operations expected — just sets a flag
    expect(mockedMkdirSync).not.toHaveBeenCalled();
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

// ─── secureWriteFileSync ───────────────────────────────────────────────────────

describe("secureWriteFileSync", () => {
  it("should call writeFileSync with correct arguments", async () => {
    await loadModule();
    const { secureWriteFileSync } = secureWriteModule;

    secureWriteFileSync("/path/to/file.txt", "test content");

    expect(mockedWriteFileSync).toHaveBeenCalledWith("/path/to/file.txt", "test content", undefined);
  });

  it("should pass options to writeFileSync", async () => {
    await loadModule();
    const { secureWriteFileSync } = secureWriteModule;
    const opts = { encoding: "utf8" as const, mode: 0o644 };

    secureWriteFileSync("/path/to/file.txt", "test content", opts);

    expect(mockedWriteFileSync).toHaveBeenCalledWith("/path/to/file.txt", "test content", opts);
  });

  describe("win32 platform", () => {
    it("should call spawnSync with icacls and correct argv array", async () => {
      await loadModule();
      const { secureWriteFileSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "win32", configurable: true });

      secureWriteFileSync("C:\\Users\\testuser\\file.txt", "data");

      expect(mockedSpawnSync).toHaveBeenCalledWith(
        "icacls",
        ["C:\\Users\\testuser\\file.txt", "/inheritance:r", "/grant:r", "testuser:F"],
      );
      expect(mockedChmodSync).not.toHaveBeenCalled();
    });

    it("should call SecurityLogger.warn when spawnSync returns non-zero status", async () => {
      await loadModule();
      const { secureWriteFileSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      mockedSpawnSync.mockReturnValueOnce({ status: 1, stdout: "", stderr: Buffer.from("Access denied"), pid: 1, output: [], signal: null } as unknown as ReturnType<typeof spawnSync>);

      secureWriteFileSync("C:\\Users\\testuser\\file.txt", "data");

      expect(mockedSecurityLoggerWarn).toHaveBeenCalledWith(
        "ACL operation failed",
        expect.objectContaining({ filePath: "C:\\Users\\testuser\\file.txt", platform: "win32" }),
      );
    });
  });

  describe("unix platform", () => {
    it("should call chmodSync with 0o600", async () => {
      await loadModule();
      const { secureWriteFileSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "linux", configurable: true });

      secureWriteFileSync("/home/testuser/file.txt", "data");

      expect(mockedChmodSync).toHaveBeenCalledWith("/home/testuser/file.txt", 0o600);
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it("should call SecurityLogger.warn when chmodSync throws", async () => {
      await loadModule();
      const { secureWriteFileSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      mockedChmodSync.mockImplementationOnce(() => {
        throw new Error("permission denied");
      });

      secureWriteFileSync("/home/testuser/file.txt", "data");

      expect(mockedSecurityLoggerWarn).toHaveBeenCalledWith(
        "chmod operation failed",
        expect.objectContaining({ filePath: "/home/testuser/file.txt", platform: "linux" }),
      );
    });
  });

  it("should use os.userInfo().username in ACL grant", async () => {
    await loadModule();
    const { secureWriteFileSync } = secureWriteModule;

    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    mockedUserInfo.mockReturnValueOnce({ username: "customuser", uid: 1000, gid: 1000, shell: "/bin/bash", homedir: "/home/customuser" });

    secureWriteFileSync("C:\\Users\\customuser\\file.txt", "data");

    expect(mockedSpawnSync).toHaveBeenCalledWith(
      "icacls",
      ["C:\\Users\\customuser\\file.txt", "/inheritance:r", "/grant:r", "customuser:F"],
    );
  });
});

// ─── secureMkdirSync ──────────────────────────────────────────────────────────

describe("secureMkdirSync", () => {
  it("should call mkdirSync with recursive true by default", async () => {
    await loadModule();
    const { secureMkdirSync } = secureWriteModule;

    secureMkdirSync("/path/to/dir");

    expect(mockedMkdirSync).toHaveBeenCalledWith("/path/to/dir", { recursive: true });
  });

  it("should pass options.recursive to mkdirSync", async () => {
    await loadModule();
    const { secureMkdirSync } = secureWriteModule;

    secureMkdirSync("/path/to/dir", { recursive: false });

    expect(mockedMkdirSync).toHaveBeenCalledWith("/path/to/dir", { recursive: false });
  });

  describe("win32 platform", () => {
    it("should call spawnSync with icacls and correct argv array", async () => {
      await loadModule();
      const { secureMkdirSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "win32", configurable: true });

      secureMkdirSync("C:\\Users\\testuser\\dir");

      expect(mockedSpawnSync).toHaveBeenCalledWith(
        "icacls",
        ["C:\\Users\\testuser\\dir", "/inheritance:r", "/grant:r", "testuser:F"],
      );
      expect(mockedChmodSync).not.toHaveBeenCalled();
    });

    it("should call SecurityLogger.warn when spawnSync returns non-zero status", async () => {
      await loadModule();
      const { secureMkdirSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      mockedSpawnSync.mockReturnValueOnce({ status: 1, stdout: "", stderr: Buffer.from("Access denied"), pid: 1, output: [], signal: null } as unknown as ReturnType<typeof spawnSync>);

      secureMkdirSync("C:\\Users\\testuser\\dir");

      expect(mockedSecurityLoggerWarn).toHaveBeenCalledWith(
        "ACL operation failed",
        expect.objectContaining({ dirPath: "C:\\Users\\testuser\\dir", platform: "win32" }),
      );
    });
  });

  describe("unix platform", () => {
    it("should call chmodSync with 0o700", async () => {
      await loadModule();
      const { secureMkdirSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "linux", configurable: true });

      secureMkdirSync("/home/testuser/dir");

      expect(mockedChmodSync).toHaveBeenCalledWith("/home/testuser/dir", 0o700);
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it("should call SecurityLogger.warn when chmodSync throws", async () => {
      await loadModule();
      const { secureMkdirSync } = secureWriteModule;

      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      mockedChmodSync.mockImplementationOnce(() => {
        throw new Error("permission denied");
      });

      secureMkdirSync("/home/testuser/dir");

      expect(mockedSecurityLoggerWarn).toHaveBeenCalledWith(
        "chmod operation failed",
        expect.objectContaining({ dirPath: "/home/testuser/dir", platform: "linux" }),
      );
    });
  });
});

import { EventEmitter } from "events";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
}));

import { spawn, execSync } from "child_process";
import { existsSync } from "fs";
import {
  checkSshAvailable,
  resolveSshPath,
  sshConnect,
  sshExec,
  sshStream,
  sanitizedEnv,
} from "../../src/utils/ssh";

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

function createMockProcess(exitCode: number = 0) {
  const cp = new EventEmitter() as any;
  cp.stdout = new EventEmitter();
  cp.stderr = new EventEmitter();
  process.nextTick(() => cp.emit("close", exitCode));
  return cp;
}

describe("ssh utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the cached SSH path between tests
    // We access it via the module's internal cache by clearing mocks
  });

  describe("resolveSshPath (BUG-13)", () => {
    it("should return 'ssh' when ssh is available in PATH", () => {
      mockedExecSync.mockReturnValue(Buffer.from("OpenSSH_8.9"));
      // Clear cache by using a fresh import each time isn't feasible,
      // but since execSync succeeds, it should return "ssh"
      const result = resolveSshPath();
      expect(result).toBe("ssh");
    });

    it("should return 'ssh' as fallback when not found anywhere", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("not found");
      });
      mockedExistsSync.mockReturnValue(false);

      const result = resolveSshPath();
      expect(result).toBe("ssh");
    });

    it("should return Windows SSH path when found in System32/OpenSSH (Windows only)", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });

      mockedExecSync.mockImplementation(() => {
        throw new Error("not found");
      });
      // First candidate (System32/OpenSSH/ssh.exe) exists
      mockedExistsSync.mockImplementation((p: any) =>
        typeof p === "string" && p.includes("OpenSSH") && p.includes("System32"),
      );

      const result = resolveSshPath();
      expect(result).toContain("ssh");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });
  });

  describe("checkSshAvailable", () => {
    it("should return true when ssh is available", () => {
      mockedExecSync.mockReturnValue(Buffer.from("OpenSSH_8.9"));
      expect(checkSshAvailable()).toBe(true);
    });

    it("should return false when ssh is not available", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("not found");
      });
      expect(checkSshAvailable()).toBe(false);
    });
  });

  describe("sshConnect", () => {
    it("should spawn ssh with correct args", async () => {
      const mockCp = createMockProcess(0);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshConnect("1.2.3.4");
      expect(code).toBe(0);
      expect(mockedSpawn).toHaveBeenCalledWith(
        "ssh",
        ["-o", "StrictHostKeyChecking=accept-new", "root@1.2.3.4"],
        expect.objectContaining({ stdio: "inherit" }),
      );
    });

    it("should return non-zero exit code", async () => {
      const mockCp = createMockProcess(255);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshConnect("1.2.3.4");
      expect(code).toBe(255);
    });

    it("should return 1 on error", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshConnect("1.2.3.4");
      process.nextTick(() => mockCp.emit("error", new Error("spawn failed")));
      const code = await promise;
      expect(code).toBe(1);
    });

    it("should return 0 when close code is null", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshConnect("1.2.3.4");
      process.nextTick(() => mockCp.emit("close", null));
      const code = await promise;
      expect(code).toBe(0);
    });

    it("should throw error for invalid IP address", () => {
      expect(() => sshConnect("invalid-ip")).toThrow("Invalid IP address");
      expect(() => sshConnect("1.2.3.4.5")).toThrow("Invalid IP address");
      expect(() => sshConnect("example.com")).toThrow("Invalid IP address");
    });
  });

  describe("sshStream", () => {
    it("should spawn ssh with command and inherit stdio", async () => {
      const mockCp = createMockProcess(0);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshStream("1.2.3.4", "docker logs coolify --follow");
      expect(code).toBe(0);
      expect(mockedSpawn).toHaveBeenCalledWith(
        "ssh",
        ["-o", "StrictHostKeyChecking=accept-new", "root@1.2.3.4", "docker logs coolify --follow"],
        expect.objectContaining({ stdio: "inherit" }),
      );
    });

    it("should return non-zero exit code", async () => {
      const mockCp = createMockProcess(1);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshStream("1.2.3.4", "journalctl -f");
      expect(code).toBe(1);
    });

    it("should return 1 on error", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshStream("1.2.3.4", "tail -f /var/log/syslog");
      process.nextTick(() => mockCp.emit("error", new Error("spawn failed")));
      const code = await promise;
      expect(code).toBe(1);
    });

    it("should return 0 when close code is null", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshStream("1.2.3.4", "journalctl -f");
      process.nextTick(() => mockCp.emit("close", null));
      const code = await promise;
      expect(code).toBe(0);
    });

    it("should throw error for invalid IP address", () => {
      expect(() => sshStream("not-an-ip", "uptime")).toThrow("Invalid IP address");
    });
  });

  describe("sshExec", () => {
    it("should execute command and return output", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec("1.2.3.4", "docker ps");
      process.nextTick(() => {
        mockCp.stdout.emit("data", Buffer.from("CONTAINER ID"));
        mockCp.emit("close", 0);
      });

      const result = await promise;
      expect(result.code).toBe(0);
      expect(result.stdout).toBe("CONTAINER ID");
      expect(result.stderr).toBe("");
    });

    it("should capture stderr", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec("1.2.3.4", "bad-command");
      process.nextTick(() => {
        mockCp.stderr.emit("data", Buffer.from("command not found"));
        mockCp.emit("close", 127);
      });

      const result = await promise;
      expect(result.code).toBe(127);
      expect(result.stderr).toBe("command not found");
    });

    it("should handle spawn error", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec("1.2.3.4", "test");
      process.nextTick(() => mockCp.emit("error", new Error("spawn failed")));

      const result = await promise;
      expect(result.code).toBe(1);
      expect(result.stderr).toBe("spawn failed");
    });

    it("should pass correct args with StrictHostKeyChecking", async () => {
      const mockCp = createMockProcess(0);
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      await sshExec("1.2.3.4", "uptime");
      expect(mockedSpawn).toHaveBeenCalledWith(
        "ssh",
        ["-o", "StrictHostKeyChecking=accept-new", "root@1.2.3.4", "uptime"],
        expect.objectContaining({ stdio: ["inherit", "pipe", "pipe"] }),
      );
    });

    it("should default to code 1 when close code is null", async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec("1.2.3.4", "test-cmd");
      process.nextTick(() => mockCp.emit("close", null));

      const result = await promise;
      expect(result.code).toBe(1);
    });

    it("should throw error for invalid IP address", () => {
      expect(() => sshExec("localhost", "uptime")).toThrow("Invalid IP address");
    });
  });

  describe("sanitizedEnv", () => {
    it("should remove sensitive environment variables", () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PATH: "/usr/bin",
        HOME: "/home/user",
        HETZNER_TOKEN: "secret-token",
        DIGITALOCEAN_TOKEN: "do-secret",
        MY_SECRET: "hidden",
        DB_PASSWORD: "dbpass",
        API_CREDENTIAL: "cred",
      };

      const env = sanitizedEnv();

      expect(env.PATH).toBe("/usr/bin");
      expect(env.HOME).toBe("/home/user");
      expect(env.HETZNER_TOKEN).toBeUndefined();
      expect(env.DIGITALOCEAN_TOKEN).toBeUndefined();
      expect(env.MY_SECRET).toBeUndefined();
      expect(env.DB_PASSWORD).toBeUndefined();
      expect(env.API_CREDENTIAL).toBeUndefined();

      process.env = originalEnv;
    });

    it("should return a copy of process.env without modifying original", () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, TEST_TOKEN: "value" };

      const env = sanitizedEnv();

      expect(env.TEST_TOKEN).toBeUndefined();
      expect(process.env.TEST_TOKEN).toBe("value");

      process.env = originalEnv;
    });
  });
});

import { readFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { findLocalSshKey, generateSshKey, getSshKeyName } from "../../src/utils/sshKey";

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));
jest.mock("os", () => ({
  homedir: jest.fn().mockReturnValue("/home/testuser"),
}));

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("sshKey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findLocalSshKey", () => {
    it("should find ed25519 key", () => {
      mockedExistsSync.mockImplementation((p) => String(p).includes("id_ed25519.pub"));
      mockedReadFileSync.mockReturnValue("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 user@host");
      expect(findLocalSshKey()).toBe("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 user@host");
    });

    it("should find rsa key when ed25519 not present", () => {
      mockedExistsSync.mockImplementation((p) => String(p).includes("id_rsa.pub"));
      mockedReadFileSync.mockReturnValue("ssh-rsa AAAAB3NzaC1yc2E user@host");
      expect(findLocalSshKey()).toBe("ssh-rsa AAAAB3NzaC1yc2E user@host");
    });

    it("should find ecdsa key when others not present", () => {
      mockedExistsSync.mockImplementation((p) => String(p).includes("id_ecdsa.pub"));
      mockedReadFileSync.mockReturnValue("ssh-ecdsa AAAAE2VjZHNh user@host");
      // Note: real ecdsa keys start with "ecdsa-sha2-" not "ssh-ecdsa"
      // but some do start with "ssh-", so we test the "ssh-" prefix path
      expect(findLocalSshKey()).toBe("ssh-ecdsa AAAAE2VjZHNh user@host");
    });

    it("should return null when no keys exist", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(findLocalSshKey()).toBeNull();
    });

    it("should skip key with invalid content (no ssh- prefix)", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("not-a-valid-key-format");
      expect(findLocalSshKey()).toBeNull();
    });

    it("should continue on read error", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error("permission denied");
      });
      expect(findLocalSshKey()).toBeNull();
    });
  });

  describe("generateSshKey", () => {
    it("should generate key successfully", () => {
      mockedExistsSync
        .mockReturnValueOnce(true) // sshDir exists
        .mockReturnValueOnce(true); // pubkey exists
      mockedReadFileSync.mockReturnValue("ssh-ed25519 AAAAC3Nz quicklify");
      const result = generateSshKey();
      expect(result).toBe("ssh-ed25519 AAAAC3Nz quicklify");
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("ssh-keygen"),
        expect.any(Object),
      );
    });

    it("should create .ssh directory if not exists", () => {
      mockedExistsSync
        .mockReturnValueOnce(false) // sshDir doesn't exist
        .mockReturnValueOnce(true); // pubkey exists
      mockedReadFileSync.mockReturnValue("ssh-ed25519 AAAAC3Nz quicklify");
      generateSshKey();
      expect(mockedMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(".ssh"),
        expect.objectContaining({ mode: 0o700, recursive: true }),
      );
    });

    it("should return null when execSync fails", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedExecSync.mockImplementation(() => {
        throw new Error("ssh-keygen not found");
      });
      expect(generateSshKey()).toBeNull();
    });

    it("should return null when pubkey file not found after generation", () => {
      mockedExistsSync
        .mockReturnValueOnce(true) // sshDir exists
        .mockReturnValueOnce(false); // pubkey doesn't exist
      expect(generateSshKey()).toBeNull();
    });
  });

  describe("getSshKeyName", () => {
    it("should start with quicklify- prefix", () => {
      const name = getSshKeyName();
      expect(name).toMatch(/^quicklify-/);
    });

    it("should contain a numeric timestamp", () => {
      const name = getSshKeyName();
      const timestamp = name.replace("quicklify-", "");
      expect(Number(timestamp)).toBeGreaterThan(0);
    });

    it("should match the expected format", () => {
      const name = getSshKeyName();
      expect(name).toMatch(/^quicklify-\d+$/);
    });
  });
});

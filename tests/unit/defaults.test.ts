jest.mock("os", () => ({
  homedir: () => "/home/test",
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  getDefaults,
  setDefault,
  getDefault,
  resetDefaults,
  VALID_KEYS,
} from "../../src/utils/defaults";

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;

describe("defaults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDefaults", () => {
    it("should return empty object when file does not exist", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(getDefaults()).toEqual({});
    });

    it("should return parsed config", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('{"provider":"hetzner","region":"nbg1"}');
      expect(getDefaults()).toEqual({ provider: "hetzner", region: "nbg1" });
    });

    it("should return empty object for invalid JSON", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("not json");
      expect(getDefaults()).toEqual({});
    });

    it("should return empty object for array JSON", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("[]");
      expect(getDefaults()).toEqual({});
    });

    it("should return empty object for null JSON", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("null");
      expect(getDefaults()).toEqual({});
    });
  });

  describe("setDefault", () => {
    it("should write config to file", () => {
      mockedExistsSync.mockReturnValue(false);
      setDefault("provider", "hetzner");
      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("config.json"),
        expect.stringContaining('"provider": "hetzner"'),
        { mode: 0o600 },
      );
    });

    it("should throw for invalid key", () => {
      expect(() => setDefault("invalid", "value")).toThrow("Invalid config key: invalid");
    });

    it("should throw for invalid provider", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(() => setDefault("provider", "aws")).toThrow("Invalid provider: aws");
    });

    it("should accept valid keys", () => {
      mockedExistsSync.mockReturnValue(false);
      for (const key of VALID_KEYS) {
        if (key === "provider") {
          expect(() => setDefault(key, "hetzner")).not.toThrow();
        } else {
          expect(() => setDefault(key, "value")).not.toThrow();
        }
      }
    });

    it("should accept vultr as valid provider", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(() => setDefault("provider", "vultr")).not.toThrow();
    });

    it("should accept linode as valid provider", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(() => setDefault("provider", "linode")).not.toThrow();
    });

    it("should merge with existing config", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('{"provider":"hetzner"}');

      setDefault("region", "nbg1");

      const written = mockedWriteFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed).toEqual({ provider: "hetzner", region: "nbg1" });
    });
  });

  describe("getDefault", () => {
    it("should return value for existing key", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('{"provider":"hetzner"}');
      expect(getDefault("provider")).toBe("hetzner");
    });

    it("should return undefined for missing key", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("{}");
      expect(getDefault("provider")).toBeUndefined();
    });
  });

  describe("resetDefaults", () => {
    it("should write empty object", () => {
      mockedExistsSync.mockReturnValue(true);
      resetDefaults();
      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("config.json"),
        "{}",
        { mode: 0o600 },
      );
    });
  });
});

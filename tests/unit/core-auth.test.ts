// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __resetStore, __setAvailable } = require("@napi-rs/keyring") as {
  __resetStore: () => void;
  __setAvailable: (available: boolean) => void;
};
import {
  setToken,
  getToken,
  removeToken,
  listStoredProviders,
  isKeychainAvailable,
} from "../../src/core/auth";

beforeEach(() => {
  __resetStore();
});

describe("setToken", () => {
  it("should store a token in the keychain", () => {
    expect(setToken("hetzner", "test-token")).toBe(true);
  });

  it("should return false for unknown provider", () => {
    expect(setToken("aws", "test-token")).toBe(false);
  });

  it("should return false when keychain is unavailable", () => {
    __setAvailable(false);
    expect(setToken("hetzner", "test-token")).toBe(false);
  });
});

describe("getToken", () => {
  it("should retrieve a stored token", () => {
    setToken("hetzner", "test-token");
    expect(getToken("hetzner")).toBe("test-token");
  });

  it("should return undefined when no token is stored", () => {
    expect(getToken("hetzner")).toBeUndefined();
  });

  it("should return undefined for unknown provider", () => {
    expect(getToken("aws")).toBeUndefined();
  });

  it("should return undefined when keychain is unavailable", () => {
    setToken("hetzner", "test-token");
    __setAvailable(false);
    expect(getToken("hetzner")).toBeUndefined();
  });
});

describe("removeToken", () => {
  it("should remove a stored token and return true", () => {
    setToken("hetzner", "test-token");
    expect(removeToken("hetzner")).toBe(true);
    expect(getToken("hetzner")).toBeUndefined();
  });

  it("should return false for non-existent provider token", () => {
    expect(removeToken("hetzner")).toBe(false);
  });

  it("should return false for unknown provider", () => {
    expect(removeToken("aws")).toBe(false);
  });

  it("should return false when keychain is unavailable", () => {
    __setAvailable(false);
    expect(removeToken("hetzner")).toBe(false);
  });
});

describe("listStoredProviders", () => {
  it("should return array of providers with stored tokens", () => {
    setToken("hetzner", "h-token");
    setToken("vultr", "v-token");
    const providers = listStoredProviders();
    expect(providers).toContain("hetzner");
    expect(providers).toContain("vultr");
    expect(providers).not.toContain("digitalocean");
    expect(providers).not.toContain("linode");
  });

  it("should return empty array when no tokens stored", () => {
    expect(listStoredProviders()).toEqual([]);
  });

  it("should return empty array when keychain is unavailable", () => {
    setToken("hetzner", "h-token");
    __setAvailable(false);
    expect(listStoredProviders()).toEqual([]);
  });
});

describe("isKeychainAvailable", () => {
  it("should return true when keychain is available", () => {
    expect(isKeychainAvailable()).toBe(true);
  });
});

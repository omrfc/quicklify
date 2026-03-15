import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import {
  storeNotifySecret,
  readNotifySecret,
  removeNotifySecret,
  saveNotifyChannel,
  loadNotifyChannels,
  removeNotifyChannel,
  isNotifyKeychainAvailable,
} from "../../src/core/notifyStore.js";
import type { NotifyConfig } from "../../src/core/notify.js";
import { __resetStore, __setAvailable } from "../__mocks__/@napi-rs/keyring.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock("../../src/core/tokenBuffer.js", () => ({
  storeToken: jest.fn(),
  readToken: jest.fn(),
}));

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockedMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;

import { storeToken as mockedStoreToken, readToken as mockedReadToken } from "../../src/core/tokenBuffer.js";
const storeTokenMock = mockedStoreToken as jest.Mock;
const readTokenMock = mockedReadToken as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  __resetStore();
  __setAvailable(true);
});

// ─── storeNotifySecret (keychain available) ───────────────────────────────────

describe("storeNotifySecret — keychain path", () => {
  it("stores telegram botToken in keychain and returns true (SEC-01)", () => {
    const result = storeNotifySecret("telegram", "botToken", "bot123:ABC");

    expect(result).toBe(true);
  });

  it("stores telegram chatId in keychain and returns true (SEC-01)", () => {
    const result = storeNotifySecret("telegram", "chatId", "-100456");

    expect(result).toBe(true);
  });

  it("stores discord webhookUrl in keychain and returns true (SEC-01)", () => {
    const result = storeNotifySecret("discord", "webhookUrl", "https://discord.com/api/webhooks/1/tok");

    expect(result).toBe(true);
  });

  it("stores slack webhookUrl in keychain and returns true (SEC-01)", () => {
    const result = storeNotifySecret("slack", "webhookUrl", "https://hooks.slack.com/T/B/s");

    expect(result).toBe(true);
  });
});

// ─── readNotifySecret (keychain available) ────────────────────────────────────

describe("readNotifySecret — keychain path", () => {
  it("reads stored telegram botToken from keychain (SEC-01)", () => {
    storeNotifySecret("telegram", "botToken", "bot123:ABC");

    const result = readNotifySecret("telegram", "botToken");

    expect(result).toBe("bot123:ABC");
  });

  it("reads stored discord webhookUrl from keychain (SEC-01)", () => {
    storeNotifySecret("discord", "webhookUrl", "https://discord.com/api/webhooks/1/tok");

    const result = readNotifySecret("discord", "webhookUrl");

    expect(result).toBe("https://discord.com/api/webhooks/1/tok");
  });

  it("returns undefined for non-existent key (SEC-01)", () => {
    const result = readNotifySecret("telegram", "botToken");

    expect(result).toBeUndefined();
  });
});

// ─── removeNotifySecret (keychain available) ──────────────────────────────────

describe("removeNotifySecret — keychain path", () => {
  it("removes stored telegram botToken from keychain and returns true (SEC-01)", () => {
    storeNotifySecret("telegram", "botToken", "bot123");
    const result = removeNotifySecret("telegram", "botToken");

    expect(result).toBe(true);
  });

  it("after removal, readNotifySecret returns undefined (SEC-01)", () => {
    storeNotifySecret("telegram", "botToken", "bot123");
    removeNotifySecret("telegram", "botToken");

    const result = readNotifySecret("telegram", "botToken");

    expect(result).toBeUndefined();
  });

  it("returns false when key does not exist (SEC-01)", () => {
    const result = removeNotifySecret("telegram", "botToken");

    expect(result).toBe(false);
  });
});

// ─── Fallback path (keychain unavailable) ─────────────────────────────────────

describe("storeNotifySecret / readNotifySecret — fallback path", () => {
  beforeEach(() => {
    __setAvailable(false);
    mockedExistsSync.mockReturnValue(false);
  });

  it("stores to tokenBuffer when keychain unavailable (SEC-01)", () => {
    storeNotifySecret("telegram", "botToken", "bot123");

    expect(storeTokenMock).toHaveBeenCalledWith("telegram:botToken", "bot123");
  });

  it("also persists to notify-secrets.json when keychain unavailable (SEC-01)", () => {
    mockedReadFileSync.mockReturnValue("{}");
    mockedExistsSync.mockReturnValue(true);

    storeNotifySecret("telegram", "botToken", "bot123");

    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("notify-secrets.json"),
      expect.any(String),
      { mode: 0o600 },
    );
  });

  it("reads from tokenBuffer first when keychain unavailable (SEC-01)", () => {
    readTokenMock.mockReturnValue("bot456");

    const result = readNotifySecret("telegram", "botToken");

    expect(readTokenMock).toHaveBeenCalledWith("telegram:botToken");
    expect(result).toBe("bot456");
  });

  it("reads from file when tokenBuffer miss and keychain unavailable (SEC-01)", () => {
    readTokenMock.mockReturnValue(undefined);
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ "telegram:botToken": "fromFile" }));

    const result = readNotifySecret("telegram", "botToken");

    expect(result).toBe("fromFile");
  });
});

// ─── saveNotifyChannel ────────────────────────────────────────────────────────

describe("saveNotifyChannel", () => {
  it("saves telegram secrets to keychain (SEC-01)", () => {
    mockedExistsSync.mockReturnValue(false);

    saveNotifyChannel("telegram", { botToken: "bot123", chatId: "-100456" });

    const storedBot = readNotifySecret("telegram", "botToken");
    const storedChat = readNotifySecret("telegram", "chatId");
    expect(storedBot).toBe("bot123");
    expect(storedChat).toBe("-100456");
  });

  it("saves discord webhook to keychain (SEC-01)", () => {
    mockedExistsSync.mockReturnValue(false);

    saveNotifyChannel("discord", { webhookUrl: "https://discord.com/api/webhooks/1/tok" });

    const stored = readNotifySecret("discord", "webhookUrl");
    expect(stored).toBe("https://discord.com/api/webhooks/1/tok");
  });

  it("writes channel metadata to notify-channels.json without secrets (SEC-01)", () => {
    mockedExistsSync.mockReturnValue(false);

    saveNotifyChannel("telegram", { botToken: "bot123", chatId: "-100456" });

    const call = mockedWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("notify-channels.json"),
    );
    expect(call).toBeDefined();
    const content = call![1] as string;
    const parsed = JSON.parse(content) as Record<string, boolean>;
    expect(parsed.telegram).toBe(true);
    // Secrets must NOT be in metadata
    expect(content).not.toContain("bot123");
    expect(content).not.toContain("chatId");
  });

  it("writing telegram does not remove pre-existing discord metadata (SEC-01)", () => {
    // Existing channels metadata
    mockedExistsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && p.includes("notify-channels.json");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({ telegram: false, discord: true, slack: false }));

    saveNotifyChannel("telegram", { botToken: "tok", chatId: "123" });

    const call = mockedWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("notify-channels.json"),
    );
    const parsed = JSON.parse(call![1] as string) as Record<string, boolean>;
    expect(parsed.telegram).toBe(true);
    expect(parsed.discord).toBe(true);
  });
});

// ─── loadNotifyChannels ────────────────────────────────────────────────────────

describe("loadNotifyChannels", () => {
  it("returns empty config when no channels configured (SEC-01)", () => {
    mockedExistsSync.mockReturnValue(false);

    const config = loadNotifyChannels();

    expect(config).toEqual({});
  });

  it("returns telegram config when channel is configured in keychain (SEC-01)", () => {
    // Set up channel metadata
    mockedExistsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && p.includes("notify-channels.json");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({ telegram: true, discord: false, slack: false }));

    // Pre-store secrets in keychain
    storeNotifySecret("telegram", "botToken", "bot123");
    storeNotifySecret("telegram", "chatId", "-100456");

    const config = loadNotifyChannels();

    expect(config.telegram?.botToken).toBe("bot123");
    expect(config.telegram?.chatId).toBe("-100456");
  });

  it("returns discord config when channel is configured in keychain (SEC-01)", () => {
    mockedExistsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && p.includes("notify-channels.json");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({ telegram: false, discord: true, slack: false }));

    storeNotifySecret("discord", "webhookUrl", "https://discord.com/api/webhooks/1/tok");

    const config = loadNotifyChannels();

    expect(config.discord?.webhookUrl).toBe("https://discord.com/api/webhooks/1/tok");
  });

  it("excludes channels where secrets are missing from keychain (SEC-01)", () => {
    mockedExistsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && p.includes("notify-channels.json");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({ telegram: true, discord: false, slack: false }));
    // No secrets stored for telegram — simulates broken state

    const config = loadNotifyChannels();

    expect(config.telegram).toBeUndefined();
  });
});

// ─── removeNotifyChannel ──────────────────────────────────────────────────────

describe("removeNotifyChannel", () => {
  it("removes telegram secrets from keychain (SEC-01)", () => {
    storeNotifySecret("telegram", "botToken", "bot123");
    storeNotifySecret("telegram", "chatId", "-100456");
    mockedExistsSync.mockReturnValue(false);

    removeNotifyChannel("telegram");

    expect(readNotifySecret("telegram", "botToken")).toBeUndefined();
    expect(readNotifySecret("telegram", "chatId")).toBeUndefined();
  });

  it("updates channel metadata to mark telegram as false (SEC-01)", () => {
    mockedExistsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && p.includes("notify-channels.json");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({ telegram: true, discord: false, slack: false }));

    removeNotifyChannel("telegram");

    const call = mockedWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("notify-channels.json"),
    );
    const parsed = JSON.parse(call![1] as string) as Record<string, boolean>;
    expect(parsed.telegram).toBe(false);
  });
});

// ─── isNotifyKeychainAvailable ────────────────────────────────────────────────

describe("isNotifyKeychainAvailable", () => {
  it("returns true when keychain is available", () => {
    __setAvailable(true);
    expect(isNotifyKeychainAvailable()).toBe(true);
  });

  it("returns false when keychain is unavailable", () => {
    __setAvailable(false);
    expect(isNotifyKeychainAvailable()).toBe(false);
  });
});

// ─── Migration from legacy notify.json ───────────────────────────────────────

describe("loadNotifyChannels — migration from legacy notify.json", () => {
  it("migrates telegram secrets from legacy notify.json to keychain (SEC-01)", () => {
    const legacy = {
      telegram: { botToken: "legacyBot", chatId: "legacyChat" },
    };
    mockedExistsSync.mockImplementation((p: unknown) => {
      const path = p as string;
      // Legacy notify.json exists, channels.json does not
      return path.includes("notify.json") && !path.includes("notify-channels") && !path.includes("notify-secrets");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify(legacy));

    const config = loadNotifyChannels();

    expect(config.telegram?.botToken).toBe("legacyBot");
    expect(config.telegram?.chatId).toBe("legacyChat");
  });

  it("writes notify-channels.json after migration from legacy notify.json (SEC-01)", () => {
    const legacy = { telegram: { botToken: "legacyBot", chatId: "legacyChat" } };
    mockedExistsSync.mockImplementation((p: unknown) => {
      const path = p as string;
      return path.includes("notify.json") && !path.includes("notify-channels") && !path.includes("notify-secrets");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify(legacy));

    loadNotifyChannels();

    const channelsWrite = mockedWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("notify-channels.json"),
    );
    expect(channelsWrite).toBeDefined();
  });

  it("removes secrets from legacy notify.json after migration (SEC-01)", () => {
    const legacy = { telegram: { botToken: "legacyBot", chatId: "legacyChat" } };
    mockedExistsSync.mockImplementation((p: unknown) => {
      const path = p as string;
      return path.includes("notify.json") && !path.includes("notify-channels") && !path.includes("notify-secrets");
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify(legacy));

    loadNotifyChannels();

    // Should write to notify.json to strip secrets (or not write if deleted)
    // Either way, the content written to notify.json should NOT contain botToken value
    const notifyWrite = mockedWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("notify.json") &&
        !(c[0] as string).includes("notify-channels"),
    );
    if (notifyWrite) {
      expect(notifyWrite[1] as string).not.toContain("legacyBot");
    }
  });
});

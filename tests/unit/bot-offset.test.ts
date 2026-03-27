import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { loadOffset, saveOffset, isStale, ensureOffsetDir } from "../../src/core/bot/offset";

jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loadOffset", () => {
  it("returns null when file does not exist", () => {
    mockedExistsSync.mockReturnValue(false);
    expect(loadOffset()).toBeNull();
  });

  it("returns BotOffset when valid JSON exists", () => {
    mockedExistsSync.mockReturnValue(true);
    const data = { lastUpdateId: 12345, savedAt: "2026-03-27T10:00:00.000Z" };
    mockedReadFileSync.mockReturnValue(JSON.stringify(data));
    const result = loadOffset();
    expect(result).toEqual(data);
    expect(result?.lastUpdateId).toBe(12345);
  });

  it("returns null when file contains invalid JSON", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue("not json {{{");
    expect(loadOffset()).toBeNull();
  });
});

describe("saveOffset", () => {
  it("writes correct JSON structure with lastUpdateId and savedAt", () => {
    mockedExistsSync.mockReturnValue(true);
    const now = Date.now();
    saveOffset(99999);

    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1);
    const [, content, options] = mockedWriteFileSync.mock.calls[0];
    const parsed = JSON.parse(content as string) as { lastUpdateId: number; savedAt: string };
    expect(parsed.lastUpdateId).toBe(99999);
    expect(new Date(parsed.savedAt).getTime()).toBeGreaterThanOrEqual(now - 1000);
    expect(options).toEqual({ mode: 0o600 });
  });

  it("ensureOffsetDir creates config directory if missing", () => {
    mockedExistsSync.mockReturnValue(false);
    const mockedMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
    ensureOffsetDir();
    expect(mockedMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });
});

describe("isStale", () => {
  it("returns true when savedAt is older than 24 hours", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isStale(old)).toBe(true);
  });

  it("returns false when savedAt is within 24 hours", () => {
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(isStale(recent)).toBe(false);
  });
});

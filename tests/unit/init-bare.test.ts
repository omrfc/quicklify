/**
 * Tests for bare mode init command in src/commands/init.ts
 * Covers: bare mode skips waitForCoolify, skips openBrowser, shows SSH info
 */

import axios from "axios";
import { initCommand } from "../../src/commands/init";

jest.mock("../../src/utils/healthCheck", () => ({
  waitForCoolify: jest.fn(),
}));

jest.mock("../../src/utils/config", () => ({
  saveServer: jest.fn(),
  getServers: jest.fn().mockReturnValue([]),
  removeServer: jest.fn(),
  findServer: jest.fn(),
}));

jest.mock("../../src/utils/sshKey", () => ({
  findLocalSshKey: jest.fn().mockReturnValue(null),
  generateSshKey: jest.fn().mockReturnValue(null),
  getSshKeyName: jest.fn().mockReturnValue("quicklify-test"),
}));

jest.mock("../../src/utils/openBrowser", () => ({
  openBrowser: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { waitForCoolify } = jest.requireMock("../../src/utils/healthCheck") as {
  waitForCoolify: jest.Mock;
};
const { openBrowser } = jest.requireMock("../../src/utils/openBrowser") as {
  openBrowser: jest.Mock;
};
const { saveServer } = jest.requireMock("../../src/utils/config") as {
  saveServer: jest.Mock;
};

function setupHetznerMocks() {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes("/servers/") && !url.includes("server_types")) {
      return Promise.resolve({
        data: { server: { id: 999, status: "running", public_net: { ipv4: { ip: "10.0.0.1" } } } },
      });
    }
    if (url.includes("locations")) {
      return Promise.resolve({
        data: { locations: [{ name: "nbg1", city: "Nuremberg", country: "Germany" }] },
      });
    }
    if (url.includes("server_types")) {
      return Promise.resolve({
        data: {
          server_types: [
            {
              name: "cax11",
              cores: 2,
              memory: 4,
              disk: 40,
              prices: [{ location: "nbg1", price_monthly: { gross: "3.85" } }],
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: { servers: [] } });
  });
  mockedAxios.post.mockResolvedValue({
    data: { server: { id: 999, public_net: { ipv4: { ip: "10.0.0.1" } }, status: "running" } },
  });
}

describe("initCommand — bare mode", () => {
  let consoleSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
    jest.clearAllMocks();
    setupHetznerMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should NOT call waitForCoolify when mode='bare'", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "bare-server",
      mode: "bare",
    });

    expect(waitForCoolify).not.toHaveBeenCalled();
  });

  it("should NOT call openBrowser when mode='bare'", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "bare-server",
      mode: "bare",
    });

    expect(openBrowser).not.toHaveBeenCalled();
  });

  it("should show SSH connection info when mode='bare'", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "bare-server",
      mode: "bare",
    });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toMatch(/ssh root@/i);
  });

  it("should save ServerRecord with mode:'bare' when mode='bare'", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "bare-server",
      mode: "bare",
    });

    expect(saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "bare" }),
    );
  });

  it("should call waitForCoolify when mode is NOT bare (default behavior)", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "coolify-server",
    });

    expect(waitForCoolify).toHaveBeenCalled();
  });

  it("should call openBrowser when mode is NOT bare and Coolify is ready", async () => {
    waitForCoolify.mockResolvedValue(true);

    await initCommand({
      provider: "hetzner",
      token: "test-token",
      region: "nbg1",
      size: "cax11",
      name: "coolify-server",
      noOpen: false,
    });

    expect(openBrowser).toHaveBeenCalled();
  });
});

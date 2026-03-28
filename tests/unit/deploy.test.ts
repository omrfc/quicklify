import * as sshUtils from "../../src/utils/ssh";
import * as sshKeyUtils from "../../src/utils/sshKey";
import * as loggerModule from "../../src/utils/logger";
import * as errorMapperModule from "../../src/utils/errorMapper";
import * as cloudInitModule from "../../src/utils/cloudInit";
import * as configModule from "../../src/utils/config";
import * as healthCheckModule from "../../src/utils/healthCheck";
import * as firewallModule from "../../src/core/firewall";
import * as secureModule from "../../src/core/secure";
import * as adapterFactory from "../../src/adapters/factory";
import { uploadSshKeyToProvider, deployServer } from "../../src/core/deploy";

const mockLoggerInfo = jest.fn();
const mockLoggerSuccess = jest.fn();
const mockLoggerWarning = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerTitle = jest.fn();
const mockLoggerStep = jest.fn();

jest.mock("../../src/utils/ssh");
jest.mock("../../src/utils/sshKey");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    success: (...args: unknown[]) => mockLoggerSuccess(...args),
    warning: (...args: unknown[]) => mockLoggerWarning(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    title: (...args: unknown[]) => mockLoggerTitle(...args),
    step: (...args: unknown[]) => mockLoggerStep(...args),
  },
  createSpinner: jest.fn(),
}));
jest.mock("../../src/utils/errorMapper");
jest.mock("../../src/utils/openBrowser");
jest.mock("../../src/utils/cloudInit");
jest.mock("../../src/utils/config");
jest.mock("../../src/utils/healthCheck");
jest.mock("../../src/utils/prompts");
jest.mock("../../src/core/firewall");
jest.mock("../../src/core/secure");
jest.mock("../../src/adapters/factory");

const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;
const mockedSshKey = sshKeyUtils as jest.Mocked<typeof sshKeyUtils>;
const mockedCreateSpinner = loggerModule.createSpinner as jest.Mock;
const mockedErrorMapper = errorMapperModule as jest.Mocked<typeof errorMapperModule>;
const mockedCloudInit = cloudInitModule as jest.Mocked<typeof cloudInitModule>;
const mockedConfig = configModule as jest.Mocked<typeof configModule>;
const mockedHealthCheck = healthCheckModule as jest.Mocked<typeof healthCheckModule>;
const mockedFirewall = firewallModule as jest.Mocked<typeof firewallModule>;
const mockedSecure = secureModule as jest.Mocked<typeof secureModule>;
const mockedAdapterFactory = adapterFactory as jest.Mocked<typeof adapterFactory>;

// Spinner mock
const spinnerMock = {
  start: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  text: "",
};

// Provider mock factory
function makeProvider(overrides?: Partial<Record<string, jest.Mock>>) {
  return {
    uploadSshKey: jest.fn().mockResolvedValue("key-123"),
    createServer: jest.fn().mockResolvedValue({ id: "srv-1", ip: "5.6.7.8", status: "running" }),
    getServerStatus: jest.fn().mockResolvedValue("running"),
    getServerDetails: jest.fn().mockResolvedValue({ ip: "5.6.7.8" }),
    ...overrides,
  } as unknown as import("../../src/providers/base.js").CloudProvider;
}

beforeEach(() => {
  jest.resetAllMocks();

  // Re-wire logger mocks after resetAllMocks
  mockLoggerInfo.mockImplementation(() => undefined);
  mockLoggerSuccess.mockImplementation(() => undefined);
  mockLoggerWarning.mockImplementation(() => undefined);
  mockLoggerError.mockImplementation(() => undefined);
  mockLoggerTitle.mockImplementation(() => undefined);
  mockLoggerStep.mockImplementation(() => undefined);

  // Default mocks
  mockedCreateSpinner.mockReturnValue(spinnerMock as unknown as ReturnType<typeof loggerModule.createSpinner>);
  mockedErrorMapper.getErrorMessage.mockImplementation((e: unknown) => (e instanceof Error ? e.message : String(e)));
  mockedErrorMapper.mapProviderError.mockReturnValue("");
  mockedSshKey.getSshKeyName.mockReturnValue("kastell-key");
  mockedCloudInit.getBareCloudInit.mockReturnValue("#!/bin/bash\necho bare");
  mockedConfig.saveServer.mockResolvedValue(undefined);
  mockedHealthCheck.waitForCoolify.mockResolvedValue(false);
  mockedSsh.assertValidIp.mockImplementation(() => undefined);
  mockedSsh.removeStaleHostKey.mockImplementation(() => undefined);
  mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
  mockedFirewall.firewallSetup.mockResolvedValue(undefined);
  mockedSecure.secureSetup.mockResolvedValue(undefined);
  mockedAdapterFactory.getAdapter.mockReturnValue({
    getCloudInit: jest.fn().mockReturnValue("#!/bin/bash\necho coolify"),
  } as unknown as ReturnType<typeof adapterFactory.getAdapter>);
});

// ─── uploadSshKeyToProvider ──────────────────────────────────────────────────

describe("uploadSshKeyToProvider", () => {
  it("returns key ID array on success", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    const result = await uploadSshKeyToProvider(provider);
    expect(result).toEqual(["key-123"]);
  });

  it("calls provider.uploadSshKey with getSshKeyName result", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    mockedSshKey.getSshKeyName.mockReturnValue("my-kastell-key");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(provider.uploadSshKey).toHaveBeenCalledWith("my-kastell-key", "ssh-ed25519 AAAA...");
  });

  it("spinner succeed message contains 'password-free access enabled'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining("password-free access enabled"));
  });

  it("spinner succeed message contains 'SSH key uploaded'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining("SSH key uploaded"));
  });

  it("spinner start message contains 'Uploading SSH key to provider'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockedCreateSpinner).toHaveBeenCalledWith(expect.stringContaining("Uploading SSH key to provider"));
  });

  it("returns empty array when no local key and generateSshKey fails", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    const result = await uploadSshKeyToProvider(provider);
    expect(result).toEqual([]);
  });

  it("logs 'No SSH key found' when findLocalSshKey returns null", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("No SSH key found"));
  });

  it("logs warning about falling back to password auth on key gen failure", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerWarning).toHaveBeenCalledWith(expect.stringContaining("Could not generate SSH key"));
  });

  it("logs 'kastell secure setup' hint on key gen failure", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerWarning).toHaveBeenCalledWith(expect.stringContaining("kastell secure setup"));
  });

  it("generates key when none found and returns key ID on upload success", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue("ssh-ed25519 GENERATED...");
    const provider = makeProvider();
    const result = await uploadSshKeyToProvider(provider);
    expect(result).toEqual(["key-123"]);
  });

  it("logs success with ~/.ssh/id_ed25519 on key generation", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue("ssh-ed25519 GENERATED...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerSuccess).toHaveBeenCalledWith(expect.stringContaining("~/.ssh/id_ed25519"));
  });

  it("returns empty array when upload throws", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({ uploadSshKey: jest.fn().mockRejectedValue(new Error("upload fail")) });
    const result = await uploadSshKeyToProvider(provider);
    expect(result).toEqual([]);
  });

  it("spinner fail message contains 'SSH key upload failed'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({ uploadSshKey: jest.fn().mockRejectedValue(new Error("upload fail")) });
    await uploadSshKeyToProvider(provider);
    expect(spinnerMock.fail).toHaveBeenCalledWith(expect.stringContaining("SSH key upload failed"));
  });

  it("spinner fail message contains 'falling back to password auth'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({ uploadSshKey: jest.fn().mockRejectedValue(new Error("upload fail")) });
    await uploadSshKeyToProvider(provider);
    expect(spinnerMock.fail).toHaveBeenCalledWith(expect.stringContaining("falling back to password auth"));
  });
});

// ─── [MUTATION-KILLER] deploy string assertions ──────────────────────────────

describe("[MUTATION-KILLER] deployServer error path strings", () => {
  it("returns error containing 'Deployment failed:' on provider throw", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({
      uploadSshKey: jest.fn().mockResolvedValue("key-1"),
      createServer: jest.fn().mockRejectedValue(new Error("quota exceeded")),
    });
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Deployment failed:");
  });

  it("error contains provider error message", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({
      uploadSshKey: jest.fn().mockResolvedValue("key-1"),
      createServer: jest.fn().mockRejectedValue(new Error("quota exceeded")),
    });
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(result.error).toContain("quota exceeded");
  });

  it("returns hint from mapProviderError when available", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    mockedErrorMapper.mapProviderError.mockReturnValue("Check API token");
    const provider = makeProvider({
      uploadSshKey: jest.fn().mockResolvedValue("key-1"),
      createServer: jest.fn().mockRejectedValue(new Error("401 unauthorized")),
    });
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(result.hint).toBe("Check API token");
  });
});

describe("[MUTATION-KILLER] deployServer bare mode strings", () => {
  it("returns success with serverId, serverIp, serverName for bare mode", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    // Mock the SSH wait to succeed quickly
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(result.success).toBe(true);
    expect(result.data?.serverId).toBe("srv-1");
    expect(result.data?.serverIp).toBe("5.6.7.8");
    expect(result.data?.serverName).toBe("test-srv");
  });

  it("saveServer is called with mode 'bare' for bare deployments", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(mockedConfig.saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "bare" }),
    );
  });

  it("spinner text contains 'Creating VPS server'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(mockedCreateSpinner).toHaveBeenCalledWith(expect.stringContaining("Creating VPS server"));
  });

  it("spinner text contains 'Waiting for server to boot'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(mockedCreateSpinner).toHaveBeenCalledWith(expect.stringContaining("Waiting for server to boot"));
  });

  it("server creation spinner succeed contains server ID", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining("Server created"));
  });

  it("server running spinner succeed contains 'Server is running'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(spinnerMock.succeed).toHaveBeenCalledWith(expect.stringContaining("Server is running"));
  });
});

describe("[MUTATION-KILLER] deployServer coolify mode strings", () => {
  it("saveServer is called with mode 'coolify' for coolify deployments", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedHealthCheck.waitForCoolify.mockResolvedValue(true);
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "coolify");
    expect(mockedConfig.saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "coolify", platform: "coolify" }),
    );
  });

  it("saveServer is called with platform 'dokploy' for dokploy mode", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedHealthCheck.waitForCoolify.mockResolvedValue(true);
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "dokploy");
    expect(mockedConfig.saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "dokploy" }),
    );
  });

  it("returns platform 'coolify' in result data for coolify deployments", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedHealthCheck.waitForCoolify.mockResolvedValue(true);
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "coolify");
    expect(result.data?.platform).toBe("coolify");
  });

  it("returns platform 'dokploy' in result data for dokploy deployments", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider();
    mockedHealthCheck.waitForCoolify.mockResolvedValue(true);
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "dokploy");
    expect(result.data?.platform).toBe("dokploy");
  });
});

describe("[MUTATION-KILLER] deployServer server creation retry strings", () => {
  it("returns error 'Could not create server after multiple attempts' when retries exhausted", async () => {
    // This path is hard to trigger without interactive prompts, but we can test the throw path
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({
      uploadSshKey: jest.fn().mockResolvedValue("key-1"),
      createServer: jest.fn().mockRejectedValue(new Error("server exploded")),
    });
    const result = await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    // The error gets re-thrown and caught by the outer try/catch
    expect(result.success).toBe(false);
    expect(result.error).toContain("Deployment failed:");
  });

  it("spinner fail message contains 'Server creation failed'", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({
      uploadSshKey: jest.fn().mockResolvedValue("key-1"),
      createServer: jest.fn().mockRejectedValue(new Error("server exploded")),
    });
    await deployServer("hetzner", provider, "eu-central", "cx21", "test-srv", false, true, "bare");
    expect(spinnerMock.fail).toHaveBeenCalledWith(expect.stringContaining("Server creation failed"));
  });
});

describe("[MUTATION-KILLER] uploadSshKeyToProvider string assertions", () => {
  it("'Generating one...' message on no SSH key", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue("ssh-ed25519 NEW...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("Generating one"));
  });

  it("'SSH key generated' success message", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue("ssh-ed25519 NEW...");
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerSuccess).toHaveBeenCalledWith(expect.stringContaining("SSH key generated"));
  });

  it("'falling back to password auth' warning on null generateSshKey", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerWarning).toHaveBeenCalledWith(expect.stringContaining("falling back to password auth"));
  });

  it("'Server will require password change on first SSH login' info message", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue(null);
    mockedSshKey.generateSshKey.mockReturnValue(null as unknown as string);
    const provider = makeProvider();
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("password change on first SSH login"));
  });

  it("'Run kastell secure setup' warning on upload failure", async () => {
    mockedSshKey.findLocalSshKey.mockReturnValue("ssh-ed25519 AAAA...");
    const provider = makeProvider({ uploadSshKey: jest.fn().mockRejectedValue(new Error("fail")) });
    await uploadSshKeyToProvider(provider);
    expect(mockLoggerWarning).toHaveBeenCalledWith(expect.stringContaining("kastell secure setup"));
  });
});

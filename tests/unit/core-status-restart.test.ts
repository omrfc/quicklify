import * as sshUtils from "../../src/utils/ssh";
import * as adapterFactory from "../../src/adapters/factory";
import * as errorMapper from "../../src/utils/errorMapper";
import { restartCoolify } from "../../src/core/status";

jest.mock("../../src/utils/ssh");
jest.mock("../../src/adapters/factory");
jest.mock("../../src/utils/errorMapper");
jest.mock("../../src/constants", () => ({
  COOLIFY_RESTART_CMD: "docker compose -f /data/coolify/source/docker-compose.yml restart",
  POLL_DELAY_MS: 0,
  COOLIFY_PORT: 8000,
  DOKPLOY_PORT: 3000,
}));

const mockedSshUtils = sshUtils as jest.Mocked<typeof sshUtils>;
const mockedAdapterFactory = adapterFactory as jest.Mocked<typeof adapterFactory>;
const mockedErrorMapper = errorMapper as jest.Mocked<typeof errorMapper>;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00.000Z",
  mode: "coolify" as const,
};

const mockAdapter = {
  name: "coolify",
  getCloudInit: jest.fn(() => ""),
  healthCheck: jest.fn(),
  createBackup: jest.fn(async () => ({ success: true })),
  getStatus: jest.fn(async () => ({ platformVersion: "1.0", status: "running" as const })),
  update: jest.fn(async () => ({ success: true })),
};

beforeEach(() => {
  jest.resetAllMocks();
  mockedAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);
  mockedAdapterFactory.resolvePlatform.mockReturnValue("coolify");
  mockedErrorMapper.getErrorMessage.mockImplementation((e) =>
    e instanceof Error ? e.message : String(e),
  );
  mockedErrorMapper.mapSshError.mockReturnValue(null as unknown as string);
});

describe("restartCoolify", () => {
  it("should return { success: true, nowRunning: true } when restart succeeds and Coolify is running", async () => {
    mockedSshUtils.sshExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mockAdapter.healthCheck.mockResolvedValue({ status: "running" });

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(true);
    expect(result.nowRunning).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockedSshUtils.sshExec).toHaveBeenCalledWith(
      "1.2.3.4",
      expect.stringContaining("docker compose"),
    );
  });

  it("should return { success: false, nowRunning: false, error } when SSH command fails", async () => {
    mockedSshUtils.sshExec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "compose error: service not found",
    });

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(false);
    expect(result.nowRunning).toBe(false);
    expect(result.error).toBe("compose error: service not found");
    expect(mockAdapter.healthCheck).not.toHaveBeenCalled();
  });

  it("should return { success: true, nowRunning: false } when restart succeeds but health check fails", async () => {
    mockedSshUtils.sshExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mockAdapter.healthCheck.mockResolvedValue({ status: "not reachable" });

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(true);
    expect(result.nowRunning).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it("should return { success: false, error, hint } when sshExec throws", async () => {
    const sshError = new Error("Connection refused");
    mockedSshUtils.sshExec.mockRejectedValue(sshError);
    mockedErrorMapper.getErrorMessage.mockReturnValue("Connection refused");
    mockedErrorMapper.mapSshError.mockReturnValue("SSH connection refused. Check the IP address and SSH access.");

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(false);
    expect(result.nowRunning).toBe(false);
    expect(result.error).toBe("Connection refused");
    expect(result.hint).toBe("SSH connection refused. Check the IP address and SSH access.");
  });

  it("should use SSH failure stderr as error when non-empty", async () => {
    mockedSshUtils.sshExec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "ssh: connect to host failed",
    });

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(false);
    expect(result.error).toBe("ssh: connect to host failed");
  });

  it("should use fallback error message when SSH failure stderr is empty", async () => {
    mockedSshUtils.sshExec.mockResolvedValue({ code: 1, stdout: "", stderr: "" });

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Restart command failed");
  });

  it("should not include hint field when mapSshError returns null", async () => {
    const sshError = new Error("Some error");
    mockedSshUtils.sshExec.mockRejectedValue(sshError);
    mockedErrorMapper.mapSshError.mockReturnValue(null as unknown as string);

    const result = await restartCoolify(sampleServer);

    expect(result.success).toBe(false);
    expect(result.hint).toBeUndefined();
  });
});

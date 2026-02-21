import axios from "axios";
import { waitForCoolify } from "../../src/utils/healthCheck";

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("waitForCoolify edge cases", () => {
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    jest.clearAllMocks();
    global.setTimeout = ((fn: Function) => {
      fn();
      return 0;
    }) as any;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it("should succeed on first attempt with 302 redirect response", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 302 });

    const result = await waitForCoolify("1.2.3.4", 0, 0, 5);

    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("should succeed with 401 unauthorized (Coolify is running but needs auth)", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 401 });

    const result = await waitForCoolify("5.6.7.8", 0, 0, 5);

    expect(result).toBe(true);
  });

  it("should succeed with 500 server error (Coolify is running but erroring)", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 500 });

    const result = await waitForCoolify("5.6.7.8", 0, 0, 5);

    expect(result).toBe(true);
  });

  it("should handle single attempt", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await waitForCoolify("1.2.3.4", 0, 0, 1);

    expect(result).toBe(false);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("should use correct URL format", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    await waitForCoolify("192.168.1.100", 0, 0, 1);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "http://192.168.1.100:8000",
      expect.objectContaining({
        timeout: 5000,
      }),
    );
  });

  it("should pass validateStatus that always returns true", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    await waitForCoolify("1.2.3.4", 0, 0, 1);

    const callArgs = mockedAxios.get.mock.calls[0][1];
    expect(callArgs?.validateStatus?.(404)).toBe(true);
    expect(callArgs?.validateStatus?.(500)).toBe(true);
    expect(callArgs?.validateStatus?.(200)).toBe(true);
  });

  it("should retry on timeout error", async () => {
    mockedAxios.get
      .mockRejectedValueOnce(new Error("timeout of 5000ms exceeded"))
      .mockResolvedValueOnce({ status: 200 });

    const result = await waitForCoolify("1.2.3.4", 0, 0, 3);

    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("should use default pollIntervalMs and maxAttempts when not provided", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await waitForCoolify("1.2.3.4", 0);

    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

import {
  stripSensitiveData,
  sanitizeResponseData,
} from "../../src/providers/base";

describe("sanitizeResponseData", () => {
  it("returns undefined for null/undefined", () => {
    expect(sanitizeResponseData(null)).toBeUndefined();
    expect(sanitizeResponseData(undefined)).toBeUndefined();
  });

  it("returns string data as-is", () => {
    expect(sanitizeResponseData("some error")).toBe("some error");
  });

  it("returns undefined for non-object/non-string", () => {
    expect(sanitizeResponseData(42)).toBeUndefined();
    expect(sanitizeResponseData(true)).toBeUndefined();
  });

  it("preserves Hetzner error format: { error: { message, code } }", () => {
    const data = {
      error: { message: "server_limit_exceeded", code: "limit_exceeded" },
      extra_field: "should be stripped",
    };
    expect(sanitizeResponseData(data)).toEqual({
      error: { message: "server_limit_exceeded", code: "limit_exceeded" },
    });
  });

  it("preserves DigitalOcean format: { message }", () => {
    const data = {
      id: "forbidden",
      message: "You do not have access",
      sensitive_field: "token-abc-123",
    };
    expect(sanitizeResponseData(data)).toEqual({
      message: "You do not have access",
    });
  });

  it("preserves Vultr format: { error: 'string' }", () => {
    const data = {
      error: "Invalid API token",
      status: 401,
      root_pass: "leaked-password",
    };
    expect(sanitizeResponseData(data)).toEqual({
      error: "Invalid API token",
    });
  });

  it("preserves Linode format: { errors: [{ reason }] }", () => {
    const data = {
      errors: [
        { reason: "Invalid region", field: "region" },
        { reason: "root_pass too short" },
      ],
      root_pass: "leaked-password",
    };
    const result = sanitizeResponseData(data) as Record<string, unknown>;
    expect(result.errors).toEqual([
      { reason: "Invalid region" },
      { reason: "root_pass too short" },
    ]);
    expect((result as Record<string, unknown>).root_pass).toBeUndefined();
  });

  it("strips unknown fields completely", () => {
    const data = {
      message: "Not found",
      api_key: "hetzner-token-secret",
      authorization: "Bearer secret",
      root_pass: "my-password",
    };
    const result = sanitizeResponseData(data);
    expect(result).toEqual({ message: "Not found" });
  });

  it("returns undefined for empty object", () => {
    expect(sanitizeResponseData({})).toBeUndefined();
  });

  it("returns undefined for object with only unknown fields", () => {
    expect(
      sanitizeResponseData({ token: "secret", password: "abc" }),
    ).toBeUndefined();
  });

  it("filters non-object entries in Linode errors array", () => {
    const data = {
      errors: ["string-entry", null, { reason: "valid" }, 42],
    };
    const result = sanitizeResponseData(data) as Record<string, unknown>;
    expect(result.errors).toEqual([{ reason: "valid" }]);
  });

  it("handles Linode error entry without reason field", () => {
    const data = {
      errors: [{ field: "region" }],
    };
    const result = sanitizeResponseData(data) as Record<string, unknown>;
    expect(result.errors).toEqual([{}]);
  });

  it("handles Hetzner error object with only message (no code)", () => {
    const data = { error: { message: "server not found" } };
    expect(sanitizeResponseData(data)).toEqual({
      error: { message: "server not found" },
    });
  });

  it("handles Hetzner error object with empty object", () => {
    const data = { error: {} };
    expect(sanitizeResponseData(data)).toBeUndefined();
  });
});

// Helper to create mock axios errors compatible with the project's axios mock
function createMockAxiosError(overrides: {
  message?: string;
  config?: {
    headers?: Record<string, string>;
    data?: unknown;
    url?: string;
  };
  response?: {
    status: number;
    data: unknown;
    headers?: Record<string, string>;
  };
  request?: unknown;
}): Error & Record<string, unknown> {
  const error = new Error(overrides.message ?? "Request failed") as Error &
    Record<string, unknown>;

  if (overrides.config) {
    error.config = {
      headers: overrides.config.headers ?? {
        Authorization: "Bearer secret-token",
      },
      data: overrides.config.data ?? '{"root_pass":"secret"}',
      url:
        overrides.config.url ?? "https://api.hetzner.cloud/v1/servers",
    };
  } else {
    error.config = {
      headers: { Authorization: "Bearer secret-token" },
      data: '{"root_pass":"secret"}',
      url: "https://api.hetzner.cloud/v1/servers",
    };
  }

  if (overrides.response) {
    error.response = {
      status: overrides.response.status,
      data: overrides.response.data,
      headers: overrides.response.headers ?? {
        "set-cookie": "session=abc",
        "x-request-id": "req-123",
      },
      statusText: "Bad Request",
    };
  }

  if (overrides.request !== undefined) {
    error.request = overrides.request;
  }

  return error;
}

describe("stripSensitiveData", () => {
  it("clears config.headers", () => {
    const error = createMockAxiosError({});
    stripSensitiveData(error);
    expect(error.config).toBeDefined();
    expect((error.config as Record<string, unknown>).headers).toBeUndefined();
  });

  it("clears config.data", () => {
    const error = createMockAxiosError({});
    stripSensitiveData(error);
    expect((error.config as Record<string, unknown>).data).toBeUndefined();
  });

  it("clears request object", () => {
    const error = createMockAxiosError({ request: { socket: {} } });
    stripSensitiveData(error);
    expect(error.request).toBeUndefined();
  });

  it("sanitizes response.data (strips unknown fields)", () => {
    const error = createMockAxiosError({
      response: {
        status: 403,
        data: {
          message: "Forbidden",
          api_key: "leaked-token",
          internal_details: { db_host: "10.0.0.1" },
        },
      },
    });
    stripSensitiveData(error);
    const resp = error.response as Record<string, unknown>;
    expect(resp.data).toEqual({ message: "Forbidden" });
  });

  it("clears response.headers", () => {
    const error = createMockAxiosError({
      response: {
        status: 500,
        data: { message: "Internal error" },
        headers: {
          "set-cookie": "session=abc123",
          "x-request-id": "req-456",
        },
      },
    });
    stripSensitiveData(error);
    const resp = error.response as Record<string, unknown>;
    expect(Object.keys(resp.headers as Record<string, unknown>)).toHaveLength(
      0,
    );
  });

  it("preserves response.status", () => {
    const error = createMockAxiosError({
      response: {
        status: 422,
        data: { message: "Validation failed" },
      },
    });
    stripSensitiveData(error);
    expect((error.response as Record<string, unknown>).status).toBe(422);
  });

  it("handles non-axios errors gracefully (no response property)", () => {
    const error = new Error("regular error");
    expect(() => stripSensitiveData(error)).not.toThrow();
  });

  it("handles non-error values gracefully", () => {
    expect(() => stripSensitiveData("string error")).not.toThrow();
    expect(() => stripSensitiveData(null)).not.toThrow();
    expect(() => stripSensitiveData(undefined)).not.toThrow();
    expect(() => stripSensitiveData(42)).not.toThrow();
  });

  it("strips Linode rootPass from response data", () => {
    const error = createMockAxiosError({
      response: {
        status: 400,
        data: {
          errors: [{ reason: "Invalid region" }],
          root_pass: "super-secret-password",
        },
      },
    });
    stripSensitiveData(error);
    const resp = error.response as Record<string, unknown>;
    const data = resp.data as Record<string, unknown>;
    expect(data.errors).toEqual([{ reason: "Invalid region" }]);
    expect(data.root_pass).toBeUndefined();
  });

  it("preserves Hetzner error structure for provider catch blocks", () => {
    const error = createMockAxiosError({
      response: {
        status: 409,
        data: {
          error: {
            message: "SSH key already exists",
            code: "uniqueness_error",
          },
        },
      },
    });
    stripSensitiveData(error);
    const resp = error.response as Record<string, unknown>;
    const data = resp.data as Record<string, unknown>;
    const errObj = data.error as Record<string, unknown>;
    expect(errObj.message).toBe("SSH key already exists");
    expect(errObj.code).toBe("uniqueness_error");
  });

  it("preserves Vultr error string for provider catch blocks", () => {
    const error = createMockAxiosError({
      response: {
        status: 400,
        data: { error: "Invalid API token" },
      },
    });
    stripSensitiveData(error);
    const resp = error.response as Record<string, unknown>;
    const data = resp.data as Record<string, unknown>;
    expect(data.error).toBe("Invalid API token");
  });

  it("handles error without config", () => {
    const error = createMockAxiosError({});
    delete error.config;
    stripSensitiveData(error);
    // Should not throw — no config to clean
  });

  it("handles error without response", () => {
    const error = createMockAxiosError({});
    // No response added
    stripSensitiveData(error);
    expect(error.response).toBeUndefined();
  });
});

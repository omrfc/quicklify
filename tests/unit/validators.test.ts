describe("Server name validation", () => {
  const serverNameRegex = /^[a-z0-9-]+$/;

  it("should accept valid lowercase server names", () => {
    expect(serverNameRegex.test("coolify-server")).toBe(true);
    expect(serverNameRegex.test("my-server-1")).toBe(true);
    expect(serverNameRegex.test("server")).toBe(true);
  });

  it("should accept numeric-only names", () => {
    expect(serverNameRegex.test("123")).toBe(true);
    expect(serverNameRegex.test("1-2-3")).toBe(true);
  });

  it("should accept hyphenated names", () => {
    expect(serverNameRegex.test("my-cool-server")).toBe(true);
    expect(serverNameRegex.test("a-b-c")).toBe(true);
  });

  it("should reject names with uppercase letters", () => {
    expect(serverNameRegex.test("MyServer")).toBe(false);
    expect(serverNameRegex.test("COOLIFY")).toBe(false);
    expect(serverNameRegex.test("Server")).toBe(false);
  });

  it("should reject names with spaces", () => {
    expect(serverNameRegex.test("my server")).toBe(false);
    expect(serverNameRegex.test(" server")).toBe(false);
  });

  it("should reject names with special characters", () => {
    expect(serverNameRegex.test("server!")).toBe(false);
    expect(serverNameRegex.test("server@1")).toBe(false);
    expect(serverNameRegex.test("server.com")).toBe(false);
    expect(serverNameRegex.test("server_name")).toBe(false);
    expect(serverNameRegex.test("server#1")).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(serverNameRegex.test("")).toBe(false);
  });
});

describe("API token validation", () => {
  const isTokenValid = (input: string) => {
    if (!input || input.trim().length === 0) return false;
    return true;
  };

  it("should accept non-empty tokens", () => {
    expect(isTokenValid("abc123")).toBe(true);
    expect(isTokenValid("some-long-api-token-here")).toBe(true);
  });

  it("should reject empty tokens", () => {
    expect(isTokenValid("")).toBe(false);
  });

  it("should reject whitespace-only tokens", () => {
    expect(isTokenValid("   ")).toBe(false);
    expect(isTokenValid("\t")).toBe(false);
  });
});

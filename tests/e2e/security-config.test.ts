import { validateYamlConfig, loadYamlConfig } from "../../src/utils/yamlConfig";
import * as fs from "fs";

jest.mock("fs");

const mockedFs = fs as jest.Mocked<typeof fs>;

describe("security-config E2E", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("security key detection - top level", () => {
    it("should warn for 'token' key", () => {
      const { warnings } = validateYamlConfig({ token: "secret123" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes('"token"'))).toBe(true);
    });

    it("should warn for 'PASSWORD' key (uppercase)", () => {
      const { warnings } = validateYamlConfig({ PASSWORD: "secret123" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes('"PASSWORD"'))).toBe(true);
    });

    it("should warn for 'ApiToken' key (mixed case)", () => {
      const { warnings } = validateYamlConfig({ ApiToken: "secret123" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'api_token' key", () => {
      const { warnings } = validateYamlConfig({ api_token: "abc" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'apiKey' key", () => {
      const { warnings } = validateYamlConfig({ apiKey: "abc" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'api_key' key", () => {
      const { warnings } = validateYamlConfig({ api_key: "abc" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'secret' key", () => {
      const { warnings } = validateYamlConfig({ secret: "abc" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'pass' key", () => {
      const { warnings } = validateYamlConfig({ pass: "secret" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'cred' key", () => {
      const { warnings } = validateYamlConfig({ cred: "value" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'dsn' key", () => {
      const { warnings } = validateYamlConfig({ dsn: "mysql://..." });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'connection_string' key", () => {
      const { warnings } = validateYamlConfig({ connection_string: "postgres://..." });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'connectionstring' key (no underscore)", () => {
      const { warnings } = validateYamlConfig({ connectionstring: "mongodb://..." });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'privateKey' key", () => {
      const { warnings } = validateYamlConfig({ privateKey: "-----BEGIN RSA..." });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'private_key' key", () => {
      const { warnings } = validateYamlConfig({ private_key: "key-content" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'jwt' key", () => {
      const { warnings } = validateYamlConfig({ jwt: "eyJhbGci..." });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'bearer' key", () => {
      const { warnings } = validateYamlConfig({ bearer: "token-value" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'authorization' key", () => {
      const { warnings } = validateYamlConfig({ authorization: "Basic abc123" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'auth' key", () => {
      const { warnings } = validateYamlConfig({ auth: "credentials" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'credentials' key", () => {
      const { warnings } = validateYamlConfig({ credentials: "user:pass" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn for 'credential' key", () => {
      const { warnings } = validateYamlConfig({ credential: "cred-value" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });
  });

  describe("security key detection - nested objects", () => {
    it("should warn for nested 'password' key with path", () => {
      const { warnings } = validateYamlConfig({
        database: {
          password: "secret123",
        },
      });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes('"database.password"'))).toBe(true);
    });

    it("should warn for deeply nested security keys", () => {
      const { warnings } = validateYamlConfig({
        services: {
          api: {
            credentials: {
              token: "secret123",
            },
          },
        },
      });
      expect(warnings.filter((w) => w.includes("Security warning")).length).toBeGreaterThanOrEqual(
        2,
      );
      expect(warnings.some((w) => w.includes("services.api.credentials"))).toBe(true);
      expect(warnings.some((w) => w.includes("services.api.credentials.token"))).toBe(true);
    });

    it("should warn for nested 'apiToken' key", () => {
      const { warnings } = validateYamlConfig({
        provider: {
          hetzner: {
            apiToken: "secret",
          },
        },
      });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes("provider.hetzner.apiToken"))).toBe(true);
    });

    it("should detect case-insensitive nested keys", () => {
      const { warnings } = validateYamlConfig({
        Config: {
          API_KEY: "secret123",
        },
      });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes('"Config.API_KEY"'))).toBe(true);
    });
  });

  describe("valid config keys - no false positives", () => {
    it("should NOT warn for 'template' key", () => {
      const { warnings } = validateYamlConfig({ template: "production" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'provider' key", () => {
      const { warnings } = validateYamlConfig({ provider: "hetzner" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'region' key", () => {
      const { warnings } = validateYamlConfig({ region: "nbg1" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'size' key", () => {
      const { warnings } = validateYamlConfig({ size: "cax11" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'name' key", () => {
      const { warnings } = validateYamlConfig({ name: "my-server" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'fullSetup' key", () => {
      const { warnings } = validateYamlConfig({ fullSetup: true });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should NOT warn for 'domain' key", () => {
      const { warnings } = validateYamlConfig({ domain: "example.com" });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(false);
    });

    it("should parse complete valid config without security warnings", () => {
      const { config, warnings } = validateYamlConfig({
        template: "production",
        provider: "hetzner",
        region: "nbg1",
        size: "cx33",
        name: "my-prod-server",
        fullSetup: true,
        domain: "coolify.example.com",
      });

      expect(warnings.filter((w) => w.includes("Security warning"))).toHaveLength(0);
      expect(config.template).toBe("production");
      expect(config.provider).toBe("hetzner");
    });
  });

  describe("unknown key warnings", () => {
    it("should warn for unknown keys", () => {
      const { warnings } = validateYamlConfig({ unknownKey: "value" });
      expect(warnings.some((w) => w.includes('Unknown config key: "unknownKey"'))).toBe(true);
    });

    it("should NOT warn unknown for security keys (they get security warning instead)", () => {
      const { warnings } = validateYamlConfig({ token: "secret" });
      expect(warnings.some((w) => w.includes("Unknown config key"))).toBe(false);
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });
  });

  describe("loadYamlConfig - file loading security", () => {
    it("should warn about token in YAML file", () => {
      mockedFs.readFileSync.mockReturnValue("provider: hetzner\ntoken: secret123\n");
      const { warnings } = loadYamlConfig("/with-token.yml");
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn about PASSWORD in YAML file (case-insensitive)", () => {
      mockedFs.readFileSync.mockReturnValue("provider: hetzner\nPASSWORD: secret\n");
      const { warnings } = loadYamlConfig("/with-password.yml");
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
    });

    it("should warn about nested password in YAML file", () => {
      mockedFs.readFileSync.mockReturnValue(
        "provider: hetzner\ndatabase:\n  password: secret\n",
      );
      const { warnings } = loadYamlConfig("/nested-password.yml");
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes("database.password"))).toBe(true);
    });

    it("should parse valid YAML without security warnings", () => {
      mockedFs.readFileSync.mockReturnValue(
        "provider: hetzner\nregion: nbg1\nsize: cax11\nname: my-server\n",
      );
      const { config, warnings } = loadYamlConfig("/valid.yml");
      expect(warnings.filter((w) => w.includes("Security warning"))).toHaveLength(0);
      expect(config.provider).toBe("hetzner");
    });

    it("should handle file read errors gracefully", () => {
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });
      const { config, warnings } = loadYamlConfig("/nonexistent.yml");
      expect(config).toEqual({});
      expect(warnings.some((w) => w.includes("Could not read config file"))).toBe(true);
    });

    it("should handle invalid YAML syntax", () => {
      mockedFs.readFileSync.mockReturnValue("{ invalid yaml: [");
      const { config, warnings } = loadYamlConfig("/bad.yml");
      expect(config).toEqual({});
      expect(warnings.some((w) => w.includes("Invalid YAML syntax"))).toBe(true);
    });
  });

  describe("security warning message format", () => {
    it("should include guidance about using --token flag or env vars", () => {
      const { warnings } = validateYamlConfig({ token: "secret" });
      expect(warnings.some((w) => w.includes("--token flag") || w.includes("environment variables"))).toBe(true);
    });

    it("should warn that tokens should NEVER be stored in config files", () => {
      const { warnings } = validateYamlConfig({ apiKey: "secret" });
      expect(warnings.some((w) => w.includes("NEVER"))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle null input", () => {
      const { config, warnings } = validateYamlConfig(null);
      expect(config).toEqual({});
      expect(warnings).toHaveLength(0);
    });

    it("should handle undefined input", () => {
      const { config, warnings } = validateYamlConfig(undefined);
      expect(config).toEqual({});
      expect(warnings).toHaveLength(0);
    });

    it("should handle array input (invalid)", () => {
      const { config, warnings } = validateYamlConfig([1, 2, 3]);
      expect(config).toEqual({});
      expect(warnings.some((w) => w.includes("must be a YAML object"))).toBe(true);
    });

    it("should handle string input (invalid)", () => {
      const { config, warnings } = validateYamlConfig("just a string");
      expect(config).toEqual({});
      expect(warnings.some((w) => w.includes("must be a YAML object"))).toBe(true);
    });

    it("should handle empty YAML file", () => {
      mockedFs.readFileSync.mockReturnValue("");
      const { config, warnings } = loadYamlConfig("/empty.yml");
      expect(config).toEqual({});
      expect(warnings).toHaveLength(0);
    });

    it("should handle YAML with only comments", () => {
      mockedFs.readFileSync.mockReturnValue("# just a comment\n# another comment\n");
      const { config, warnings } = loadYamlConfig("/comments.yml");
      expect(config).toEqual({});
      expect(warnings).toHaveLength(0);
    });
  });

  describe("multiple warnings collection", () => {
    it("should collect multiple security warnings", () => {
      const { warnings } = validateYamlConfig({
        token: "secret1",
        password: "secret2",
        apiKey: "secret3",
      });
      expect(warnings.filter((w) => w.includes("Security warning")).length).toBe(3);
    });

    it("should collect mixed warnings (security + validation)", () => {
      const { warnings } = validateYamlConfig({
        token: "secret",
        provider: "invalid-provider",
        unknownKey: "value",
      });
      expect(warnings.some((w) => w.includes("Security warning"))).toBe(true);
      expect(warnings.some((w) => w.includes("Invalid provider"))).toBe(true);
      expect(warnings.some((w) => w.includes("Unknown config key"))).toBe(true);
    });
  });
});

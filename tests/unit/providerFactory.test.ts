import { createProvider, createProviderWithToken } from "../../src/utils/providerFactory";
import { HetznerProvider } from "../../src/providers/hetzner";
import { DigitalOceanProvider } from "../../src/providers/digitalocean";

describe("providerFactory", () => {
  describe("createProvider", () => {
    it("should create HetznerProvider", () => {
      const provider = createProvider("hetzner");
      expect(provider).toBeInstanceOf(HetznerProvider);
      expect(provider.name).toBe("hetzner");
    });

    it("should create DigitalOceanProvider", () => {
      const provider = createProvider("digitalocean");
      expect(provider).toBeInstanceOf(DigitalOceanProvider);
      expect(provider.name).toBe("digitalocean");
    });

    it("should throw for unknown provider", () => {
      expect(() => createProvider("aws")).toThrow("Unknown provider: aws");
    });
  });

  describe("createProviderWithToken", () => {
    it("should create HetznerProvider with token", () => {
      const provider = createProviderWithToken("hetzner", "my-token");
      expect(provider).toBeInstanceOf(HetznerProvider);
    });

    it("should create DigitalOceanProvider with token", () => {
      const provider = createProviderWithToken("digitalocean", "my-token");
      expect(provider).toBeInstanceOf(DigitalOceanProvider);
    });

    it("should throw for unknown provider", () => {
      expect(() => createProviderWithToken("aws", "token")).toThrow("Unknown provider: aws");
    });
  });
});

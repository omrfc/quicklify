import {
  TEMPLATES,
  VALID_TEMPLATE_NAMES,
  getTemplate,
  getTemplateDefaults,
} from "../../src/utils/templates";

describe("templates", () => {
  describe("VALID_TEMPLATE_NAMES", () => {
    it("should contain exactly three templates", () => {
      expect(VALID_TEMPLATE_NAMES).toHaveLength(3);
    });

    it("should include starter, production, and dev", () => {
      expect(VALID_TEMPLATE_NAMES).toContain("starter");
      expect(VALID_TEMPLATE_NAMES).toContain("production");
      expect(VALID_TEMPLATE_NAMES).toContain("dev");
    });
  });

  describe("TEMPLATES", () => {
    it("should define all three templates", () => {
      expect(TEMPLATES.starter).toBeDefined();
      expect(TEMPLATES.production).toBeDefined();
      expect(TEMPLATES.dev).toBeDefined();
    });

    it("starter template should have correct properties", () => {
      const t = TEMPLATES.starter;
      expect(t.name).toBe("starter");
      expect(t.description).toBeTruthy();
      expect(t.fullSetup).toBe(false);
      expect(t.defaults.hetzner).toEqual({ region: "nbg1", size: "cax11" });
      expect(t.defaults.digitalocean).toEqual({ region: "fra1", size: "s-2vcpu-2gb" });
      expect(t.defaults.vultr).toEqual({ region: "ewr", size: "vc2-1c-2gb" });
      expect(t.defaults.linode).toEqual({ region: "us-east", size: "g6-standard-2" });
    });

    it("production template should have correct properties", () => {
      const t = TEMPLATES.production;
      expect(t.name).toBe("production");
      expect(t.description).toBeTruthy();
      expect(t.fullSetup).toBe(true);
      expect(t.defaults.hetzner).toEqual({ region: "nbg1", size: "cx33" });
      expect(t.defaults.digitalocean).toEqual({ region: "fra1", size: "s-2vcpu-4gb" });
      expect(t.defaults.vultr).toEqual({ region: "ewr", size: "vc2-2c-4gb" });
      expect(t.defaults.linode).toEqual({ region: "us-east", size: "g6-standard-4" });
    });

    it("dev template should have correct properties", () => {
      const t = TEMPLATES.dev;
      expect(t.name).toBe("dev");
      expect(t.description).toBeTruthy();
      expect(t.fullSetup).toBe(false);
      expect(t.defaults.hetzner).toEqual({ region: "nbg1", size: "cax11" });
      expect(t.defaults.digitalocean).toEqual({ region: "fra1", size: "s-2vcpu-2gb" });
      expect(t.defaults.vultr).toEqual({ region: "ewr", size: "vc2-1c-2gb" });
      expect(t.defaults.linode).toEqual({ region: "us-east", size: "g6-standard-2" });
    });

    it("each template should have defaults for all providers", () => {
      for (const name of VALID_TEMPLATE_NAMES) {
        expect(TEMPLATES[name].defaults.hetzner).toBeDefined();
        expect(TEMPLATES[name].defaults.digitalocean).toBeDefined();
        expect(TEMPLATES[name].defaults.vultr).toBeDefined();
        expect(TEMPLATES[name].defaults.linode).toBeDefined();
        expect(TEMPLATES[name].defaults.hetzner.region).toBeTruthy();
        expect(TEMPLATES[name].defaults.hetzner.size).toBeTruthy();
        expect(TEMPLATES[name].defaults.digitalocean.region).toBeTruthy();
        expect(TEMPLATES[name].defaults.digitalocean.size).toBeTruthy();
        expect(TEMPLATES[name].defaults.vultr.region).toBeTruthy();
        expect(TEMPLATES[name].defaults.vultr.size).toBeTruthy();
        expect(TEMPLATES[name].defaults.linode.region).toBeTruthy();
        expect(TEMPLATES[name].defaults.linode.size).toBeTruthy();
      }
    });
  });

  describe("getTemplate", () => {
    it("should return starter template", () => {
      const t = getTemplate("starter");
      expect(t).toBeDefined();
      expect(t!.name).toBe("starter");
    });

    it("should return production template", () => {
      const t = getTemplate("production");
      expect(t).toBeDefined();
      expect(t!.name).toBe("production");
    });

    it("should return dev template", () => {
      const t = getTemplate("dev");
      expect(t).toBeDefined();
      expect(t!.name).toBe("dev");
    });

    it("should return undefined for unknown template", () => {
      expect(getTemplate("unknown")).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(getTemplate("")).toBeUndefined();
    });
  });

  describe("getTemplateDefaults", () => {
    it("should return hetzner defaults for starter", () => {
      const d = getTemplateDefaults("starter", "hetzner");
      expect(d).toEqual({ region: "nbg1", size: "cax11" });
    });

    it("should return digitalocean defaults for production", () => {
      const d = getTemplateDefaults("production", "digitalocean");
      expect(d).toEqual({ region: "fra1", size: "s-2vcpu-4gb" });
    });

    it("should return hetzner defaults for dev", () => {
      const d = getTemplateDefaults("dev", "hetzner");
      expect(d).toEqual({ region: "nbg1", size: "cax11" });
    });

    it("should return undefined for unknown template", () => {
      expect(getTemplateDefaults("unknown", "hetzner")).toBeUndefined();
    });

    it("should return vultr defaults for starter", () => {
      const d = getTemplateDefaults("starter", "vultr");
      expect(d).toEqual({ region: "ewr", size: "vc2-1c-2gb" });
    });

    it("should return vultr defaults for production", () => {
      const d = getTemplateDefaults("production", "vultr");
      expect(d).toEqual({ region: "ewr", size: "vc2-2c-4gb" });
    });

    it("should return vultr defaults for dev", () => {
      const d = getTemplateDefaults("dev", "vultr");
      expect(d).toEqual({ region: "ewr", size: "vc2-1c-2gb" });
    });

    it("should return linode defaults for starter", () => {
      const d = getTemplateDefaults("starter", "linode");
      expect(d).toEqual({ region: "us-east", size: "g6-standard-2" });
    });

    it("should return linode defaults for production", () => {
      const d = getTemplateDefaults("production", "linode");
      expect(d).toEqual({ region: "us-east", size: "g6-standard-4" });
    });

    it("should return linode defaults for dev", () => {
      const d = getTemplateDefaults("dev", "linode");
      expect(d).toEqual({ region: "us-east", size: "g6-standard-2" });
    });

    it("should return undefined for unknown provider in valid template", () => {
      expect(getTemplateDefaults("starter", "aws")).toBeUndefined();
    });

    it("should return undefined when both are unknown", () => {
      expect(getTemplateDefaults("bogus", "bogus")).toBeUndefined();
    });
  });
});

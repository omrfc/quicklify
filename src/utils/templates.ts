import type { TemplateName, TemplateDefinition, TemplateProviderDefaults } from "../types/index.js";

export const TEMPLATES: Record<TemplateName, TemplateDefinition> = {
  starter: {
    name: "starter",
    description: "Minimal setup for trying out Coolify (cheapest option)",
    defaults: {
      hetzner: { region: "nbg1", size: "cax11" },
      digitalocean: { region: "fra1", size: "s-2vcpu-2gb" },
    },
    fullSetup: false,
  },
  production: {
    name: "production",
    description: "Production-ready setup with firewall and SSH hardening",
    defaults: {
      hetzner: { region: "nbg1", size: "cx33" },
      digitalocean: { region: "fra1", size: "s-2vcpu-4gb" },
    },
    fullSetup: true,
  },
  dev: {
    name: "dev",
    description: "Development/testing environment (cheap, no hardening)",
    defaults: {
      hetzner: { region: "nbg1", size: "cax11" },
      digitalocean: { region: "fra1", size: "s-2vcpu-2gb" },
    },
    fullSetup: false,
  },
};

export const VALID_TEMPLATE_NAMES: TemplateName[] = Object.keys(TEMPLATES) as TemplateName[];

export function getTemplate(name: string): TemplateDefinition | undefined {
  if (VALID_TEMPLATE_NAMES.includes(name as TemplateName)) {
    return TEMPLATES[name as TemplateName];
  }
  return undefined;
}

export function getTemplateDefaults(
  name: string,
  provider: string,
): TemplateProviderDefaults | undefined {
  const template = getTemplate(name);
  if (!template) return undefined;
  return template.defaults[provider];
}

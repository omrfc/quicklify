/**
 * Compliance detail types — per-control check lists, profile mapping.
 * Extends the summary types in scoring.ts with per-check detail.
 */

import type { FrameworkKey } from "./mapper.js";

export type ProfileName = "cis-level1" | "cis-level2" | "pci-dss" | "hipaa";

export const PROFILE_MAP: Record<ProfileName, { framework: FrameworkKey; level?: "L1" | "L2" }> = {
  "cis-level1": { framework: "CIS", level: "L1" },
  "cis-level2": { framework: "CIS" },  // L2 includes L1
  "pci-dss": { framework: "PCI-DSS" },
  "hipaa": { framework: "HIPAA" },
};

/** Map profile/alias strings to FrameworkKey — shared by CLI and MCP */
export const FRAMEWORK_KEY_MAP: Record<string, FrameworkKey> = {
  cis: "CIS",
  "cis-level1": "CIS",
  "cis-level2": "CIS",
  "pci-dss": "PCI-DSS",
  hipaa: "HIPAA",
};

export interface ComplianceControlDetail {
  controlId: string;
  description: string;
  passed: boolean;
  hasPartial: boolean;
  checks: Array<{ id: string; name: string; passed: boolean }>;
}

export interface ComplianceDetailScore {
  framework: FrameworkKey;
  version: string;
  passRate: number;
  totalControls: number;
  passedControls: number;
  partialCount: number;
  controls: ComplianceControlDetail[];
}

/**
 * Crypto security check parser.
 * Parses OpenSSL version, SSH cipher/MAC/KEX config, LUKS disk, TLS protocol,
 * and certificate expiry data into 10 security checks.
 */

import type { AuditCheck, CheckParser, Severity } from "../types.js";

interface CryptoCheckDef {
  id: string;
  name: string;
  severity: Severity;
  check: (output: string) => { passed: boolean; currentValue: string };
  expectedValue: string;
  fixCommand: string;
  explain: string;
}

const WEAK_CIPHERS = ["arcfour", "arcfour128", "arcfour256", "3des-cbc", "blowfish-cbc", "cast128-cbc"];
const WEAK_MACS = ["hmac-md5", "hmac-sha1-96", "umac-64@openssh.com"];
const WEAK_KEX = ["diffie-hellman-group1-sha1", "diffie-hellman-group14-sha1"];

const CRYPTO_CHECKS: CryptoCheckDef[] = [
  {
    id: "CRYPTO-OPENSSL-INSTALLED",
    name: "OpenSSL Installed",
    severity: "info",
    check: (output) => {
      const installed = /OpenSSL\s+\d+\.\d+/i.test(output) && !/NOT_INSTALLED/.test(output);
      return {
        passed: installed,
        currentValue: installed ? output.match(/OpenSSL\s+[\d.a-z]+/i)?.[0] ?? "OpenSSL installed" : "OpenSSL not installed",
      };
    },
    expectedValue: "OpenSSL is installed",
    fixCommand: "apt install openssl -y",
    explain: "OpenSSL provides the cryptographic library used by most services for TLS and certificate operations.",
  },
  {
    id: "CRYPTO-SSH-WEAK-CIPHERS",
    name: "SSH No Weak Ciphers",
    severity: "warning",
    check: (output) => {
      const ciphersLine = output.match(/^ciphers (.+)$/mi)?.[1] ?? "";
      if (!ciphersLine) {
        return { passed: false, currentValue: "SSH cipher configuration not found" };
      }
      const activeCiphers = ciphersLine.split(",").map((s) => s.trim().toLowerCase());
      const weakFound = activeCiphers.filter((c) => WEAK_CIPHERS.some((w) => c.includes(w)));
      return {
        passed: weakFound.length === 0,
        currentValue: weakFound.length > 0 ? `Weak ciphers: ${weakFound.join(", ")}` : "No weak ciphers configured",
      };
    },
    expectedValue: "No arcfour, 3des-cbc, blowfish-cbc, or cast128-cbc ciphers",
    fixCommand: "sed -i '/^Ciphers/d' /etc/ssh/sshd_config && echo 'Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr' >> /etc/ssh/sshd_config && systemctl restart sshd",
    explain: "Weak SSH ciphers (arcfour, 3DES, Blowfish) are vulnerable to known cryptographic attacks including SWEET32 and related attacks.",
  },
  {
    id: "CRYPTO-SSH-WEAK-MACS",
    name: "SSH No Weak MACs",
    severity: "warning",
    check: (output) => {
      const macsLine = output.match(/^macs (.+)$/mi)?.[1] ?? "";
      if (!macsLine) {
        return { passed: false, currentValue: "SSH MAC configuration not found" };
      }
      const activeMacs = macsLine.split(",").map((s) => s.trim().toLowerCase());
      const weakFound = activeMacs.filter((m) => WEAK_MACS.some((w) => m.includes(w)));
      return {
        passed: weakFound.length === 0,
        currentValue: weakFound.length > 0 ? `Weak MACs: ${weakFound.join(", ")}` : "No weak MACs configured",
      };
    },
    expectedValue: "No hmac-md5, hmac-sha1-96, or umac-64 MACs",
    fixCommand: "sed -i '/^MACs/d' /etc/ssh/sshd_config && echo 'MACs hmac-sha2-512,hmac-sha2-256,umac-128@openssh.com' >> /etc/ssh/sshd_config && systemctl restart sshd",
    explain: "Weak SSH MACs like HMAC-MD5 and HMAC-SHA1-96 provide insufficient integrity protection and are vulnerable to collision attacks.",
  },
  {
    id: "CRYPTO-SSH-WEAK-KEX",
    name: "SSH No Weak Key Exchange",
    severity: "warning",
    check: (output) => {
      const kexLine = output.match(/^kexalgorithms (.+)$/mi)?.[1] ?? "";
      if (!kexLine) {
        return { passed: false, currentValue: "SSH KEX configuration not found" };
      }
      const activeKex = kexLine.split(",").map((s) => s.trim().toLowerCase());
      const weakFound = activeKex.filter((k) => WEAK_KEX.some((w) => k.includes(w)));
      return {
        passed: weakFound.length === 0,
        currentValue: weakFound.length > 0 ? `Weak KEX: ${weakFound.join(", ")}` : "No weak KEX algorithms",
      };
    },
    expectedValue: "No diffie-hellman-group1-sha1 or diffie-hellman-group14-sha1",
    fixCommand: "sed -i '/^KexAlgorithms/d' /etc/ssh/sshd_config && echo 'KexAlgorithms curve25519-sha256,ecdh-sha2-nistp521,ecdh-sha2-nistp384,ecdh-sha2-nistp256' >> /etc/ssh/sshd_config && systemctl restart sshd",
    explain: "Weak Diffie-Hellman group1 and group14 key exchanges are susceptible to Logjam attack, allowing MitM decryption of SSH sessions.",
  },
  {
    id: "CRYPTO-SSH-ED25519-KEY",
    name: "SSH ED25519 Host Key Present",
    severity: "info",
    check: (output) => {
      const hasEd25519 = /ssh_host_ed25519_key/.test(output);
      return {
        passed: hasEd25519,
        currentValue: hasEd25519 ? "ED25519 host key present" : "ED25519 host key not found",
      };
    },
    expectedValue: "ssh_host_ed25519_key exists in /etc/ssh/",
    fixCommand: "ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N '' && systemctl restart sshd",
    explain: "ED25519 host keys use modern elliptic curve cryptography offering stronger security and better performance than RSA keys.",
  },
  {
    id: "CRYPTO-LUKS-DISK",
    name: "Disk Encryption (LUKS) Present",
    severity: "info",
    check: (output) => {
      const hasLuks = /crypto_luks/i.test(output) && !/NO_LUKS/.test(output);
      return {
        passed: hasLuks,
        currentValue: hasLuks ? "LUKS disk encryption detected" : "No LUKS encrypted volumes found",
      };
    },
    expectedValue: "At least one LUKS-encrypted disk volume present",
    fixCommand: "cryptsetup luksFormat /dev/sdX # Encrypt disk partition with LUKS (DESTRUCTIVE — backup data first)",
    explain: "LUKS disk encryption protects data at rest against physical theft or unauthorized access to storage media.",
  },
  {
    id: "CRYPTO-TLS-MIN-PROTOCOL",
    name: "TLS Minimum Protocol Version",
    severity: "warning",
    check: (output) => {
      const minProtoMatch = output.match(/MinProtocol\s*=\s*(TLSv[\d.]+)/i);
      if (!minProtoMatch) {
        // If no TLS ports active, not applicable
        if (/NO_TLS_PORTS/.test(output)) {
          return { passed: false, currentValue: "TLS ports active but MinProtocol not configured" };
        }
        return { passed: false, currentValue: "MinProtocol not configured in openssl.cnf" };
      }
      const proto = minProtoMatch[1];
      const passed = proto === "TLSv1.2" || proto === "TLSv1.3";
      return {
        passed,
        currentValue: passed ? `MinProtocol = ${proto}` : `MinProtocol = ${proto} (too low)`,
      };
    },
    expectedValue: "MinProtocol = TLSv1.2 or TLSv1.3 in /etc/ssl/openssl.cnf",
    fixCommand: "grep -q 'MinProtocol' /etc/ssl/openssl.cnf && sed -i 's/MinProtocol.*/MinProtocol = TLSv1.2/' /etc/ssl/openssl.cnf || echo 'MinProtocol = TLSv1.2' >> /etc/ssl/openssl.cnf",
    explain: "Setting a minimum TLS protocol version prevents clients from negotiating insecure TLS 1.0 or 1.1 connections.",
  },
  {
    id: "CRYPTO-CERT-NOT-EXPIRED",
    name: "TLS Certificate Not Expired",
    severity: "warning",
    check: (output) => {
      // If no TLS ports detected, not applicable (pass)
      if (/NO_TLS_PORTS/.test(output)) {
        return { passed: true, currentValue: "No HTTPS ports active (not applicable)" };
      }
      const endDateMatch = output.match(/notAfter=(.+)/i);
      if (!endDateMatch) {
        // cert section returned N/A (no HTTPS despite port detection)
        if (/^N\/A$/m.test(output)) {
          return { passed: true, currentValue: "Certificate check not applicable" };
        }
        return { passed: false, currentValue: "Could not determine certificate expiry" };
      }
      const endDateStr = endDateMatch[1].trim();
      const endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return { passed: false, currentValue: `Unparseable cert date: ${endDateStr}` };
      }
      const now = new Date();
      const passed = endDate > now;
      return {
        passed,
        currentValue: passed
          ? `Certificate valid until ${endDateStr}`
          : `Certificate EXPIRED on ${endDateStr}`,
      };
    },
    expectedValue: "TLS certificate enddate is in the future",
    fixCommand: "certbot renew # Renew Let's Encrypt certificate, or replace with valid certificate",
    explain: "Expired TLS certificates cause browser warnings and trust errors, disrupting service and indicating poor certificate lifecycle management.",
  },
  {
    id: "CRYPTO-NO-SSLV3",
    name: "SSLv3 Disabled",
    severity: "warning",
    check: (output) => {
      // Look for SSLv3 being explicitly enabled in openssl.cnf
      const sslv3Enabled = /Protocol\s*=\s*.*SSLv3/i.test(output);
      return {
        passed: !sslv3Enabled,
        currentValue: sslv3Enabled ? "SSLv3 appears enabled in openssl.cnf" : "SSLv3 not enabled",
      };
    },
    expectedValue: "SSLv3 not enabled in openssl.cnf",
    fixCommand: "grep -q 'Protocol' /etc/ssl/openssl.cnf && sed -i '/SSLv3/d' /etc/ssl/openssl.cnf",
    explain: "SSLv3 is vulnerable to the POODLE attack which allows an attacker to decrypt encrypted communications in an active MitM scenario.",
  },
  {
    id: "CRYPTO-OPENSSL-MODERN",
    name: "OpenSSL Modern Version",
    severity: "info",
    check: (output) => {
      if (/NOT_INSTALLED/.test(output)) {
        return { passed: false, currentValue: "OpenSSL not installed" };
      }
      const versionMatch = output.match(/OpenSSL\s+([\d.]+)/i);
      if (!versionMatch) {
        return { passed: false, currentValue: "OpenSSL version not detected" };
      }
      const version = versionMatch[1];
      const isModern = version.startsWith("3.") || version.startsWith("1.1.");
      const isLegacy = version.startsWith("1.0.") || version.startsWith("0.9.");
      return {
        passed: isModern && !isLegacy,
        currentValue: `OpenSSL ${version}`,
      };
    },
    expectedValue: "OpenSSL 3.x or 1.1.x (not 1.0.x or older)",
    fixCommand: "apt update && apt install --only-upgrade openssl -y",
    explain: "OpenSSL 1.0.x and earlier have known vulnerabilities including Heartbleed (1.0.1) and lack modern cipher support.",
  },
];

export const parseCryptoChecks: CheckParser = (
  sectionOutput: string,
  _platform: string,
): AuditCheck[] => {
  const isNA =
    !sectionOutput ||
    sectionOutput.trim() === "N/A" ||
    sectionOutput.trim() === "";
  const output = isNA ? "" : sectionOutput;

  return CRYPTO_CHECKS.map((def) => {
    if (isNA) {
      return {
        id: def.id,
        category: "Crypto",
        name: def.name,
        severity: def.severity,
        passed: false,
        currentValue: "Unable to determine",
        expectedValue: def.expectedValue,
        fixCommand: def.fixCommand,
        explain: def.explain,
      };
    }
    const { passed, currentValue } = def.check(output);
    return {
      id: def.id,
      category: "Crypto",
      name: def.name,
      severity: def.severity,
      passed,
      currentValue,
      expectedValue: def.expectedValue,
      fixCommand: def.fixCommand,
      explain: def.explain,
    };
  });
};

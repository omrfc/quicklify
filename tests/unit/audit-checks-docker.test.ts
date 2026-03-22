import { parseDockerChecks } from "../../src/core/audit/checks/docker.js";

// ─── Shared fixtures (module scope for use across all describe blocks) ────────

const secureDockerOutput = [
  // docker info json (no TCP socket, user namespace enabled, live-restore)
  '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":["name=userns","name=seccomp,profile=default","name=apparmor"],"LoggingDriver":"json-file","LiveRestoreEnabled":true}',
  // daemon.json between sentinels (parser requires these exact sentinels)
  "---DAEMON_JSON---",
  '{"log-driver":"json-file","userns-remap":"default","live-restore":true,"icc":false,"log-opts":{"max-size":"10m","max-file":"3"},"default-ulimits":{"nofile":{"Name":"nofile","Hard":64000,"Soft":64000}}}',
  "---END_DAEMON_JSON---",
  // docker ps output (no privileged, no host network)
  "myapp nginx:latest Up 2 hours",
  "db postgres:15 Up 2 hours",
  // docker socket permissions
  "srw-rw---- 1 root docker 0 Mar  1 10:00 /var/run/docker.sock",
  // container inspect output (SecurityOpt=seccomp apparmor, ReadonlyRootfs=true, User=appuser, Privileged=false)
  "/myapp SecurityOpt=[seccomp:default apparmor:docker-default] ReadonlyRootfs=true User=appuser Privileged=false",
  "/db SecurityOpt=[seccomp:default apparmor:docker-default] ReadonlyRootfs=true User=postgres Privileged=false",
  // DOCKER_CONTENT_TRUST
  "DOCKER_CONTENT_TRUST=1",
  // docker.sock stat (660 root docker)
  "660 root docker",
  // docker network ls (custom network present — not just defaults)
  "app-network bridge",
  // docker volume ls (named volume)
  "myapp_data local",
  // docker info security options (userns enabled — DCK-26..32 data)
  "[name=userns name=seccomp name=apparmor]",
  // bridge network inspect — ICC disabled (DCK-BRIDGE-NFCALL)
  '{"com.docker.network.bridge.enable_icc":"false","com.docker.network.bridge.enable_ip_masquerade":"true"}',
  // authorization plugins — none (DCK-AUTH-PLUGIN)
  "[]",
  // registry certs dir — certs exist (DCK-REGISTRY-CERTS)
  "/etc/docker/certs.d/registry.example.com",
  // insecure registry CIDRs — only loopback (DCK-NO-INSECURE-REGISTRY)
  "[127.0.0.0/8]",
  // swarm state — inactive (DCK-SWARM-INACTIVE)
  "inactive",
  // experimental build — false (DCK-NO-EXPERIMENTAL)
  "false",
].join("\n");

const insecureDockerOutput = [
  // TCP socket exposed, old version, no security options, no logging
  '{"Hosts":["unix:///var/run/docker.sock","tcp://0.0.0.0:2375"],"ServerVersion":"20.10.7","SecurityOptions":[],"LoggingDriver":"none"}',
  // daemon.json sentinels with empty/no-hardening config
  "---DAEMON_JSON---",
  "{}",
  "---END_DAEMON_JSON---",
  // docker ps — one running container
  "myapp nginx:latest Up 2 hours",
  // bad docker socket permissions (rw for others)
  "srw-rw-rw- 1 root root 0 Mar  1 10:00 /var/run/docker.sock",
  // container inspect: no SecurityOpt, not read-only, empty User (root), Privileged=true
  // Note: --privileged flag triggers DCK-NO-PRIVILEGED; User="" triggers DCK-NO-ROOT-CONTAINERS
  '/myapp SecurityOpt=[] ReadonlyRootfs=false User="" Privileged=true --privileged',
  // content trust not set
  "DOCKER_CONTENT_TRUST=unset",
  // socket stat (660 root root — wrong group)
  "660 root root",
].join("\n");

describe("parseDockerChecks", () => {
  it("should return 32 checks for secure Docker setup", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    expect(checks).toHaveLength(32);
    checks.forEach((check) => {
      expect(check.category).toBe("Docker");
      expect(check.id).toMatch(/^DCK-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)+$/);
    });
  });

  it("should return DCK-NO-TCP-SOCKET passed when no TCP socket exposed", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const dck01 = checks.find((c) => c.id === "DCK-NO-TCP-SOCKET");
    expect(dck01!.passed).toBe(true);
  });

  it("should return DCK-NO-TCP-SOCKET failed when TCP socket exposed", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const dck01 = checks.find((c) => c.id === "DCK-NO-TCP-SOCKET");
    expect(dck01!.passed).toBe(false);
    expect(dck01!.severity).toBe("critical");
  });

  it("should return 32 checks as info/skipped when Docker not installed (N/A)", () => {
    const checks = parseDockerChecks("N/A", "bare");
    expect(checks).toHaveLength(32);
    checks.forEach((check) => {
      expect(check.severity).toBe("info");
      expect(check.currentValue).toContain("Docker not installed");
    });
  });

  it("should return 32 checks as info/skipped for empty output on bare platform", () => {
    const checks = parseDockerChecks("", "bare");
    expect(checks).toHaveLength(32);
    checks.forEach((check) => {
      expect(check.severity).toBe("info");
    });
  });

  it("should handle coolify platform (Docker expected)", () => {
    const checks = parseDockerChecks("N/A", "coolify");
    expect(checks).toHaveLength(32);
    // On coolify, Docker missing is a warning not info
    const dck01 = checks.find((c) => c.id === "DCK-NO-TCP-SOCKET");
    expect(dck01!.severity).toBe("warning");
  });

  it("should handle dokploy platform (Docker expected)", () => {
    const checks = parseDockerChecks("N/A", "dokploy");
    expect(checks).toHaveLength(32);
    const dck01 = checks.find((c) => c.id === "DCK-NO-TCP-SOCKET");
    expect(dck01!.severity).toBe("warning");
  });

  it("should return DCK-LIVE-RESTORE passed when daemon.json has live-restore true", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const dck07 = checks.find((c) => c.id === "DCK-LIVE-RESTORE");
    expect(dck07!.passed).toBe(true);
    expect(dck07!.severity).toBe("warning");
  });

  it("should return DCK-TLS-VERIFY passed when no TCP socket exposed", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const dck10 = checks.find((c) => c.id === "DCK-TLS-VERIFY");
    expect(dck10!.passed).toBe(true);
    expect(dck10!.severity).toBe("critical");
  });

  it("should return DCK-TLS-VERIFY failed when TCP socket exposed without TLS", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const dck10 = checks.find((c) => c.id === "DCK-TLS-VERIFY");
    expect(dck10!.passed).toBe(false);
  });

  it("should return DCK-NO-ROOT-CONTAINERS passed when no running containers", () => {
    const checks = parseDockerChecks("N/A", "bare");
    const dck12 = checks.find((c) => c.id === "DCK-NO-ROOT-CONTAINERS");
    expect(dck12!.passed).toBe(true);
    expect(dck12!.currentValue).toContain("Docker not installed");
  });

  it("should return DCK-SECCOMP-ENABLED passed when no running containers", () => {
    const checks = parseDockerChecks("N/A", "bare");
    const dck16 = checks.find((c) => c.id === "DCK-SECCOMP-ENABLED");
    expect(dck16!.passed).toBe(true);
  });

  it("should return DCK-CONTENT-TRUST passed when DOCKER_CONTENT_TRUST=1", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const dck17 = checks.find((c) => c.id === "DCK-CONTENT-TRUST");
    expect(dck17!.passed).toBe(true);
  });

  it("should return DCK-CONTENT-TRUST failed when content trust not enabled", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const dck17 = checks.find((c) => c.id === "DCK-CONTENT-TRUST");
    expect(dck17!.passed).toBe(false);
  });

  it("DCK-LOG-DRIVER-CONFIGURED passes when LoggingDriver is json-file", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-LOG-DRIVER-CONFIGURED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("DCK-LOG-DRIVER-CONFIGURED fails when LoggingDriver is none", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-LOG-DRIVER-CONFIGURED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("DCK-NETWORK-DISABLED passes when Docker not installed", () => {
    const checks = parseDockerChecks("N/A", "bare");
    const check = checks.find((c) => c.id === "DCK-NETWORK-DISABLED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("DCK-BRIDGE-NFCALL passes when ICC is disabled on bridge network", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-BRIDGE-NFCALL");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-BRIDGE-NFCALL fails when ICC is enabled on bridge network", () => {
    const iccOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "N/A",
      "N/A",
      "N/A",
      '{"com.docker.network.bridge.enable_icc":"true"}',
    ].join("\n");
    const checks = parseDockerChecks(iccOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-BRIDGE-NFCALL");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("ICC enabled");
  });

  it("DCK-NO-INSECURE-REGISTRY passes when only loopback CIDR configured", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-INSECURE-REGISTRY");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-NO-EXPERIMENTAL passes when experimental features disabled", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-EXPERIMENTAL");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-NO-EXPERIMENTAL fails when experimental features enabled", () => {
    const experimentalOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "[127.0.0.0/8]",
      "inactive",
      "true",
    ].join("\n");
    const checks = parseDockerChecks(experimentalOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-EXPERIMENTAL");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("Experimental features enabled");
  });

  it("DCK-SWARM-INACTIVE passes when swarm is inactive", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SWARM-INACTIVE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-PID-MODE passes when no running containers use host PID namespace", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-PID-MODE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-PID-MODE fails when a container uses host PID namespace", () => {
    const pidOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "myapp nginx:latest Up 2 hours",
      "srw-rw---- 1 root docker 0 Mar  1 10:00 /var/run/docker.sock",
      '/myapp SecurityOpt=[] "PidMode":"host" ReadonlyRootfs=false User= Privileged=false',
    ].join("\n");
    const checks = parseDockerChecks(pidOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-PID-MODE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("host PID");
  });
});

// ─── Skipped checks (Docker not installed) — exact value assertions ───────────

describe("parseDockerChecks — Docker not installed (skipped checks)", () => {
  it("all 32 skipped checks on bare have passed=true", () => {
    const checks = parseDockerChecks("N/A", "bare");
    expect(checks).toHaveLength(32);
    checks.forEach((c) => expect(c.passed).toBe(true));
  });

  it("all 32 skipped checks on coolify/dokploy have passed=false", () => {
    const coolifyChecks = parseDockerChecks("N/A", "coolify");
    expect(coolifyChecks).toHaveLength(32);
    coolifyChecks.forEach((c) => expect(c.passed).toBe(false));

    const dokployChecks = parseDockerChecks("N/A", "dokploy");
    expect(dokployChecks).toHaveLength(32);
    dokployChecks.forEach((c) => expect(c.passed).toBe(false));
  });

  it("skipped checks on bare have severity='info' (not 'warning' or 'critical')", () => {
    const checks = parseDockerChecks("N/A", "bare");
    checks.forEach((c) => expect(c.severity).toBe("info"));
  });

  it("skipped checks on coolify have severity='warning' (not 'info' or 'critical')", () => {
    const checks = parseDockerChecks("N/A", "coolify");
    checks.forEach((c) => expect(c.severity).toBe("warning"));
  });

  it("all skipped checks have currentValue='Docker not installed' (exact string)", () => {
    const checks = parseDockerChecks("N/A", "bare");
    checks.forEach((c) => expect(c.currentValue).toBe("Docker not installed"));
  });

  it("all skipped checks have expectedValue containing 'Docker installed'", () => {
    const checks = parseDockerChecks("N/A", "bare");
    checks.forEach((c) => expect(c.expectedValue).toContain("Docker installed"));
  });

  it("all skipped checks have category='Docker' (not 'docker' or other)", () => {
    const checks = parseDockerChecks("N/A", "bare");
    checks.forEach((c) => expect(c.category).toBe("Docker"));
  });
});

// ─── Privileged container detection ──────────────────────────────────────────

describe("parseDockerChecks — privileged container detection", () => {
  it("DCK-NO-PRIVILEGED fails when Privileged=true in inspect output", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-PRIVILEGED");
    expect(check!.passed).toBe(false);
    expect(check!.severity).toBe("critical");
    expect(check!.currentValue).toContain("Privileged");
  });

  it("DCK-NO-PRIVILEGED passes when all containers have Privileged=false", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-PRIVILEGED");
    expect(check!.passed).toBe(true);
  });

  it("DCK-NO-SENSITIVE-MOUNTS fails when Privileged=true in inspect output", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-SENSITIVE-MOUNTS");
    expect(check!.passed).toBe(false);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-NO-SENSITIVE-MOUNTS passes when all Privileged=false", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-SENSITIVE-MOUNTS");
    expect(check!.passed).toBe(true);
  });
});

// ─── Version check ────────────────────────────────────────────────────────────

describe("parseDockerChecks — version currency", () => {
  it("DCK-VERSION-CURRENT passes for version 24.0.7", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-VERSION-CURRENT");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
    expect(check!.currentValue).toContain("24.0.7");
  });

  it("DCK-VERSION-CURRENT fails for version 20.10.7 (below 24)", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-VERSION-CURRENT");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("20.10.7");
  });

  it("DCK-VERSION-CURRENT expectedValue is 'Docker 24.0+'", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-VERSION-CURRENT");
    expect(check!.expectedValue).toBe("Docker 24.0+");
  });
});

// ─── Socket permissions ───────────────────────────────────────────────────────

describe("parseDockerChecks — socket permissions", () => {
  it("DCK-SOCKET-PERMS passes when permissions are '660 root docker'", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SOCKET-PERMS");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
    expect(check!.expectedValue).toBe("660 root docker");
  });

  it("DCK-SOCKET-PERMS fails when group is not docker", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SOCKET-PERMS");
    // insecureDockerOutput has "660 root root" not "660 root docker"
    expect(check!.passed).toBe(false);
  });
});

// ─── User namespace / rootless ────────────────────────────────────────────────

describe("parseDockerChecks — user namespace", () => {
  it("DCK-USER-NAMESPACE passes when SecurityOptions includes userns", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-USER-NAMESPACE");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-USER-NAMESPACE fails when SecurityOptions is empty", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-USER-NAMESPACE");
    expect(check!.passed).toBe(false);
  });
});

// ─── Seccomp and AppArmor ─────────────────────────────────────────────────────

describe("parseDockerChecks — seccomp and AppArmor profiles", () => {
  it("DCK-SECCOMP-ENABLED passes when containers have seccomp in SecurityOpt", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SECCOMP-ENABLED");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-SECCOMP-ENABLED fails when SecurityOpt is empty for running containers", () => {
    const noSeccompOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "myapp nginx:latest Up 2 hours",
      "N/A",
      "/myapp SecurityOpt=[] ReadonlyRootfs=false User=appuser Privileged=false",
    ].join("\n");
    const checks = parseDockerChecks(noSeccompOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SECCOMP-ENABLED");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("No seccomp");
  });

  it("DCK-APPARMOR-PROFILE passes when containers have apparmor in SecurityOpt", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-APPARMOR-PROFILE");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });
});

// ─── ICC / host network ───────────────────────────────────────────────────────

describe("parseDockerChecks — ICC and host network", () => {
  it("DCK-ICC-DISABLED passes when daemon.json has icc=false", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-ICC-DISABLED");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });

  it("DCK-ICC-DISABLED fails when icc is not false in daemon.json", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-ICC-DISABLED");
    expect(check!.passed).toBe(false);
  });

  it("DCK-NO-HOST-NETWORK passes when no host network containers present", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-HOST-NETWORK");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("warning");
  });
});

// ─── Log configuration ────────────────────────────────────────────────────────

describe("parseDockerChecks — log configuration", () => {
  it("DCK-LOG-MAX-SIZE passes when daemon.json has log-opts max-size", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-LOG-MAX-SIZE");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-LOG-MAX-SIZE fails when no log-opts in daemon.json", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-LOG-MAX-SIZE");
    expect(check!.passed).toBe(false);
  });

  it("DCK-DEFAULT-ULIMITS passes when daemon.json has default-ulimits", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-DEFAULT-ULIMITS");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-DEFAULT-ULIMITS fails when no default-ulimits in daemon.json", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-DEFAULT-ULIMITS");
    expect(check!.passed).toBe(false);
  });

  it("DCK-LOGGING-DRIVER passes for json-file driver", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-LOGGING-DRIVER");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
    expect(check!.currentValue).toContain("json-file");
  });
});

// ─── Read-only rootfs and root containers ────────────────────────────────────

describe("parseDockerChecks — container isolation", () => {
  it("DCK-READ-ONLY-ROOTFS passes when all containers have ReadonlyRootfs=true", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-READ-ONLY-ROOTFS");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-READ-ONLY-ROOTFS fails when a container has ReadonlyRootfs=false", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-READ-ONLY-ROOTFS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("writable");
  });

  it("DCK-NO-ROOT-CONTAINERS fails when User= is empty (root)", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-ROOT-CONTAINERS");
    expect(check!.passed).toBe(false);
    expect(check!.severity).toBe("warning");
    expect(check!.currentValue).toContain("root");
  });

  it("DCK-NO-ROOT-CONTAINERS passes when all containers have non-root User", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-ROOT-CONTAINERS");
    expect(check!.passed).toBe(true);
  });
});

// ─── Registry and swarm ───────────────────────────────────────────────────────

describe("parseDockerChecks — registry and swarm", () => {
  it("DCK-NO-INSECURE-REGISTRY fails when insecure-registry is in output", () => {
    // Parser looks for lines containing 'InsecureRegistryCIDRs' or 'insecure-registry'
    const insecureRegistryOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "---DAEMON_JSON---",
      '{"insecure-registry":["192.168.1.0/24"]}',
      "---END_DAEMON_JSON---",
      "N/A",
      "N/A",
      "InsecureRegistryCIDRs=[192.168.1.0/24]",
    ].join("\n");
    const checks = parseDockerChecks(insecureRegistryOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-NO-INSECURE-REGISTRY");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("Insecure");
  });

  it("DCK-SWARM-INACTIVE fails when swarm state is 'active'", () => {
    const swarmActiveOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "[127.0.0.0/8]",
      "active",
      "false",
    ].join("\n");
    const checks = parseDockerChecks(swarmActiveOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-SWARM-INACTIVE");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("Swarm mode active");
  });

  it("DCK-REGISTRY-CERTS passes when /etc/docker/certs.d/ is present with content", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-REGISTRY-CERTS");
    expect(check!.passed).toBe(true);
    expect(check!.severity).toBe("info");
  });

  it("DCK-REGISTRY-CERTS fails when NO_CERTS_DIR is in output", () => {
    const noCertsOutput = [
      '{"Hosts":["unix:///var/run/docker.sock"],"ServerVersion":"24.0.7","SecurityOptions":[],"LoggingDriver":"json-file"}',
      "{}",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "NO_CERTS_DIR",
    ].join("\n");
    const checks = parseDockerChecks(noCertsOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-REGISTRY-CERTS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toContain("No registry TLS certificates");
  });
});

// ─── Content trust exact string assertions ────────────────────────────────────

describe("parseDockerChecks — content trust exact values", () => {
  it("DCK-CONTENT-TRUST currentValue is exactly 'DOCKER_CONTENT_TRUST=1' when enabled", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-CONTENT-TRUST");
    expect(check!.currentValue).toBe("DOCKER_CONTENT_TRUST=1");
  });

  it("DCK-CONTENT-TRUST currentValue contains 'Content trust not enabled' when disabled", () => {
    const checks = parseDockerChecks(insecureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-CONTENT-TRUST");
    expect(check!.currentValue).toContain("Content trust not enabled");
  });

  it("DCK-CONTENT-TRUST severity is exactly 'info'", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const check = checks.find((c) => c.id === "DCK-CONTENT-TRUST");
    expect(check!.severity).toBe("info");
  });
});

// ─── All checks have required fields ─────────────────────────────────────────

describe("parseDockerChecks — all checks have required fields", () => {
  it("every check from secure setup has all required fields", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    checks.forEach((c) => {
      expect(typeof c.id).toBe("string");
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.category).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(["info", "warning", "critical"]).toContain(c.severity);
      expect(typeof c.passed).toBe("boolean");
      expect(typeof c.currentValue).toBe("string");
      expect(typeof c.expectedValue).toBe("string");
    });
  });

  it("every check from N/A (skipped) has all required fields", () => {
    const checks = parseDockerChecks("N/A", "bare");
    checks.forEach((c) => {
      expect(typeof c.id).toBe("string");
      expect(["info", "warning", "critical"]).toContain(c.severity);
      expect(typeof c.passed).toBe("boolean");
      expect(typeof c.currentValue).toBe("string");
    });
  });

  it("all check IDs are unique", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    const ids = checks.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every check severity is exactly 'info', 'warning', or 'critical' — never 'error' or other", () => {
    const checks = parseDockerChecks(secureDockerOutput, "bare");
    checks.forEach((c) => {
      expect(["info", "warning", "critical"]).toContain(c.severity);
    });
  });
});

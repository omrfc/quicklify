import {
  shellEscape,
  cmd,
  raw,
  and,
  pipe,
  or,
  seq,
  subshell,
  buildCommandString,
} from "../../src/utils/sshCommand";
import type { SshCommand } from "../../src/utils/sshCommand";

describe("sshCommand builder", () => {
  // ─── shellEscape ──────────────────────────────────────────────────────────

  describe("shellEscape", () => {
    it("passes through safe strings without quoting", () => {
      expect(shellEscape("apt-get")).toBe("apt-get");
      expect(shellEscape("install")).toBe("install");
      expect(shellEscape("ufw")).toBe("ufw");
      expect(shellEscape("/etc/ssh/sshd_config")).toBe("/etc/ssh/sshd_config");
      expect(shellEscape("root@1.2.3.4")).toBe("root@1.2.3.4");
      expect(shellEscape("22")).toBe("22");
      expect(shellEscape("tcp")).toBe("tcp");
    });

    it("wraps strings with spaces in single quotes", () => {
      expect(shellEscape("hello world")).toBe("'hello world'");
      expect(shellEscape("foo bar baz")).toBe("'foo bar baz'");
    });

    it("escapes embedded single quotes using POSIX idiom", () => {
      expect(shellEscape("it's")).toBe("'it'\\''s'");
      expect(shellEscape("don't stop")).toBe("'don'\\''t stop'");
    });

    it("wraps empty string in single quotes", () => {
      expect(shellEscape("")).toBe("''");
    });

    it("wraps strings with shell metacharacters", () => {
      expect(shellEscape("$(whoami)")).toBe("'$(whoami)'");
      expect(shellEscape("; rm -rf /")).toBe("'; rm -rf /'");
      expect(shellEscape("| cat /etc/passwd")).toBe("'| cat /etc/passwd'");
      expect(shellEscape("`id`")).toBe("'`id`'");
      expect(shellEscape("${HOME}")).toBe("'${HOME}'");
      expect(shellEscape("&&echo hi")).toBe("'&&echo hi'");
    });

    it("wraps strings with newlines and other control chars", () => {
      expect(shellEscape("hello\nworld")).toBe("'hello\nworld'");
    });
  });

  // ─── cmd ─────────────────────────────────────────────────────────────────

  describe("cmd", () => {
    it("builds a simple command with safe args", () => {
      expect(cmd("ufw", "allow", "22/tcp")).toBe("ufw allow 22/tcp");
    });

    it("builds apt-get install command", () => {
      expect(cmd("apt-get", "install", "-y", "ufw")).toBe("apt-get install -y ufw");
    });

    it("escapes dangerous argument: command substitution", () => {
      expect(cmd("echo", "$(rm -rf /)")).toBe("echo '$(rm -rf /)'");
    });

    it("escapes dangerous argument: command chaining", () => {
      expect(cmd("echo", "; rm -rf /")).toBe("echo '; rm -rf /'");
    });

    it("escapes dangerous argument: backtick injection", () => {
      expect(cmd("echo", "`whoami`")).toBe("echo '`whoami`'");
    });

    it("escapes dangerous argument: env var expansion", () => {
      expect(cmd("echo", "${PATH}")).toBe("echo '${PATH}'");
    });

    it("builds command with single argument", () => {
      expect(cmd("uptime")).toBe("uptime");
    });

    it("builds command with many arguments", () => {
      expect(cmd("sed", "-i", "s/foo/bar/g", "/etc/file.conf")).toBe(
        "sed -i s/foo/bar/g /etc/file.conf",
      );
    });

    it("produces a branded SshCommand (still a string)", () => {
      const result = cmd("echo", "hello");
      expect(typeof result).toBe("string");
      expect(result).toBe("echo hello");
    });

    it("handles zero arguments (just the program)", () => {
      expect(cmd("ls")).toBe("ls");
    });
  });

  // ─── raw ─────────────────────────────────────────────────────────────────

  describe("raw", () => {
    it("passes the string through verbatim", () => {
      const input = "sshd -T 2>/dev/null || cat /etc/ssh/sshd_config";
      expect(raw(input)).toBe(input);
    });

    it("returns the string unchanged even with special chars", () => {
      const heredoc = "cat <<'EOF' > /tmp/test.sh\necho hi\nEOF";
      expect(raw(heredoc)).toBe(heredoc);
    });

    it("produces a branded SshCommand (still a string)", () => {
      const result = raw("uptime");
      expect(typeof result).toBe("string");
      expect(result).toBe("uptime");
    });
  });

  // ─── and ─────────────────────────────────────────────────────────────────

  describe("and", () => {
    it("joins two commands with &&", () => {
      const c1 = cmd("apt-get", "install", "-y", "ufw");
      const c2 = cmd("ufw", "enable");
      expect(and(c1, c2)).toBe("apt-get install -y ufw && ufw enable");
    });

    it("joins three commands with &&", () => {
      const c1 = cmd("step1");
      const c2 = cmd("step2");
      const c3 = cmd("step3");
      expect(and(c1, c2, c3)).toBe("step1 && step2 && step3");
    });

    it("joins a single command (no separator)", () => {
      const c = cmd("uptime");
      expect(and(c)).toBe("uptime");
    });
  });

  // ─── pipe ─────────────────────────────────────────────────────────────────

  describe("pipe", () => {
    it("joins two commands with |", () => {
      const c1 = cmd("echo", "y");
      const c2 = cmd("ufw", "enable");
      expect(pipe(c1, c2)).toBe("echo y | ufw enable");
    });

    it("joins three commands with |", () => {
      const c1 = raw("cat /etc/passwd");
      const c2 = cmd("grep", "root");
      const c3 = cmd("head", "-1");
      expect(pipe(c1, c2, c3)).toBe("cat /etc/passwd | grep root | head -1");
    });
  });

  // ─── or ──────────────────────────────────────────────────────────────────

  describe("or", () => {
    it("joins two commands with ||", () => {
      const c1 = cmd("systemctl", "restart", "sshd");
      const c2 = cmd("systemctl", "restart", "ssh");
      expect(or(c1, c2)).toBe("systemctl restart sshd || systemctl restart ssh");
    });
  });

  // ─── seq ─────────────────────────────────────────────────────────────────

  describe("seq", () => {
    it("joins two commands with ;", () => {
      const c1 = cmd("echo", "a");
      const c2 = cmd("echo", "b");
      expect(seq(c1, c2)).toBe("echo a ; echo b");
    });
  });

  // ─── subshell ────────────────────────────────────────────────────────────

  describe("subshell", () => {
    it("wraps command in parentheses", () => {
      const c = and(cmd("echo", "a"), cmd("echo", "b"));
      expect(subshell(c)).toBe("( echo a && echo b )");
    });
  });

  // ─── buildCommandString ───────────────────────────────────────────────────

  describe("buildCommandString", () => {
    it("extracts the string from an SshCommand", () => {
      const c = cmd("uptime");
      expect(buildCommandString(c)).toBe("uptime");
    });

    it("works with and() result", () => {
      const c = and(cmd("a"), cmd("b"));
      expect(buildCommandString(c)).toBe("a && b");
    });
  });

  // ─── Real-world command tests ─────────────────────────────────────────────

  describe("real-world commands", () => {
    it("builds ufw allow port command correctly", () => {
      expect(cmd("ufw", "allow", "443/tcp")).toBe("ufw allow 443/tcp");
    });

    it("builds systemctl restart with fallback", () => {
      const c = or(
        cmd("systemctl", "restart", "sshd"),
        cmd("systemctl", "restart", "ssh"),
      );
      expect(c).toBe("systemctl restart sshd || systemctl restart ssh");
    });

    it("builds apt-get install chain", () => {
      const c = and(
        cmd("apt-get", "install", "-y", "fail2ban", "python3-systemd"),
        cmd("systemctl", "enable", "fail2ban"),
        cmd("systemctl", "restart", "fail2ban"),
      );
      expect(c).toBe(
        "apt-get install -y fail2ban python3-systemd && systemctl enable fail2ban && systemctl restart fail2ban",
      );
    });

    it("builds docker logs command with safe line count", () => {
      expect(cmd("docker", "logs", "coolify", "--tail", "100")).toBe(
        "docker logs coolify --tail 100",
      );
    });

    it("builds dig DNS lookup command", () => {
      expect(cmd("dig", "+short", "A", "example.com")).toBe("dig +short A example.com");
    });

    it("injection test: $(whoami) is prevented in cmd args", () => {
      const result = cmd("echo", "$(whoami)");
      // Shell-quoting prevents expansion: the literal string $(whoami) is passed, not executed
      expect(result).toBe("echo '$(whoami)'");
      // The result must start with a single quote to prevent shell expansion
      expect(result).toContain("'$(whoami)'");
    });

    it("injection test: backtick command substitution is prevented", () => {
      const result = cmd("echo", "`id`");
      expect(result).toBe("echo '`id`'");
    });

    it("injection test: semicolon chaining is prevented", () => {
      const result = cmd("echo", "; cat /etc/passwd");
      expect(result).toBe("echo '; cat /etc/passwd'");
    });

    it("injection test: pipe injection is prevented", () => {
      const result = cmd("echo", "| cat /etc/shadow");
      expect(result).toBe("echo '| cat /etc/shadow'");
    });

    it("injection test: env var expansion is prevented", () => {
      const result = cmd("echo", "${HOME}");
      expect(result).toBe("echo '${HOME}'");
    });
  });

  // ─── Type compatibility ───────────────────────────────────────────────────

  describe("type compatibility", () => {
    it("SshCommand is assignable to string (branded string pattern)", () => {
      const c: SshCommand = cmd("echo", "hello");
      const s: string = c; // should compile
      expect(s).toBe("echo hello");
    });

    it("and/pipe/or/seq accept SshCommand arguments and return SshCommand", () => {
      const a = cmd("echo", "a");
      const b = cmd("echo", "b");
      const result: SshCommand = and(a, b);
      expect(typeof result).toBe("string");
    });
  });
});

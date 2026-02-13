import { getCoolifyCloudInit } from '../../src/utils/cloudInit';

describe('getCoolifyCloudInit', () => {
  it('should return a bash script starting with shebang', () => {
    const script = getCoolifyCloudInit('test-server');
    expect(script.startsWith('#!/bin/bash')).toBe(true);
  });

  it('should include set -e for error handling', () => {
    const script = getCoolifyCloudInit('test-server');
    expect(script).toContain('set -e');
  });

  it('should include the server name in the output', () => {
    const script = getCoolifyCloudInit('my-coolify');
    expect(script).toContain('my-coolify');
  });

  it('should include Coolify install command', () => {
    const script = getCoolifyCloudInit('test');
    expect(script).toContain('curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash');
  });

  it('should include system update step', () => {
    const script = getCoolifyCloudInit('test');
    expect(script).toContain('apt-get update -y');
  });

  it('should include service wait step', () => {
    const script = getCoolifyCloudInit('test');
    expect(script).toContain('sleep 30');
  });

  it('should handle different server names correctly', () => {
    const script1 = getCoolifyCloudInit('server-alpha');
    const script2 = getCoolifyCloudInit('production-01');

    expect(script1).toContain('server-alpha');
    expect(script1).not.toContain('production-01');
    expect(script2).toContain('production-01');
    expect(script2).not.toContain('server-alpha');
  });

  it('should include completion message', () => {
    const script = getCoolifyCloudInit('test');
    expect(script).toContain('Coolify installation completed');
  });

  it('should mention port 8000 for access', () => {
    const script = getCoolifyCloudInit('test');
    expect(script).toContain('8000');
  });
});

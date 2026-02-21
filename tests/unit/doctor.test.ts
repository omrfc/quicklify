import { execSync } from 'child_process';
import { existsSync, accessSync } from 'fs';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  accessSync: jest.fn(),
  readFileSync: jest.fn(() => '[]'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  constants: { R_OK: 4, W_OK: 2 },
}));

jest.mock('os', () => ({
  homedir: () => '/home/test',
}));

jest.mock('../../src/utils/ssh', () => ({
  checkSshAvailable: jest.fn(),
}));

import { checkSshAvailable } from '../../src/utils/ssh';
import { runDoctorChecks, doctorCommand } from '../../src/commands/doctor';

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedAccessSync = accessSync as jest.MockedFunction<typeof accessSync>;
const mockedCheckSsh = checkSshAvailable as jest.MockedFunction<typeof checkSshAvailable>;

describe('doctorCommand', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should pass Node.js check when version >= 20', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const nodeCheck = results.find((r) => r.name === 'Node.js');
    expect(nodeCheck?.status).toBe('pass');
    expect(nodeCheck?.detail).toContain(process.version);
  });

  it('should pass npm check when npm is available', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const npmCheck = results.find((r) => r.name === 'npm');
    expect(npmCheck?.status).toBe('pass');
    expect(npmCheck?.detail).toContain('v10.0.0');
  });

  it('should fail npm check when npm is not found', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const npmCheck = results.find((r) => r.name === 'npm');
    expect(npmCheck?.status).toBe('fail');
    expect(npmCheck?.detail).toBe('not found');
  });

  it('should pass SSH check when available', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const sshCheck = results.find((r) => r.name === 'SSH Client');
    expect(sshCheck?.status).toBe('pass');
  });

  it('should warn SSH check when not available', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(false);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const sshCheck = results.find((r) => r.name === 'SSH Client');
    expect(sshCheck?.status).toBe('warn');
  });

  it('should show quicklify version when provided', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const versionCheck = results.find((r) => r.name === 'quicklify');
    expect(versionCheck?.status).toBe('pass');
    expect(versionCheck?.detail).toBe('v0.6.0');
  });

  it('should warn quicklify version when not provided', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks();
    const versionCheck = results.find((r) => r.name === 'quicklify');
    expect(versionCheck?.status).toBe('warn');
    expect(versionCheck?.detail).toBe('version unknown');
  });

  it('should warn when config dir does not exist', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(false);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const configCheck = results.find((r) => r.name === 'Config Dir');
    expect(configCheck?.status).toBe('warn');
  });

  it('should fail when config dir is not writable', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {
      throw new Error('EACCES');
    });

    const results = runDoctorChecks('0.6.0');
    const configCheck = results.find((r) => r.name === 'Config Dir');
    expect(configCheck?.status).toBe('fail');
  });

  it('should display all checks and summary', async () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    await doctorCommand(undefined, '0.6.0');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Quicklify Doctor');
    expect(output).toContain('Node.js');
    expect(output).toContain('npm');
  });

  it('should show token validation message with --check-tokens', async () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    await doctorCommand({ checkTokens: true }, '0.6.0');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Token validation');
  });

  it('should fail Node.js check when version < 20', () => {
    const original = process.version;
    Object.defineProperty(process, 'version', { value: 'v18.0.0', configurable: true });

    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const results = runDoctorChecks('0.6.0');
    const nodeCheck = results.find((r) => r.name === 'Node.js');
    expect(nodeCheck?.status).toBe('fail');
    expect(nodeCheck?.detail).toContain('requires >= 20');

    Object.defineProperty(process, 'version', { value: original, configurable: true });
  });

  it('should pass servers check when servers registered', () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const fs = require('fs');
    fs.readFileSync.mockReturnValueOnce(JSON.stringify([
      { id: '1', name: 'test', provider: 'hetzner', ip: '1.2.3.4', region: 'nbg1', size: 'cax11', createdAt: '2026-01-01' },
    ]));

    const results = runDoctorChecks('0.6.0');
    const serversCheck = results.find((r) => r.name === 'Servers');
    expect(serversCheck?.status).toBe('pass');
    expect(serversCheck?.detail).toContain('1 registered');
  });

  it('should show error summary when failures exist', async () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {
      throw new Error('EACCES');
    });

    await doctorCommand(undefined, '0.6.0');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('check(s) failed');
  });

  it('should show all-pass message when no failures and no warnings', async () => {
    mockedExecSync.mockReturnValue(Buffer.from('10.0.0'));
    mockedCheckSsh.mockReturnValue(true);
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockImplementation(() => {});

    const fs = require('fs');
    fs.readFileSync.mockReturnValueOnce(JSON.stringify([
      { id: '1', name: 'test', provider: 'hetzner', ip: '1.2.3.4', region: 'nbg1', size: 'cax11', createdAt: '2026-01-01' },
    ]));

    await doctorCommand(undefined, '0.6.0');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('All checks passed!');
  });
});

import * as config from '../../src/utils/config';
import * as sshUtils from '../../src/utils/ssh';
import {
  domainCommand,
  isValidDomain,
  sanitizeDomain,
  buildSetFqdnCommand,
  buildGetFqdnCommand,
  buildDnsCheckCommand,
  parseDnsResult,
  parseFqdn,
} from '../../src/commands/domain';

jest.mock('../../src/utils/config');
jest.mock('../../src/utils/ssh');

const mockedConfig = config as jest.Mocked<typeof config>;
const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;

const sampleServer = {
  id: '123',
  name: 'coolify-test',
  provider: 'hetzner',
  ip: '1.2.3.4',
  region: 'nbg1',
  size: 'cax11',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('domain', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // Pure function tests
  describe('isValidDomain', () => {
    it('should return true for valid domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('deep.sub.example.com')).toBe(true);
      expect(isValidDomain('my-site.co.uk')).toBe(true);
    });

    it('should return false for invalid domains', () => {
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('localhost')).toBe(false);
      expect(isValidDomain('-example.com')).toBe(false);
      expect(isValidDomain('example-.com')).toBe(false);
      expect(isValidDomain('http://example.com')).toBe(false);
      expect(isValidDomain('example.com/')).toBe(false);
    });
  });

  describe('sanitizeDomain', () => {
    it('should strip https:// prefix', () => {
      expect(sanitizeDomain('https://example.com')).toBe('example.com');
    });

    it('should strip http:// prefix', () => {
      expect(sanitizeDomain('http://example.com')).toBe('example.com');
    });

    it('should strip trailing slash', () => {
      expect(sanitizeDomain('example.com/')).toBe('example.com');
    });

    it('should strip port', () => {
      expect(sanitizeDomain('example.com:8000')).toBe('example.com');
    });

    it('should trim whitespace', () => {
      expect(sanitizeDomain('  example.com  ')).toBe('example.com');
    });

    it('should handle combined cleanup', () => {
      expect(sanitizeDomain('https://example.com:8000/')).toBe('example.com');
    });
  });

  describe('buildSetFqdnCommand', () => {
    it('should build HTTPS command', () => {
      const cmd = buildSetFqdnCommand('example.com', true);
      expect(cmd).toContain('APP_URL=https://example.com');
      expect(cmd).toContain('docker compose up -d');
    });

    it('should build HTTP command', () => {
      const cmd = buildSetFqdnCommand('example.com', false);
      expect(cmd).toContain('APP_URL=http://example.com');
    });
  });

  describe('buildGetFqdnCommand', () => {
    it('should grep APP_URL', () => {
      const cmd = buildGetFqdnCommand();
      expect(cmd).toContain('grep');
      expect(cmd).toContain('APP_URL');
    });
  });

  describe('buildDnsCheckCommand', () => {
    it('should use dig with fallback', () => {
      const cmd = buildDnsCheckCommand('example.com');
      expect(cmd).toContain('dig');
      expect(cmd).toContain('example.com');
    });
  });

  describe('parseDnsResult', () => {
    it('should parse IP from dig output', () => {
      expect(parseDnsResult('1.2.3.4\n')).toBe('1.2.3.4');
    });

    it('should parse IP from host output', () => {
      expect(parseDnsResult('example.com has address 1.2.3.4')).toBe('1.2.3.4');
    });

    it('should return null for no IP', () => {
      expect(parseDnsResult('')).toBeNull();
      expect(parseDnsResult('no record found')).toBeNull();
    });
  });

  describe('parseFqdn', () => {
    it('should parse APP_URL', () => {
      expect(parseFqdn('APP_URL=https://example.com')).toBe('https://example.com');
    });

    it('should return null for missing APP_URL', () => {
      expect(parseFqdn('')).toBeNull();
      expect(parseFqdn('OTHER_VAR=value')).toBeNull();
    });
  });

  // Command tests
  describe('domainCommand', () => {
    it('should show error when SSH not available', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(false);
      await domainCommand();
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('SSH client not found');
    });

    it('should show error for invalid subcommand', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      await domainCommand('invalid');
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Invalid subcommand');
    });

    it('should return when no server found', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(undefined);
      await domainCommand('list', 'nonexistent');
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Server not found');
    });

    // add subcommand
    it('should error on missing domain for add', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('add', '1.2.3.4', {});

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Missing --domain');
    });

    it('should error on invalid domain', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('add', '1.2.3.4', { domain: '-invalid' });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Invalid domain');
    });

    it('should add domain successfully', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 0, stdout: 'exists', stderr: '' }) // test -f check
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // actual command

      await domainCommand('add', '1.2.3.4', { domain: 'example.com' });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('https://example.com');
    });

    it('should error when Coolify env file not found', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' });

      await domainCommand('add', '1.2.3.4', { domain: 'example.com' });

      // spinner.fail called - env file not found
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should show dry-run for add', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('add', '1.2.3.4', { domain: 'example.com', dryRun: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Dry Run');
      expect(output).toContain('No changes applied');
    });

    it('should handle add failure', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 0, stdout: 'exists', stderr: '' })
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'error' });

      await domainCommand('add', '1.2.3.4', { domain: 'example.com' });
      expect(mockedSsh.sshExec).toHaveBeenCalledTimes(2);
    });

    it('should handle add exception', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 0, stdout: 'exists', stderr: '' })
        .mockRejectedValueOnce(new Error('fail'));

      await domainCommand('add', '1.2.3.4', { domain: 'example.com' });
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should sanitize domain before adding', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec
        .mockResolvedValueOnce({ code: 0, stdout: 'exists', stderr: '' })
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });

      await domainCommand('add', '1.2.3.4', { domain: 'https://example.com/' });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('https://example.com');
    });

    // remove subcommand
    it('should remove domain successfully', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      await domainCommand('remove', '1.2.3.4');

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('http://1.2.3.4:8000');
    });

    it('should show dry-run for remove', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('remove', '1.2.3.4', { dryRun: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Dry Run');
    });

    it('should handle remove failure', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 1, stdout: '', stderr: 'error' });

      await domainCommand('remove', '1.2.3.4');
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should handle remove exception', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockRejectedValue(new Error('fail'));

      await domainCommand('remove', '1.2.3.4');
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    // check subcommand
    it('should error on missing domain for check', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('check', '1.2.3.4', {});

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Missing --domain');
    });

    it('should error on invalid domain for check', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);

      await domainCommand('check', '1.2.3.4', { domain: 'not valid' });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('Invalid domain');
    });

    it('should show DNS match', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: '1.2.3.4\n', stderr: '' });

      await domainCommand('check', '1.2.3.4', { domain: 'example.com' });
      // spinner.succeed called - DNS OK
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should show DNS mismatch', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: '5.6.7.8\n', stderr: '' });

      await domainCommand('check', '1.2.3.4', { domain: 'example.com' });
      // spinner.warn called - DNS mismatch
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should show no DNS record', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      await domainCommand('check', '1.2.3.4', { domain: 'example.com' });
      // spinner.fail - no record
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should handle check exception', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockRejectedValue(new Error('fail'));

      await domainCommand('check', '1.2.3.4', { domain: 'example.com' });
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    // list subcommand
    it('should list current domain', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({
        code: 0,
        stdout: 'APP_URL=https://example.com',
        stderr: '',
      });

      await domainCommand('list', '1.2.3.4');

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('https://example.com');
    });

    it('should show default when no domain set', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await domainCommand('list', '1.2.3.4');

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(output).toContain('http://1.2.3.4:8000');
    });

    it('should handle list failure', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({ code: 1, stdout: '', stderr: 'error' });

      await domainCommand('list', '1.2.3.4');
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should handle list exception', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockRejectedValue(new Error('fail'));

      await domainCommand('list', '1.2.3.4');
      expect(mockedSsh.sshExec).toHaveBeenCalled();
    });

    it('should default to list subcommand', async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedSsh.sshExec.mockResolvedValue({
        code: 0,
        stdout: 'APP_URL=https://example.com',
        stderr: '',
      });

      await domainCommand(undefined, '1.2.3.4');

      expect(mockedSsh.sshExec).toHaveBeenCalledWith(
        '1.2.3.4',
        expect.stringContaining('APP_URL'),
      );
    });
  });
});

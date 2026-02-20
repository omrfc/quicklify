import * as config from '../../src/utils/config';
import * as sshUtils from '../../src/utils/ssh';
import { monitorCommand, parseMetrics } from '../../src/commands/monitor';

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

const sampleTopOutput = `top - 12:00:00 up 5 days, 3:22, 1 user, load average: 0.15, 0.10, 0.05
Tasks: 120 total, 1 running, 119 sleeping, 0 stopped, 0 zombie
%Cpu(s):  5.3 us,  2.1 sy,  0.0 ni, 92.0 id,  0.6 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem :  7953.5 total,  1234.2 free,  3456.1 used,  3263.2 buff/cache
MiB Swap:  2048.0 total,  2048.0 free,     0.0 used.  4097.4 avail Mem`;

const sampleFreeOutput = `              total        used        free      shared  buff/cache   available
Mem:          7.8Gi       3.4Gi       1.2Gi       123Mi       3.2Gi       4.0Gi
Swap:         2.0Gi          0B       2.0Gi`;

const sampleDfOutput = `Filesystem      Size  Used Avail Use% Mounted on
total            78G   32G   42G  44% -`;

const sampleDockerPs = `NAMES     STATUS          PORTS
coolify   Up 5 days       0.0.0.0:8000->8000/tcp
nginx     Up 5 days       0.0.0.0:80->80/tcp`;

describe('monitorCommand', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('parseMetrics', () => {
    it('should parse CPU usage from top output', () => {
      const combined = `${sampleTopOutput}\n---SEPARATOR---\n${sampleFreeOutput}\n---SEPARATOR---\n${sampleDfOutput}`;
      const metrics = parseMetrics(combined);
      expect(metrics.cpu).toBe('8.0%');
    });

    it('should parse RAM from free output', () => {
      const combined = `${sampleTopOutput}\n---SEPARATOR---\n${sampleFreeOutput}\n---SEPARATOR---\n${sampleDfOutput}`;
      const metrics = parseMetrics(combined);
      expect(metrics.ramUsed).toBe('3.4Gi');
      expect(metrics.ramTotal).toBe('7.8Gi');
    });

    it('should parse disk from df output', () => {
      const combined = `${sampleTopOutput}\n---SEPARATOR---\n${sampleFreeOutput}\n---SEPARATOR---\n${sampleDfOutput}`;
      const metrics = parseMetrics(combined);
      expect(metrics.diskUsed).toBe('32G');
      expect(metrics.diskTotal).toBe('78G');
      expect(metrics.diskPercent).toBe('44%');
    });

    it('should handle missing data gracefully', () => {
      const metrics = parseMetrics('');
      expect(metrics.cpu).toBe('N/A');
      expect(metrics.ramUsed).toBe('N/A');
      expect(metrics.diskUsed).toBe('N/A');
    });
  });

  it('should show error when SSH not available', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(false);
    await monitorCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('SSH client not found');
  });

  it('should return when no server found', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(undefined);
    await monitorCommand('nonexistent');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Server not found');
  });

  it('should display metrics on success', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    const combined = `${sampleTopOutput}\n---SEPARATOR---\n${sampleFreeOutput}\n---SEPARATOR---\n${sampleDfOutput}`;
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: combined, stderr: '' });

    await monitorCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('CPU Usage');
    expect(output).toContain('RAM Usage');
    expect(output).toContain('Disk Usage');
  });

  it('should display containers when --containers flag used', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    const combined = `${sampleTopOutput}\n---SEPARATOR---\n${sampleFreeOutput}\n---SEPARATOR---\n${sampleDfOutput}\n---SEPARATOR---\n${sampleDockerPs}`;
    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: combined, stderr: '' });

    await monitorCommand('1.2.3.4', { containers: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Docker Containers');
    expect(output).toContain('coolify');
  });

  it('should handle SSH failure gracefully', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedSsh.sshExec.mockResolvedValue({ code: 255, stdout: '', stderr: 'Connection refused' });

    await monitorCommand('1.2.3.4');

    // spinner.fail is called but not visible in consoleSpy (ora mock)
    expect(mockedSsh.sshExec).toHaveBeenCalled();
  });
});

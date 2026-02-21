import inquirer from 'inquirer';
import axios from 'axios';
import * as config from '../../src/utils/config';
import { restartCommand } from '../../src/commands/restart';

jest.mock('../../src/utils/config');

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedConfig = config as jest.Mocked<typeof config>;

const sampleServer = {
  id: '123',
  name: 'coolify-test',
  provider: 'hetzner',
  ip: '1.2.3.4',
  region: 'nbg1',
  size: 'cax11',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('restartCommand', () => {
  let consoleSpy: jest.SpyInstance;
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
    // Make setTimeout instant
    global.setTimeout = ((fn: Function) => {
      fn();
      return 0;
    }) as any;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    global.setTimeout = originalSetTimeout;
  });

  it('should return when no server found', async () => {
    mockedConfig.findServer.mockReturnValue(undefined);
    await restartCommand('nonexistent');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Server not found');
  });

  it('should return when no servers exist', async () => {
    mockedConfig.getServers.mockReturnValue([]);
    await restartCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('No servers found');
  });

  it('should cancel when user declines', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: false });

    await restartCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Restart cancelled');
  });

  it('should reboot server successfully', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // validateToken
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });
    // rebootServer
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
    // getServerStatus (polling)
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: 'running' } } });

    await restartCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('restarted successfully');
  });

  it('should handle reboot API error', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // validateToken
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });
    // rebootServer fails
    mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

    await restartCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Failed to reboot');
  });

  it('should show timeout warning when server does not come back', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // validateToken
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });
    // rebootServer success
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
    // All polling attempts return non-running status
    mockedAxios.get.mockResolvedValue({ data: { server: { status: 'off' } } });

    await restartCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('may still be rebooting');
    expect(output).toContain('Check status later');
  });
});

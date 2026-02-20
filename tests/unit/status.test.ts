import axios from 'axios';
import inquirer from 'inquirer';
import { statusCommand } from '../../src/commands/status';
import * as config from '../../src/utils/config';

jest.mock('../../src/utils/config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedConfig = config as jest.Mocked<typeof config>;

const sampleServer = {
  id: '123',
  name: 'coolify-test',
  provider: 'hetzner',
  ip: '1.2.3.4',
  region: 'nbg1',
  size: 'cax11',
  createdAt: '2026-02-20T00:00:00Z',
};

describe('statusCommand', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show error when server not found by query', async () => {
    mockedConfig.findServer.mockReturnValue(undefined);

    await statusCommand('nonexistent');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Server not found');
  });

  it('should show info when no servers exist and no query', async () => {
    mockedConfig.getServers.mockReturnValue([]);

    await statusCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('No servers found');
  });

  it('should display status for found server', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    // Token prompt
    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'test-token' });

    // Hetzner getServerStatus
    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      // Coolify health check
      .mockResolvedValueOnce({ status: 200 });

    await statusCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('coolify-test');
    expect(output).toContain('hetzner');
    expect(output).toContain('1.2.3.4');
    expect(output).toContain('running');
  });

  it('should show coolify as not reachable when health check fails', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await statusCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('not reachable');
  });

  it('should handle API error gracefully', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'bad-token' });

    mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await statusCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Failed to get server status');
  });

  it('should allow interactive server selection', async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);

    // Server selection + token
    mockedInquirer.prompt
      .mockResolvedValueOnce({ serverId: '123' })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      .mockResolvedValueOnce({ status: 200 });

    await statusCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('coolify-test');
  });
});

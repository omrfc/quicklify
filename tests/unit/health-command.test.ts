import axios from 'axios';
import * as config from '../../src/utils/config';
import { checkServerHealth, healthCommand } from '../../src/commands/health';

jest.mock('../../src/utils/config');

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

const sampleServer2 = {
  id: '456',
  name: 'coolify-prod',
  provider: 'digitalocean',
  ip: '5.6.7.8',
  region: 'nyc1',
  size: 's-2vcpu-4gb',
  createdAt: '2026-01-02T00:00:00.000Z',
};

describe('healthCommand', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show message when no servers found', async () => {
    mockedConfig.getServers.mockReturnValue([]);
    await healthCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('No servers found');
  });

  it('should return healthy for reachable server', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe('healthy');
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy for 500 status', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 500 });
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe('unhealthy');
  });

  it('should return unreachable when connection fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe('unreachable');
  });

  it('should display table for multiple servers', async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    mockedAxios.get
      .mockResolvedValueOnce({ data: {}, status: 200 })
      .mockRejectedValueOnce(new Error('timeout'));

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('coolify-test');
    expect(output).toContain('coolify-prod');
    expect(output).toContain('healthy');
    expect(output).toContain('unreachable');
  });

  it('should show all healthy message when all servers are up', async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('All 1 server(s) are healthy');
  });

  it('should show warning summary when some servers are down', async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    mockedAxios.get
      .mockResolvedValueOnce({ data: {}, status: 200 })
      .mockRejectedValueOnce(new Error('timeout'));

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('1 healthy');
    expect(output).toContain('1 unreachable');
  });
});

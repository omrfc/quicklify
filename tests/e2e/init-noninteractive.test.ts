import axios from 'axios';
import inquirer from 'inquirer';
import { initCommand } from '../../src/commands/init';

jest.mock('../../src/utils/healthCheck', () => ({
  waitForCoolify: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/utils/config', () => ({
  saveServer: jest.fn(),
  getServers: jest.fn().mockReturnValue([]),
  removeServer: jest.fn(),
  findServer: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('initCommand Non-Interactive', () => {
  let consoleSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    jest.clearAllMocks();
    global.setTimeout = ((fn: Function) => {
      fn();
      return 0;
    }) as any;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
    global.setTimeout = originalSetTimeout;
  });

  it('should deploy with all options (hetzner)', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })           // validateToken
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } }); // getServerStatus

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 101,
          public_net: { ipv4: { ip: '99.88.77.66' } },
          status: 'initializing',
        },
      },
    });

    await initCommand({
      provider: 'hetzner',
      token: 'valid-token',
      region: 'nbg1',
      size: 'cax11',
      name: 'auto-hetzner',
    });

    expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('99.88.77.66');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should deploy with all options (digitalocean)', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { account: { status: 'active' } } }) // validateToken
      .mockResolvedValueOnce({ data: { droplet: { status: 'active' } } }); // getServerStatus

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        droplet: {
          id: 202,
          networks: { v4: [{ type: 'public', ip_address: '55.44.33.22' }] },
          status: 'new',
        },
      },
    });

    await initCommand({
      provider: 'digitalocean',
      token: 'do-token',
      region: 'nyc1',
      size: 's-2vcpu-2gb',
      name: 'auto-do',
    });

    expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('55.44.33.22');
  });

  it('should exit with error for invalid provider', async () => {
    await initCommand({ provider: 'aws', token: 'test' });

    expect(processExitSpy).toHaveBeenCalledWith(1);
    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Invalid provider');
  });

  it('should exit with error for invalid token', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await initCommand({
      provider: 'hetzner',
      token: 'bad-token',
      region: 'nbg1',
      size: 'cax11',
      name: 'test',
    });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should prompt for missing size when region is provided', async () => {
    // validateToken
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce({ data: { server_types: [] } }) // getAvailableServerTypes fallback
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } });

    // Prompt for size
    mockedInquirer.prompt.mockResolvedValueOnce({ size: 'cax11' });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 303,
          public_net: { ipv4: { ip: '11.22.33.44' } },
          status: 'initializing',
        },
      },
    });

    await initCommand({
      provider: 'hetzner',
      token: 'valid-token',
      region: 'nbg1',
      name: 'partial-test',
    });

    // Should have prompted for size only
    expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('should prompt for missing name when other options provided', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } });

    // Prompt for name
    mockedInquirer.prompt.mockResolvedValueOnce({ serverName: 'prompted-name' });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 404,
          public_net: { ipv4: { ip: '44.55.66.77' } },
          status: 'initializing',
        },
      },
    });

    await initCommand({
      provider: 'hetzner',
      token: 'valid-token',
      region: 'nbg1',
      size: 'cax11',
    });

    expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('should handle server IP pending (DO assigns later)', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { account: { status: 'active' } } })
      .mockResolvedValueOnce({ data: { droplet: { status: 'active' } } })
      // getServerDetails for IP refresh
      .mockResolvedValueOnce({
        data: {
          droplet: {
            id: 505,
            networks: { v4: [{ type: 'public', ip_address: '77.88.99.11' }] },
            status: 'active',
          },
        },
      });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        droplet: {
          id: 505,
          networks: { v4: [] }, // No IP yet
          status: 'new',
        },
      },
    });

    await initCommand({
      provider: 'digitalocean',
      token: 'do-token',
      region: 'nyc1',
      size: 's-2vcpu-2gb',
      name: 'do-pending',
    });

    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('77.88.99.11');
  });

  it('should handle server creation failure in non-interactive', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });

    mockedAxios.post.mockRejectedValueOnce(new Error('quota exceeded'));

    await initCommand({
      provider: 'hetzner',
      token: 'valid-token',
      region: 'nbg1',
      size: 'cax11',
      name: 'fail-test',
    });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle server boot timeout', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 600,
          public_net: { ipv4: { ip: '6.6.6.6' } },
          status: 'initializing',
        },
      },
    });

    // Never becomes "running"
    for (let i = 0; i < 31; i++) {
      mockedAxios.get.mockResolvedValueOnce({
        data: { server: { status: 'initializing' } },
      });
    }

    await initCommand({
      provider: 'hetzner',
      token: 'valid-token',
      region: 'nbg1',
      size: 'cax11',
      name: 'timeout-test',
    });

    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('check your cloud provider dashboard');
  });
});

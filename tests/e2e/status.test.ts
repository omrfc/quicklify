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

describe('statusCommand E2E', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show Coolify running status with access URL', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      .mockResolvedValueOnce({ status: 200 });

    await statusCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Coolify Status: running');
    expect(output).toContain('http://1.2.3.4:8000');
  });

  it('should show warning when Coolify is not reachable', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await statusCommand('coolify-test');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('not reachable');
    expect(output).toContain('still be installing');
  });

  it('should work with DigitalOcean provider', async () => {
    const doServer = { ...sampleServer, provider: 'digitalocean', id: '555', ip: '10.20.30.40' };
    mockedConfig.findServer.mockReturnValue(doServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'do-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { droplet: { status: 'active' } } })
      .mockResolvedValueOnce({ status: 200 });

    await statusCommand('10.20.30.40');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('digitalocean');
    expect(output).toContain('10.20.30.40');
  });

  it('should show server details (name, region, size)', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } })
      .mockResolvedValueOnce({ status: 200 });

    await statusCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Name:');
    expect(output).toContain('coolify-test');
    expect(output).toContain('Region:');
    expect(output).toContain('nbg1');
    expect(output).toContain('Size:');
    expect(output).toContain('cax11');
  });
});

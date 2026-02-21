import axios from 'axios';
import inquirer from 'inquirer';
import { destroyCommand } from '../../src/commands/destroy';
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

describe('destroyCommand E2E', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should complete full destroy flow with Hetzner', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'coolify-test' })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.delete.mockResolvedValueOnce({});

    await destroyCommand('1.2.3.4');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'https://api.hetzner.cloud/v1/servers/123',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(mockedConfig.removeServer).toHaveBeenCalledWith('123');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('removed');
  });

  it('should complete full destroy flow with DigitalOcean', async () => {
    const doServer = { ...sampleServer, provider: 'digitalocean', id: '555', ip: '10.20.30.40', name: 'do-server' };
    mockedConfig.findServer.mockReturnValue(doServer);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'do-server' })
      .mockResolvedValueOnce({ apiToken: 'do-token' });

    mockedAxios.delete.mockResolvedValueOnce({});

    await destroyCommand('10.20.30.40');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'https://api.digitalocean.com/v2/droplets/555',
      expect.objectContaining({
        headers: { Authorization: 'Bearer do-token' },
      }),
    );
  });

  it('should abort on first confirmation decline', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: false });

    await destroyCommand('coolify-test');

    expect(mockedAxios.delete).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('cancelled');
  });

  it('should abort when typed name does not match', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'wrong' });

    await destroyCommand('1.2.3.4');

    expect(mockedAxios.delete).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('does not match');
  });

  it('should handle Hetzner API error on destroy', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'coolify-test' })
      .mockResolvedValueOnce({ apiToken: 'test-token' })
      .mockResolvedValueOnce({ removeLocal: false });

    mockedAxios.delete.mockRejectedValueOnce(new Error('quota exceeded'));

    await destroyCommand('1.2.3.4');

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Failed to destroy');
  });

  it('should remove from local config when server already deleted from provider', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'coolify-test' })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.delete.mockRejectedValueOnce(new Error('Failed to destroy server: server not found'));

    await destroyCommand('1.2.3.4');

    expect(mockedConfig.removeServer).toHaveBeenCalledWith('123');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Removed from local config');
  });

  it('should find server by name', async () => {
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: 'coolify-test' })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    mockedAxios.delete.mockResolvedValueOnce({});

    await destroyCommand('coolify-test');

    expect(mockedConfig.findServer).toHaveBeenCalledWith('coolify-test');
    expect(mockedAxios.delete).toHaveBeenCalled();
  });
});

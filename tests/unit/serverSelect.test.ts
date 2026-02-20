import inquirer from 'inquirer';
import * as config from '../../src/utils/config';
import { selectServer, resolveServer, promptApiToken } from '../../src/utils/serverSelect';
import type { ServerRecord } from '../../src/types/index';

jest.mock('../../src/utils/config');

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedConfig = config as jest.Mocked<typeof config>;

const sampleServer: ServerRecord = {
  id: '123',
  name: 'coolify-test',
  provider: 'hetzner',
  ip: '1.2.3.4',
  region: 'nbg1',
  size: 'cax11',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('serverSelect', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('selectServer', () => {
    it('should return undefined when no servers exist', async () => {
      mockedConfig.getServers.mockReturnValue([]);
      const result = await selectServer();
      expect(result).toBeUndefined();
    });

    it('should prompt user to select a server', async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedInquirer.prompt.mockResolvedValueOnce({ serverId: '123' });

      const result = await selectServer();
      expect(result).toEqual(sampleServer);
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should use custom prompt message', async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedInquirer.prompt.mockResolvedValueOnce({ serverId: '123' });

      await selectServer('Pick one:');
      const promptArgs = mockedInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptArgs[0].message).toBe('Pick one:');
    });

    it('should return undefined when selected server not found in list', async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedInquirer.prompt.mockResolvedValueOnce({ serverId: 'nonexistent' });

      const result = await selectServer();
      expect(result).toBeUndefined();
    });
  });

  describe('resolveServer', () => {
    it('should find server by query', async () => {
      mockedConfig.findServer.mockReturnValue(sampleServer);
      const result = await resolveServer('1.2.3.4');
      expect(result).toEqual(sampleServer);
    });

    it('should return undefined when query not found', async () => {
      mockedConfig.findServer.mockReturnValue(undefined);
      const result = await resolveServer('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should fall back to selectServer when no query', async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedInquirer.prompt.mockResolvedValueOnce({ serverId: '123' });

      const result = await resolveServer();
      expect(result).toEqual(sampleServer);
    });

    it('should pass promptMessage to selectServer', async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedInquirer.prompt.mockResolvedValueOnce({ serverId: '123' });

      await resolveServer(undefined, 'Custom message:');
      const promptArgs = mockedInquirer.prompt.mock.calls[0][0] as any[];
      expect(promptArgs[0].message).toBe('Custom message:');
    });
  });

  describe('promptApiToken', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use HETZNER_TOKEN env var', async () => {
      process.env.HETZNER_TOKEN = 'env-token';
      const token = await promptApiToken('hetzner');
      expect(token).toBe('env-token');
      expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    });

    it('should use DIGITALOCEAN_TOKEN env var', async () => {
      process.env.DIGITALOCEAN_TOKEN = 'do-token';
      const token = await promptApiToken('digitalocean');
      expect(token).toBe('do-token');
      expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    });

    it('should prompt when env var not set', async () => {
      delete process.env.HETZNER_TOKEN;
      mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: '  user-token  ' });

      const token = await promptApiToken('hetzner');
      expect(token).toBe('user-token');
    });
  });
});

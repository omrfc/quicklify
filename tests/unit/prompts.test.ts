import inquirer from 'inquirer';
import { getDeploymentConfig, confirmDeployment } from '../../src/utils/prompts';
import type { CloudProvider } from '../../src/providers/base';

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

const mockProvider: CloudProvider = {
  name: 'hetzner',
  displayName: 'Hetzner Cloud',
  validateToken: jest.fn(),
  getRegions: () => [
    { id: 'nbg1', name: 'Nuremberg', location: 'Germany' },
    { id: 'fsn1', name: 'Falkenstein', location: 'Germany' },
  ],
  getServerSizes: () => [
    { id: 'cax11', name: 'CAX11', vcpu: 2, ram: 4, disk: 40, price: '€3.85/mo', recommended: true },
    { id: 'cpx11', name: 'CPX11', vcpu: 2, ram: 2, disk: 40, price: '€4.15/mo' },
  ],
  createServer: jest.fn(),
  getServerStatus: jest.fn(),
};

describe('getDeploymentConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return deployment config from user input', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: 'my-token',
      region: 'nbg1',
      size: 'cax11',
      serverName: 'my-server',
    });

    const config = await getDeploymentConfig(mockProvider);

    expect(config.provider).toBe('hetzner');
    expect(config.apiToken).toBe('my-token');
    expect(config.region).toBe('nbg1');
    expect(config.serverSize).toBe('cax11');
    expect(config.serverName).toBe('my-server');
  });

  it('should trim apiToken whitespace', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: '  token-with-spaces  ',
      region: 'nbg1',
      size: 'cax11',
      serverName: 'server',
    });

    const config = await getDeploymentConfig(mockProvider);
    expect(config.apiToken).toBe('token-with-spaces');
  });

  it('should trim serverName whitespace', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: 'token',
      region: 'nbg1',
      size: 'cax11',
      serverName: '  my-server  ',
    });

    const config = await getDeploymentConfig(mockProvider);
    expect(config.serverName).toBe('my-server');
  });

  it('should pass correct prompt config with regions and sizes', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: 'token',
      region: 'nbg1',
      size: 'cax11',
      serverName: 'server',
    });

    await getDeploymentConfig(mockProvider);

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];

    // Check password prompt for API token
    expect(promptConfig[0].type).toBe('password');
    expect(promptConfig[0].name).toBe('apiToken');

    // Check region list has choices from provider
    expect(promptConfig[1].type).toBe('list');
    expect(promptConfig[1].choices).toHaveLength(2);

    // Check size list has recommended marker
    expect(promptConfig[2].type).toBe('list');
    const sizeChoices = promptConfig[2].choices;
    const recommendedChoice = sizeChoices.find((c: any) => c.name.includes('Recommended'));
    expect(recommendedChoice).toBeDefined();

    // Check server name input with default
    expect(promptConfig[3].type).toBe('input');
    expect(promptConfig[3].default).toBe('coolify-server');
  });

  describe('apiToken validator', () => {
    let validateToken: (input: string) => string | true;

    beforeEach(async () => {
      mockedInquirer.prompt.mockResolvedValueOnce({
        apiToken: 'x', region: 'nbg1', size: 'cax11', serverName: 's',
      });
      await getDeploymentConfig(mockProvider);
      const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
      validateToken = promptConfig[0].validate;
    });

    it('should accept valid token', () => {
      expect(validateToken('valid-api-token')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(validateToken('')).toBe('API token is required');
    });

    it('should reject whitespace-only string', () => {
      expect(validateToken('   ')).toBe('API token is required');
    });
  });

  describe('serverName validator', () => {
    let validateName: (input: string) => string | true;

    beforeEach(async () => {
      mockedInquirer.prompt.mockResolvedValueOnce({
        apiToken: 'x', region: 'nbg1', size: 'cax11', serverName: 's',
      });
      await getDeploymentConfig(mockProvider);
      const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
      validateName = promptConfig[3].validate;
    });

    it('should accept valid lowercase name', () => {
      expect(validateName('coolify-server')).toBe(true);
    });

    it('should accept name with numbers', () => {
      expect(validateName('server-01')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(validateName('')).toBe('Server name is required');
    });

    it('should reject whitespace-only string', () => {
      expect(validateName('   ')).toBe('Server name is required');
    });

    it('should reject uppercase letters', () => {
      expect(validateName('MyServer')).toBe('Server name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should reject underscores', () => {
      expect(validateName('my_server')).toBe('Server name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should reject dots', () => {
      expect(validateName('server.com')).toBe('Server name must contain only lowercase letters, numbers, and hyphens');
    });

    it('should reject spaces', () => {
      expect(validateName('my server')).toBe('Server name must contain only lowercase letters, numbers, and hyphens');
    });
  });
});

describe('confirmDeployment', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should return true when user confirms', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: true });

    const result = await confirmDeployment(
      { provider: 'hetzner', apiToken: 'x', region: 'nbg1', serverSize: 'cax11', serverName: 'server' },
      mockProvider,
    );

    expect(result).toBe(true);
  });

  it('should return false when user declines', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: false });

    const result = await confirmDeployment(
      { provider: 'hetzner', apiToken: 'x', region: 'nbg1', serverSize: 'cax11', serverName: 'server' },
      mockProvider,
    );

    expect(result).toBe(false);
  });

  it('should print deployment summary with correct details', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: true });

    await confirmDeployment(
      { provider: 'hetzner', apiToken: 'x', region: 'nbg1', serverSize: 'cax11', serverName: 'my-server' },
      mockProvider,
    );

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Hetzner Cloud');
    expect(output).toContain('Nuremberg');
    expect(output).toContain('CAX11');
    expect(output).toContain('€3.85/mo');
    expect(output).toContain('my-server');
  });
});

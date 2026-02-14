import inquirer from 'inquirer';
import { getDeploymentConfig, getLocationConfig, getServerTypeConfig, getServerNameConfig, confirmDeployment } from '../../src/utils/prompts';
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
  getAvailableLocations: jest.fn().mockResolvedValue([
    { id: 'nbg1', name: 'Nuremberg', location: 'Germany' },
    { id: 'fsn1', name: 'Falkenstein', location: 'Germany' },
  ]),
  getAvailableServerTypes: jest.fn().mockResolvedValue([
    { id: 'cax11', name: 'CAX11', vcpu: 2, ram: 4, disk: 40, price: '€3.85/mo', recommended: true },
    { id: 'cpx11', name: 'CPX11', vcpu: 2, ram: 2, disk: 40, price: '€4.15/mo' },
  ]),
  createServer: jest.fn(),
  getServerStatus: jest.fn(),
};

describe('getDeploymentConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return deployment config with apiToken', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: 'my-token',
    });

    const config = await getDeploymentConfig(mockProvider);

    expect(config.provider).toBe('hetzner');
    expect(config.apiToken).toBe('my-token');
  });

  it('should trim apiToken whitespace', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: '  token-with-spaces  ',
    });

    const config = await getDeploymentConfig(mockProvider);
    expect(config.apiToken).toBe('token-with-spaces');
  });

  it('should pass correct prompt config for password input', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({
      apiToken: 'token',
    });

    await getDeploymentConfig(mockProvider);

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
    expect(promptConfig[0].type).toBe('password');
    expect(promptConfig[0].name).toBe('apiToken');
  });

  describe('apiToken validator', () => {
    let validateToken: (input: string) => string | true;

    beforeEach(async () => {
      mockedInquirer.prompt.mockResolvedValueOnce({ apiToken: 'x' });
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
});

describe('getLocationConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch locations from provider and return selected region', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ region: 'nbg1' });

    const region = await getLocationConfig(mockProvider);

    expect(mockProvider.getAvailableLocations).toHaveBeenCalled();
    expect(region).toBe('nbg1');
  });

  it('should pass location choices to prompt', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ region: 'fsn1' });

    await getLocationConfig(mockProvider);

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
    expect(promptConfig[0].type).toBe('list');
    expect(promptConfig[0].choices).toHaveLength(2);
    expect(promptConfig[0].choices[0].name).toContain('Nuremberg');
  });
});

describe('getServerTypeConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch server types for location and return selected size', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ size: 'cax11' });

    const size = await getServerTypeConfig(mockProvider, 'nbg1');

    expect(mockProvider.getAvailableServerTypes).toHaveBeenCalledWith('nbg1');
    expect(size).toBe('cax11');
  });

  it('should show recommended marker for recommended server types', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ size: 'cax11' });

    await getServerTypeConfig(mockProvider, 'nbg1');

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
    const choices = promptConfig[0].choices;
    const recommendedChoice = choices.find((c: any) => c.name.includes('Recommended'));
    expect(recommendedChoice).toBeDefined();
  });

  it('should include disk size in choice labels', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ size: 'cax11' });

    await getServerTypeConfig(mockProvider, 'nbg1');

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
    const choices = promptConfig[0].choices;
    expect(choices[0].name).toContain('40GB');
  });
});

describe('getServerNameConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return trimmed server name', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ serverName: '  my-server  ' });

    const name = await getServerNameConfig();
    expect(name).toBe('my-server');
  });

  it('should have default value coolify-server', async () => {
    mockedInquirer.prompt.mockResolvedValueOnce({ serverName: 'coolify-server' });

    await getServerNameConfig();

    const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
    expect(promptConfig[0].default).toBe('coolify-server');
  });

  describe('serverName validator', () => {
    let validateName: (input: string) => string | true;

    beforeEach(async () => {
      mockedInquirer.prompt.mockResolvedValueOnce({ serverName: 's' });
      await getServerNameConfig();
      const promptConfig = mockedInquirer.prompt.mock.calls[0][0] as any[];
      validateName = promptConfig[0].validate;
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

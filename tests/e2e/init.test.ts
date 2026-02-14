import axios from 'axios';
import inquirer from 'inquirer';
import { initCommand } from '../../src/commands/init';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

// Mock API responses
const locationsResponse = {
  data: {
    locations: [
      { name: 'nbg1', city: 'Nuremberg', country: 'Germany' },
      { name: 'fsn1', city: 'Falkenstein', country: 'Germany' },
    ],
  },
};

const serverTypesResponse = {
  data: {
    server_types: [
      {
        name: 'cax11',
        cores: 2,
        memory: 4,
        disk: 40,
        prices: [{ location: 'nbg1', price_monthly: { gross: '3.85' } }],
      },
    ],
  },
};

describe('initCommand E2E', () => {
  let consoleSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    jest.clearAllMocks();

    // Make all setTimeout calls resolve instantly for test speed
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

  it('should complete full deployment flow successfully', async () => {
    // Mock prompts: apiToken → region → size → serverName → confirm
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'valid-token' })
      .mockResolvedValueOnce({ region: 'nbg1' })
      .mockResolvedValueOnce({ size: 'cax11' })
      .mockResolvedValueOnce({ serverName: 'coolify-test' })
      .mockResolvedValueOnce({ confirm: true });

    // Mock API: validateToken → locations → server_types → getServerStatus
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })          // validateToken
      .mockResolvedValueOnce(locationsResponse)                   // getAvailableLocations
      .mockResolvedValueOnce(serverTypesResponse)                 // getAvailableServerTypes
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } }); // getServerStatus

    // Mock: createServer succeeds
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 123,
          public_net: { ipv4: { ip: '1.2.3.4' } },
          status: 'initializing',
        },
      },
    });

    await initCommand();

    // Verify API calls were made
    expect(mockedAxios.get).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();

    // Verify success output contains IP
    const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(allOutput).toContain('1.2.3.4');

    // Verify process.exit was NOT called (success path)
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should abort when user cancels deployment', async () => {
    // Mock prompts: apiToken → region → size → serverName → cancel
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'valid-token' })
      .mockResolvedValueOnce({ region: 'nbg1' })
      .mockResolvedValueOnce({ size: 'cax11' })
      .mockResolvedValueOnce({ serverName: 'coolify-test' })
      .mockResolvedValueOnce({ confirm: false });

    // Mock API: validateToken → locations → server_types
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce(locationsResponse)
      .mockResolvedValueOnce(serverTypesResponse);

    await initCommand();

    // No server creation should be attempted
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should stop on invalid API token', async () => {
    // Mock prompts: apiToken only (flow stops after validation)
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'bad-token' });

    // Mock: validateToken fails
    mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await initCommand();

    // createServer should never be called
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should handle server creation failure', async () => {
    // Mock prompts: full flow
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'valid-token' })
      .mockResolvedValueOnce({ region: 'nbg1' })
      .mockResolvedValueOnce({ size: 'cax11' })
      .mockResolvedValueOnce({ serverName: 'coolify-test' })
      .mockResolvedValueOnce({ confirm: true });

    // Mock API: validateToken → locations → server_types
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce(locationsResponse)
      .mockResolvedValueOnce(serverTypesResponse);

    // Mock: createServer fails
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'insufficient_funds' } } },
    });

    await initCommand();

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle server boot timeout', async () => {
    // Mock prompts: full flow
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'valid-token' })
      .mockResolvedValueOnce({ region: 'nbg1' })
      .mockResolvedValueOnce({ size: 'cax11' })
      .mockResolvedValueOnce({ serverName: 'coolify-test' })
      .mockResolvedValueOnce({ confirm: true });

    // Mock API: validateToken → locations → server_types
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce(locationsResponse)
      .mockResolvedValueOnce(serverTypesResponse);

    // Mock: createServer succeeds
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        server: {
          id: 456,
          public_net: { ipv4: { ip: '5.6.7.8' } },
          status: 'initializing',
        },
      },
    });

    // Mock: getServerStatus always returns 'initializing' (never reaches 'running')
    mockedAxios.get.mockResolvedValue({
      data: { server: { status: 'initializing' } },
    });

    await initCommand();

    // Server creation was attempted
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('should handle network error during deployment', async () => {
    // Mock prompts: full flow
    mockedInquirer.prompt
      .mockResolvedValueOnce({ apiToken: 'valid-token' })
      .mockResolvedValueOnce({ region: 'nbg1' })
      .mockResolvedValueOnce({ size: 'cax11' })
      .mockResolvedValueOnce({ serverName: 'coolify-test' })
      .mockResolvedValueOnce({ confirm: true });

    // Mock API: validateToken → locations → server_types
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      .mockResolvedValueOnce(locationsResponse)
      .mockResolvedValueOnce(serverTypesResponse);

    // Mock: createServer network error
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await initCommand();

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

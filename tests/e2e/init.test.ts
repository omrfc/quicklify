import axios from 'axios';
import inquirer from 'inquirer';
import { initCommand } from '../../src/commands/init';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

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
    // Mock: user fills config + confirms
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'valid-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: true });

    // Mock: validateToken succeeds
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } })
      // Mock: getServerStatus returns running immediately
      .mockResolvedValueOnce({ data: { server: { status: 'running' } } });

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
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'valid-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: false });

    await initCommand();

    // No API calls should be made after cancellation
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should stop on invalid API token', async () => {
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'bad-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: true });

    // Mock: validateToken fails
    mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await initCommand();

    // createServer should never be called
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should handle server creation failure', async () => {
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'valid-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: true });

    // Mock: validateToken succeeds
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });

    // Mock: createServer fails
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'insufficient_funds' } } },
    });

    await initCommand();

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle server boot timeout', async () => {
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'valid-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: true });

    // Mock: validateToken succeeds
    mockedAxios.get
      .mockResolvedValueOnce({ data: { servers: [] } });

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

    // Should NOT call process.exit (it returns early, not throws)
    // Server creation was attempted
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('should handle network error during deployment', async () => {
    mockedInquirer.prompt
      .mockResolvedValueOnce({
        apiToken: 'valid-token',
        region: 'nbg1',
        size: 'cax11',
        serverName: 'coolify-test',
      })
      .mockResolvedValueOnce({ confirm: true });

    // Mock: validateToken succeeds
    mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });

    // Mock: createServer network error
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await initCommand();

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

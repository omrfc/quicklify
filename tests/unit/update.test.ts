import inquirer from 'inquirer';
import axios from 'axios';
import * as config from '../../src/utils/config';
import * as sshUtils from '../../src/utils/ssh';
import { updateCommand } from '../../src/commands/update';

jest.mock('../../src/utils/config');
jest.mock('../../src/utils/ssh');

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedConfig = config as jest.Mocked<typeof config>;
const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;

const sampleServer = {
  id: '123',
  name: 'coolify-test',
  provider: 'hetzner',
  ip: '1.2.3.4',
  region: 'nbg1',
  size: 'cax11',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('updateCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should show error when SSH not available', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(false);
    await updateCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('SSH client not found');
  });

  it('should return when no server found', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(undefined);
    await updateCommand('nonexistent');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Server not found');
  });

  it('should cancel when user declines', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: false });

    await updateCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Update cancelled');
  });

  it('should fail when server not running', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // getServerStatus returns "off" (no validateToken call in updateCommand)
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: 'off' } } });

    await updateCommand('1.2.3.4');
    // spinner.fail output is not in console.log (ora mock)
    // verify sshExec was NOT called (early return)
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });

  it('should update successfully', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: 'running' } } });

    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: 'Coolify updated', stderr: '' });

    await updateCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('update completed successfully');
  });

  it('should handle update failure', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'test-token' });

    // getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: 'running' } } });

    mockedSsh.sshExec.mockResolvedValue({ code: 1, stdout: '', stderr: 'connection refused' });

    await updateCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(output).toContain('Update failed');
  });

  it('should handle verify server error', async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ apiToken: 'bad-token' });

    // getServerStatus throws
    mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await updateCommand('1.2.3.4');
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    // Error comes from provider.getServerStatus wrapper
    expect(output).toContain('Unauthorized');
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });
});

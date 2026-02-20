import { EventEmitter } from 'events';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

import { spawn, execSync } from 'child_process';
import { checkSshAvailable, sshConnect, sshExec, sshStream } from '../../src/utils/ssh';

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

function createMockProcess(exitCode: number = 0) {
  const cp = new EventEmitter() as any;
  cp.stdout = new EventEmitter();
  cp.stderr = new EventEmitter();
  process.nextTick(() => cp.emit('close', exitCode));
  return cp;
}

describe('ssh utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSshAvailable', () => {
    it('should return true when ssh is available', () => {
      mockedExecSync.mockReturnValue(Buffer.from('OpenSSH_8.9'));
      expect(checkSshAvailable()).toBe(true);
    });

    it('should return false when ssh is not available', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(checkSshAvailable()).toBe(false);
    });
  });

  describe('sshConnect', () => {
    it('should spawn ssh with correct args', async () => {
      const mockCp = createMockProcess(0);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshConnect('1.2.3.4');
      expect(code).toBe(0);
      expect(mockedSpawn).toHaveBeenCalledWith('ssh', ['root@1.2.3.4'], { stdio: 'inherit' });
    });

    it('should return non-zero exit code', async () => {
      const mockCp = createMockProcess(255);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshConnect('1.2.3.4');
      expect(code).toBe(255);
    });

    it('should return 1 on error', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshConnect('1.2.3.4');
      process.nextTick(() => mockCp.emit('error', new Error('spawn failed')));
      const code = await promise;
      expect(code).toBe(1);
    });

    it('should return 0 when close code is null', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshConnect('1.2.3.4');
      process.nextTick(() => mockCp.emit('close', null));
      const code = await promise;
      expect(code).toBe(0);
    });
  });

  describe('sshStream', () => {
    it('should spawn ssh with command and inherit stdio', async () => {
      const mockCp = createMockProcess(0);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshStream('1.2.3.4', 'docker logs coolify --follow');
      expect(code).toBe(0);
      expect(mockedSpawn).toHaveBeenCalledWith(
        'ssh',
        ['-o', 'StrictHostKeyChecking=accept-new', 'root@1.2.3.4', 'docker logs coolify --follow'],
        { stdio: 'inherit' },
      );
    });

    it('should return non-zero exit code', async () => {
      const mockCp = createMockProcess(1);
      mockedSpawn.mockReturnValue(mockCp);

      const code = await sshStream('1.2.3.4', 'journalctl -f');
      expect(code).toBe(1);
    });

    it('should return 1 on error', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshStream('1.2.3.4', 'tail -f /var/log/syslog');
      process.nextTick(() => mockCp.emit('error', new Error('spawn failed')));
      const code = await promise;
      expect(code).toBe(1);
    });

    it('should return 0 when close code is null', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshStream('1.2.3.4', 'journalctl -f');
      process.nextTick(() => mockCp.emit('close', null));
      const code = await promise;
      expect(code).toBe(0);
    });
  });

  describe('sshExec', () => {
    it('should execute command and return output', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec('1.2.3.4', 'docker ps');
      process.nextTick(() => {
        mockCp.stdout.emit('data', Buffer.from('CONTAINER ID'));
        mockCp.emit('close', 0);
      });

      const result = await promise;
      expect(result.code).toBe(0);
      expect(result.stdout).toBe('CONTAINER ID');
      expect(result.stderr).toBe('');
    });

    it('should capture stderr', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec('1.2.3.4', 'bad-command');
      process.nextTick(() => {
        mockCp.stderr.emit('data', Buffer.from('command not found'));
        mockCp.emit('close', 127);
      });

      const result = await promise;
      expect(result.code).toBe(127);
      expect(result.stderr).toBe('command not found');
    });

    it('should handle spawn error', async () => {
      const mockCp = new EventEmitter() as any;
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      const promise = sshExec('1.2.3.4', 'test');
      process.nextTick(() => mockCp.emit('error', new Error('spawn failed')));

      const result = await promise;
      expect(result.code).toBe(1);
      expect(result.stderr).toBe('spawn failed');
    });

    it('should pass correct args with StrictHostKeyChecking', async () => {
      const mockCp = createMockProcess(0);
      mockCp.stdout = new EventEmitter();
      mockCp.stderr = new EventEmitter();
      mockedSpawn.mockReturnValue(mockCp);

      await sshExec('1.2.3.4', 'uptime');
      expect(mockedSpawn).toHaveBeenCalledWith(
        'ssh',
        ['-o', 'StrictHostKeyChecking=accept-new', 'root@1.2.3.4', 'uptime'],
        expect.objectContaining({ stdio: ['inherit', 'pipe', 'pipe'] }),
      );
    });
  });
});

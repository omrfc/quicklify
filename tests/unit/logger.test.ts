import { logger, createSpinner } from '../../src/utils/logger';

describe('logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log info messages', () => {
    logger.info('test info');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'test info');
  });

  it('should log success messages', () => {
    logger.success('task done');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'task done');
  });

  it('should log error messages', () => {
    logger.error('something failed');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'something failed');
  });

  it('should log warning messages', () => {
    logger.warning('be careful');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'be careful');
  });

  it('should log title with empty lines before and after', () => {
    logger.title('My Title');
    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });

  it('should log step messages', () => {
    logger.step('doing something');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'doing something');
  });
});

describe('createSpinner', () => {
  it('should create a spinner with given text', () => {
    const spinner = createSpinner('Loading...');
    expect(spinner).toBeDefined();
  });

  it('should return spinner with start method', () => {
    const spinner = createSpinner('Loading...');
    expect(typeof spinner.start).toBe('function');
  });

  it('should return spinner with succeed method', () => {
    const spinner = createSpinner('Loading...');
    expect(typeof spinner.succeed).toBe('function');
  });

  it('should return spinner with fail method', () => {
    const spinner = createSpinner('Loading...');
    expect(typeof spinner.fail).toBe('function');
  });

  it('should allow chaining start', () => {
    const spinner = createSpinner('Loading...');
    const result = spinner.start();
    expect(result).toBe(spinner);
  });
});

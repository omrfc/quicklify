import axios from 'axios';
import { waitForCoolify } from '../../src/utils/healthCheck';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('waitForCoolify', () => {
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    jest.clearAllMocks();
    // Make setTimeout instant for tests
    global.setTimeout = ((fn: Function) => {
      fn();
      return 0;
    }) as any;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it('should return true when Coolify responds', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await waitForCoolify('1.2.3.4', 0, 0, 3);

    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://1.2.3.4:8000',
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('should return true after retries when Coolify eventually responds', async () => {
    mockedAxios.get
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ status: 200 });

    const result = await waitForCoolify('1.2.3.4', 0, 0, 5);

    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('should return false when max attempts reached', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await waitForCoolify('1.2.3.4', 0, 0, 3);

    expect(result).toBe(false);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('should accept any HTTP response as success', async () => {
    // Even 4xx = Coolify is running
    mockedAxios.get.mockResolvedValueOnce({ status: 401 });

    const result = await waitForCoolify('1.2.3.4', 0, 0, 3);

    expect(result).toBe(true);
  });
});

import axios from 'axios';
import { HetznerProvider } from '../../src/providers/hetzner';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HetznerProvider', () => {
  let provider: HetznerProvider;

  beforeEach(() => {
    provider = new HetznerProvider('test-api-token');
    jest.clearAllMocks();
  });

  describe('properties', () => {
    it('should have name "hetzner"', () => {
      expect(provider.name).toBe('hetzner');
    });

    it('should have displayName "Hetzner Cloud"', () => {
      expect(provider.displayName).toBe('Hetzner Cloud');
    });
  });

  describe('getRegions', () => {
    it('should return an array of regions', () => {
      const regions = provider.getRegions();
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should include Nuremberg (nbg1)', () => {
      const regions = provider.getRegions();
      const nbg = regions.find(r => r.id === 'nbg1');
      expect(nbg).toBeDefined();
      expect(nbg!.name).toBe('Nuremberg');
    });

    it('should include Falkenstein (fsn1)', () => {
      const regions = provider.getRegions();
      const fsn = regions.find(r => r.id === 'fsn1');
      expect(fsn).toBeDefined();
      expect(fsn!.name).toBe('Falkenstein');
    });

    it('should include Helsinki (hel1)', () => {
      const regions = provider.getRegions();
      const hel = regions.find(r => r.id === 'hel1');
      expect(hel).toBeDefined();
    });

    it('should include Ashburn (ash)', () => {
      const regions = provider.getRegions();
      const ash = regions.find(r => r.id === 'ash');
      expect(ash).toBeDefined();
    });

    it('should have id, name, and location for every region', () => {
      const regions = provider.getRegions();
      regions.forEach(region => {
        expect(region.id).toBeTruthy();
        expect(region.name).toBeTruthy();
        expect(region.location).toBeTruthy();
      });
    });
  });

  describe('getServerSizes', () => {
    it('should return an array of server sizes', () => {
      const sizes = provider.getServerSizes();
      expect(Array.isArray(sizes)).toBe(true);
      expect(sizes.length).toBeGreaterThan(0);
    });

    it('should have exactly one recommended option', () => {
      const sizes = provider.getServerSizes();
      const recommended = sizes.filter(s => s.recommended);
      expect(recommended).toHaveLength(1);
    });

    it('should have CAX11 as the recommended option', () => {
      const sizes = provider.getServerSizes();
      const cax11 = sizes.find(s => s.id === 'cax11');
      expect(cax11).toBeDefined();
      expect(cax11!.recommended).toBe(true);
      expect(cax11!.vcpu).toBe(2);
      expect(cax11!.ram).toBe(4);
    });

    it('should have valid specs for every size', () => {
      const sizes = provider.getServerSizes();
      sizes.forEach(size => {
        expect(size.id).toBeTruthy();
        expect(size.name).toBeTruthy();
        expect(size.vcpu).toBeGreaterThan(0);
        expect(size.ram).toBeGreaterThan(0);
        expect(size.disk).toBeGreaterThan(0);
        expect(size.price).toBeTruthy();
      });
    });

    it('should include both ARM64 (CAX) and x86 (CPX) options', () => {
      const sizes = provider.getServerSizes();
      const arm = sizes.filter(s => s.id.startsWith('cax'));
      const x86 = sizes.filter(s => s.id.startsWith('cpx'));
      expect(arm.length).toBeGreaterThan(0);
      expect(x86.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableLocations', () => {
    it('should return locations from API', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          locations: [
            { name: 'nbg1', city: 'Nuremberg', country: 'Germany' },
            { name: 'fsn1', city: 'Falkenstein', country: 'Germany' },
          ],
        },
      });

      const locations = await provider.getAvailableLocations();

      expect(locations).toHaveLength(2);
      expect(locations[0]).toEqual({ id: 'nbg1', name: 'Nuremberg', location: 'Germany' });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/locations',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-api-token' },
        }),
      );
    });

    it('should fallback to static regions on API error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const locations = await provider.getAvailableLocations();

      expect(locations).toEqual(provider.getRegions());
    });
  });

  describe('getAvailableServerTypes', () => {
    it('should return server types filtered by location', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          server_types: [
            {
              name: 'cax11',
              cores: 2,
              memory: 4,
              disk: 40,
              prices: [
                { location: 'nbg1', price_monthly: { gross: '3.85' } },
                { location: 'fsn1', price_monthly: { gross: '3.85' } },
              ],
            },
            {
              name: 'cpx11',
              cores: 2,
              memory: 2,
              disk: 40,
              prices: [
                { location: 'nbg1', price_monthly: { gross: '4.15' } },
              ],
            },
            {
              name: 'cx52',
              cores: 16,
              memory: 32,
              disk: 320,
              prices: [
                { location: 'hel1', price_monthly: { gross: '99.00' } },
              ],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nbg1');

      // cx52 should be filtered out (only available in hel1)
      expect(types).toHaveLength(2);
      expect(types[0].id).toBe('cax11');
      expect(types[0].vcpu).toBe(2);
      expect(types[0].ram).toBe(4);
      expect(types[0].price).toBe('€3.85/mo');
      expect(types[0].recommended).toBe(true);
      expect(types[1].id).toBe('cpx11');
    });

    it('should fallback to static sizes on API error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const types = await provider.getAvailableServerTypes('nbg1');

      expect(types).toEqual(provider.getServerSizes());
    });

    it('should fallback to static sizes when no types match location', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          server_types: [
            {
              name: 'cx52',
              cores: 16,
              memory: 32,
              disk: 320,
              prices: [
                { location: 'hel1', price_monthly: { gross: '99.00' } },
              ],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nbg1');

      expect(types).toEqual(provider.getServerSizes());
    });

    it('should mark cheapest type as recommended when cax11 is not available', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          server_types: [
            {
              name: 'cpx11',
              cores: 2,
              memory: 2,
              disk: 40,
              prices: [{ location: 'nbg1', price_monthly: { gross: '4.15' } }],
            },
            {
              name: 'cpx21',
              cores: 3,
              memory: 4,
              disk: 80,
              prices: [{ location: 'nbg1', price_monthly: { gross: '7.35' } }],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nbg1');

      expect(types).toHaveLength(2);
      // cpx11 is cheapest, so it should be recommended
      expect(types[0].id).toBe('cpx11');
      expect(types[0].recommended).toBe(true);
      // cpx21 should NOT be recommended
      expect(types[1].id).toBe('cpx21');
      expect(types[1].recommended).toBeUndefined();
    });

    it('should filter out deprecated server types', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          server_types: [
            {
              name: 'cax11',
              cores: 2,
              memory: 4,
              disk: 40,
              deprecation: { announced: '2025-01-01' },
              prices: [{ location: 'nbg1', price_monthly: { gross: '3.85' } }],
            },
            {
              name: 'cpx11',
              cores: 2,
              memory: 2,
              disk: 40,
              prices: [{ location: 'nbg1', price_monthly: { gross: '4.15' } }],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nbg1');

      expect(types).toHaveLength(1);
      expect(types[0].id).toBe('cpx11');
      // cpx11 is the only and cheapest one, so recommended
      expect(types[0].recommended).toBe(true);
    });

    it('should call correct API endpoint', async () => {
      mockedAxios.get.mockResolvedValueOnce({
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
      });

      await provider.getAvailableServerTypes('nbg1');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/server_types',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-api-token' },
        }),
      );
    });
  });

  describe('validateToken', () => {
    it('should return true for a valid token', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });

      const result = await provider.validateToken('valid-token');

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        })
      );
    });

    it('should return false for an invalid token', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await provider.validateToken('bad-token');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.validateToken('any-token');

      expect(result).toBe(false);
    });
  });

  describe('createServer', () => {
    const serverConfig = {
      name: 'test-server',
      size: 'cax11',
      region: 'nbg1',
      cloudInit: '#!/bin/bash\necho hello',
    };

    it('should create a server and return result', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          server: {
            id: 12345,
            public_net: { ipv4: { ip: '1.2.3.4' } },
            status: 'initializing',
          },
        },
      });

      const result = await provider.createServer(serverConfig);

      expect(result.id).toBe('12345');
      expect(result.ip).toBe('1.2.3.4');
      expect(result.status).toBe('initializing');
    });

    it('should send correct request payload to Hetzner API', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          server: {
            id: 1,
            public_net: { ipv4: { ip: '10.0.0.1' } },
            status: 'initializing',
          },
        },
      });

      await provider.createServer(serverConfig);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers',
        {
          name: 'test-server',
          server_type: 'cax11',
          location: 'nbg1',
          image: 'ubuntu-24.04',
          user_data: serverConfig.cloudInit,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw with API error message on failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            error: { message: 'server_limit_exceeded' },
          },
        },
      });

      await expect(provider.createServer(serverConfig)).rejects.toThrow(
        'Failed to create server: server_limit_exceeded'
      );
    });

    it('should throw with generic message on network error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      await expect(provider.createServer(serverConfig)).rejects.toThrow(
        'Failed to create server: Network Error'
      );
    });

    it('should throw on timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'));

      await expect(provider.createServer(serverConfig)).rejects.toThrow(
        'Failed to create server: timeout of 30000ms exceeded'
      );
    });
  });

  describe('getServerStatus', () => {
    it('should return "running" for a running server', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { server: { status: 'running' } },
      });

      const status = await provider.getServerStatus('12345');

      expect(status).toBe('running');
    });

    it('should return "initializing" for a new server', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { server: { status: 'initializing' } },
      });

      const status = await provider.getServerStatus('12345');

      expect(status).toBe('initializing');
    });

    it('should call correct API endpoint with server ID', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { server: { status: 'running' } },
      });

      await provider.getServerStatus('99999');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.hetzner.cloud/v1/servers/99999',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-api-token' },
        })
      );
    });

    it('should throw on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Not Found'));

      await expect(provider.getServerStatus('00000')).rejects.toThrow(
        'Failed to get server status: Not Found'
      );
    });
  });
});

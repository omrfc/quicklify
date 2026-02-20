import axios from 'axios';
import { DigitalOceanProvider } from '../../src/providers/digitalocean';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DigitalOceanProvider', () => {
  let provider: DigitalOceanProvider;

  beforeEach(() => {
    provider = new DigitalOceanProvider('test-do-token');
    jest.clearAllMocks();
  });

  describe('properties', () => {
    it('should have name "digitalocean"', () => {
      expect(provider.name).toBe('digitalocean');
    });

    it('should have displayName "DigitalOcean"', () => {
      expect(provider.displayName).toBe('DigitalOcean');
    });
  });

  describe('getRegions', () => {
    it('should return an array of regions', () => {
      const regions = provider.getRegions();
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should include NYC1', () => {
      const regions = provider.getRegions();
      const nyc = regions.find(r => r.id === 'nyc1');
      expect(nyc).toBeDefined();
      expect(nyc!.name).toBe('New York 1');
    });

    it('should include FRA1', () => {
      const regions = provider.getRegions();
      const fra = regions.find(r => r.id === 'fra1');
      expect(fra).toBeDefined();
      expect(fra!.name).toBe('Frankfurt 1');
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

    it('should have s-2vcpu-2gb as first option', () => {
      const sizes = provider.getServerSizes();
      expect(sizes[0].id).toBe('s-2vcpu-2gb');
      expect(sizes[0].vcpu).toBe(2);
      expect(sizes[0].ram).toBe(2);
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
  });

  describe('validateToken', () => {
    it('should return true for a valid token', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { account: { status: 'active' } } });

      const result = await provider.validateToken('valid-token');

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/account',
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

  describe('getAvailableLocations', () => {
    it('should return locations from API filtered by availability', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          regions: [
            { slug: 'nyc1', name: 'New York 1', available: true },
            { slug: 'nyc2', name: 'New York 2', available: false },
            { slug: 'fra1', name: 'Frankfurt 1', available: true },
          ],
        },
      });

      const locations = await provider.getAvailableLocations();

      expect(locations).toHaveLength(2);
      expect(locations[0]).toEqual({ id: 'nyc1', name: 'New York 1', location: 'nyc1' });
      expect(locations[1]).toEqual({ id: 'fra1', name: 'Frankfurt 1', location: 'fra1' });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/regions',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-do-token' },
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
    it('should return server types filtered by location and availability', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          sizes: [
            {
              slug: 's-2vcpu-2gb',
              memory: 2048,
              vcpus: 2,
              disk: 60,
              price_monthly: 12.0,
              available: true,
              regions: ['nyc1', 'fra1'],
            },
            {
              slug: 's-2vcpu-4gb',
              memory: 4096,
              vcpus: 2,
              disk: 80,
              price_monthly: 24.0,
              available: true,
              regions: ['nyc1'],
            },
            {
              slug: 's-4vcpu-8gb',
              memory: 8192,
              vcpus: 4,
              disk: 160,
              price_monthly: 48.0,
              available: true,
              regions: ['fra1'],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nyc1');

      // s-4vcpu-8gb should be filtered out (not in nyc1)
      expect(types).toHaveLength(2);
      expect(types[0].id).toBe('s-2vcpu-2gb');
      expect(types[0].vcpu).toBe(2);
      expect(types[0].ram).toBe(2);
      expect(types[0].price).toBe('$12.00/mo');
      expect(types[1].id).toBe('s-2vcpu-4gb');
      expect(types[1].ram).toBe(4);
    });

    it('should fallback to static sizes on API error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const types = await provider.getAvailableServerTypes('nyc1');

      expect(types).toEqual(provider.getServerSizes());
    });

    it('should fallback to static sizes when no types match location', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          sizes: [
            {
              slug: 's-2vcpu-2gb',
              memory: 2048,
              vcpus: 2,
              disk: 60,
              price_monthly: 12.0,
              available: true,
              regions: ['fra1'],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nyc1');

      expect(types).toEqual(provider.getServerSizes());
    });

    it('should filter out unavailable sizes', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          sizes: [
            {
              slug: 's-2vcpu-2gb',
              memory: 2048,
              vcpus: 2,
              disk: 60,
              price_monthly: 12.0,
              available: false,
              regions: ['nyc1'],
            },
            {
              slug: 's-2vcpu-4gb',
              memory: 4096,
              vcpus: 2,
              disk: 80,
              price_monthly: 24.0,
              available: true,
              regions: ['nyc1'],
            },
          ],
        },
      });

      const types = await provider.getAvailableServerTypes('nyc1');

      expect(types).toHaveLength(1);
      expect(types[0].id).toBe('s-2vcpu-4gb');
    });

    it('should call correct API endpoint', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          sizes: [
            {
              slug: 's-2vcpu-2gb',
              memory: 2048,
              vcpus: 2,
              disk: 60,
              price_monthly: 12.0,
              available: true,
              regions: ['nyc1'],
            },
          ],
        },
      });

      await provider.getAvailableServerTypes('nyc1');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/sizes',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-do-token' },
        }),
      );
    });
  });

  describe('createServer', () => {
    const serverConfig = {
      name: 'test-droplet',
      size: 's-2vcpu-2gb',
      region: 'nyc1',
      cloudInit: '#!/bin/bash\necho hello',
    };

    it('should create a droplet and return result', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          droplet: {
            id: 12345,
            networks: {
              v4: [
                { type: 'public', ip_address: '1.2.3.4' },
                { type: 'private', ip_address: '10.0.0.1' },
              ],
            },
            status: 'new',
          },
        },
      });

      const result = await provider.createServer(serverConfig);

      expect(result.id).toBe('12345');
      expect(result.ip).toBe('1.2.3.4');
      expect(result.status).toBe('new');
    });

    it('should return "pending" IP when no public network', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          droplet: {
            id: 12345,
            networks: { v4: [] },
            status: 'new',
          },
        },
      });

      const result = await provider.createServer(serverConfig);

      expect(result.ip).toBe('pending');
    });

    it('should send correct request payload to DigitalOcean API', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          droplet: {
            id: 1,
            networks: { v4: [{ type: 'public', ip_address: '10.0.0.1' }] },
            status: 'new',
          },
        },
      });

      await provider.createServer(serverConfig);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/droplets',
        {
          name: 'test-droplet',
          size: 's-2vcpu-2gb',
          region: 'nyc1',
          image: 'ubuntu-22-04-x64',
          user_data: serverConfig.cloudInit,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-do-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw with API error message on failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'You specified an invalid size for Droplet creation.',
          },
        },
      });

      await expect(provider.createServer(serverConfig)).rejects.toThrow(
        'Failed to create server: You specified an invalid size for Droplet creation.'
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

    it('should handle non-Error thrown values', async () => {
      mockedAxios.post.mockRejectedValueOnce('unexpected string error');

      await expect(provider.createServer(serverConfig)).rejects.toThrow(
        'Failed to create server: unexpected string error'
      );
    });
  });

  describe('getServerDetails', () => {
    it('should return full server details with public IP', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          droplet: {
            id: 12345,
            networks: {
              v4: [
                { type: 'public', ip_address: '10.20.30.40' },
                { type: 'private', ip_address: '10.0.0.1' },
              ],
            },
            status: 'active',
          },
        },
      });

      const details = await provider.getServerDetails('12345');

      expect(details.id).toBe('12345');
      expect(details.ip).toBe('10.20.30.40');
      expect(details.status).toBe('running'); // normalized from "active"
    });

    it('should return "pending" IP when no public network yet', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          droplet: {
            id: 12345,
            networks: { v4: [] },
            status: 'new',
          },
        },
      });

      const details = await provider.getServerDetails('12345');

      expect(details.ip).toBe('pending');
      expect(details.status).toBe('new');
    });
  });

  describe('getServerStatus', () => {
    it('should return "running" for an active droplet (normalized from DO "active")', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { droplet: { status: 'active' } },
      });

      const status = await provider.getServerStatus('12345');

      expect(status).toBe('running');
    });

    it('should return "new" for a new droplet', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { droplet: { status: 'new' } },
      });

      const status = await provider.getServerStatus('12345');

      expect(status).toBe('new');
    });

    it('should call correct API endpoint with droplet ID', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { droplet: { status: 'active' } },
      });

      await provider.getServerStatus('99999');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/droplets/99999',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-do-token' },
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

  describe('destroyServer', () => {
    it('should delete droplet successfully', async () => {
      mockedAxios.delete.mockResolvedValueOnce({});

      await provider.destroyServer('12345');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/droplets/12345',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-do-token' },
        }),
      );
    });

    it('should throw with API error message on failure', async () => {
      mockedAxios.delete.mockRejectedValueOnce({
        response: {
          data: {
            message: 'The resource you requested could not be found.',
          },
        },
      });

      await expect(provider.destroyServer('99999')).rejects.toThrow(
        'Failed to destroy server: The resource you requested could not be found.',
      );
    });

    it('should throw with generic message on network error', async () => {
      mockedAxios.delete.mockRejectedValueOnce(new Error('Network Error'));

      await expect(provider.destroyServer('12345')).rejects.toThrow(
        'Failed to destroy server: Network Error',
      );
    });

    it('should handle non-Error thrown values', async () => {
      mockedAxios.delete.mockRejectedValueOnce('unexpected');

      await expect(provider.destroyServer('12345')).rejects.toThrow(
        'Failed to destroy server: unexpected',
      );
    });
  });
});

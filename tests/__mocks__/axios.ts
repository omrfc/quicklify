// eslint-disable-next-line prefer-const
let axios: Record<string, unknown> = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  defaults: {
    headers: {
      common: {},
    },
  },
  isAxiosError: (error: unknown): boolean => {
    if (error === null || error === undefined) return false;
    if (typeof error === "object" && "response" in error) return true;
    return error instanceof Error;
  },
};

// create() returns axios itself so apiClient uses the same mock functions
axios.create = jest.fn(() => axios);

export default axios;

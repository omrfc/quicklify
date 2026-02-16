const axios = {
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

export default axios;

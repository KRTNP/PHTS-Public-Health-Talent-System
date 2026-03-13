export const makeJsonRes = () => ({
  json: jest.fn(),
});

export const makeStatusJsonRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

export const makeUser = (overrides: Record<string, unknown> = {}) => ({
  userId: 46941,
  role: 'PTS_OFFICER',
  ...overrides,
});

export const makeNext = () => jest.fn();

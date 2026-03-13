import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';

export const makeDbConnectionMock = () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
});

export const mockOfficerTargetCitizenLookup = (
  officerId = 9001,
  officerCitizenId = '3640500458749',
  targetId = 2001,
  targetCitizenId = '1100702579863',
) => {
  jest.spyOn(requestRepository, 'findUserCitizenId').mockImplementation(async (userId: number) => {
    if (userId === officerId) return officerCitizenId;
    if (userId === targetId) return targetCitizenId;
    return null;
  });
};

export const mockUniqueRequestNo = () => {
  jest.spyOn(requestRepository, 'existsByRequestNo').mockResolvedValue(false);
};

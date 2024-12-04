import { calculateExpirationThreshold } from './service'; // Directly import the function
import { subDays, subHours, subMinutes } from 'date-fns';
import service from './service';

jest.mock('@strapi/strapi');

describe('Service Tests', () => {
  let strapiMock;
  let serviceInstance;

  beforeEach(() => {
    strapiMock = {
      config: {
        get: jest.fn().mockReturnValue({
          refreshTokenExpiresIn: '30d',
        }),
      },
      query: jest.fn().mockReturnThis(),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'mockedId',
        user: 1,
        ipAddress: 'mockedIpAddress',
      }),
    };

    serviceInstance = service({ strapi: strapiMock });
  });

  // Calculate Expiration Threshold Tests
  describe('calculateExpirationThreshold', () => {
    const isWithinOneSecond = (date1, date2) => {
      return Math.abs(date1.getTime() - date2.getTime()) <= 1000;
    };

    it('should calculate expiration date correctly for days', () => {
      const expirationThreshold = calculateExpirationThreshold('30d');
      const expectedDate = subDays(new Date(), 30);
      expect(isWithinOneSecond(expirationThreshold, expectedDate)).toBe(true);
    });

    it('should calculate expiration date correctly for hours', () => {
      const expirationThreshold = calculateExpirationThreshold('5h');
      const expectedDate = subHours(new Date(), 5);
      expect(isWithinOneSecond(expirationThreshold, expectedDate)).toBe(true);
    });

    it('should calculate expiration date correctly for minutes', () => {
      const expirationThreshold = calculateExpirationThreshold('15m');
      const expectedDate = subMinutes(new Date(), 15);
      expect(isWithinOneSecond(expirationThreshold, expectedDate)).toBe(true);
    });

    it('should throw an error for invalid tokenExpires format', () => {
      expect(() => calculateExpirationThreshold('3x')).toThrow(
        'Invalid tokenExpires format. Use formats like "30d", "1h", "15m".'
      );
    });
  });
  describe('create', () => {
    it('should call cleanExpiredTokens and then create a new token, deleting expired tokens', async () => {
      const user = { id: 1 };
      const request = { ip: 'mockedIpAddress' };

      // Mock expired tokens to be returned by findMany
      const mockTokens = [
        { id: 'token1', createdAt: new Date().toISOString() },
        { id: 'token2', createdAt: new Date().toISOString() },
      ];
      strapiMock.query().findMany.mockResolvedValue(mockTokens);

      // Spy on the cleanExpiredTokens function
      const cleanExpiredTokensSpy = jest.spyOn(serviceInstance, 'cleanExpiredTokens');

      await serviceInstance.create(user, request);

      // Verify that cleanExpiredTokens was called
      expect(cleanExpiredTokensSpy).toHaveBeenCalledWith(user);

      // Verify that each expired token was deleted
      expect(strapiMock.query().delete).toHaveBeenCalledTimes(mockTokens.length);
      mockTokens.forEach((token) => {
        expect(strapiMock.query().delete).toHaveBeenCalledWith({
          where: { id: token.id },
        });
      });

      // Verify that create was called with the correct data
      expect(strapiMock.query().create).toHaveBeenCalledWith({
        data: {
          user: user.id,
          ipAddress: request.ip,
        },
      });
    });
  });

});

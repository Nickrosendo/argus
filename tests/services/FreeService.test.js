// Mock browser storage before importing
const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
};

// Mock browser APIs
global.chrome = {
  storage: {
    local: mockStorage,
  },
};

global.browser = {
  storage: {
    local: mockStorage,
  },
};

// Mock fetch
global.fetch = jest.fn();

// Mock environment
process.env.API_URL = 'http://localhost:3000';

// Import after mocking - use require to ensure proper order
const FreeService = require('../../services/FreeService.js').default;

describe('FreeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
    global.fetch.mockReset();
  });

  describe('isFreeMode', () => {
    it('should return true when explicitly in free mode', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.isFreeMode();

      expect(result).toBe(true);
      expect(mockStorage.get).toHaveBeenCalledWith([
        'freeMode',
        'authToken',
        'userInfo',
      ]);
    });

    it('should return true when not authenticated', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: null,
      });

      const result = await FreeService.isFreeMode();

      expect(result).toBe(true);
    });

    it('should return false for premium user with userInfo', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: { type: 'premium' },
      });

      const result = await FreeService.isFreeMode();

      expect(result).toBe(false);
    });

    it('should check API when userInfo is not available', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: null,
      });

      // Mock successful API response for premium user
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ userType: 'premium' }),
      });

      const result = await FreeService.isFreeMode();

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/payments/subscription-status',
        {
          headers: {
            Authorization: 'Bearer valid_token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return true when API check fails', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: null,
      });

      // Mock API failure
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await FreeService.isFreeMode();

      expect(result).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      const result = await FreeService.isFreeMode();

      expect(result).toBe(true);
    });
  });

  describe('checkSubscriptionStatus', () => {
    it('should return premium for valid subscription', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ userType: 'premium' }),
      });

      const result = await FreeService.checkSubscriptionStatus('valid_token');

      expect(result.userType).toBe('premium');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/payments/subscription-status',
        {
          headers: {
            Authorization: 'Bearer valid_token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should throw error for failed API call', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(FreeService.checkSubscriptionStatus('invalid_token')).rejects.toThrow('API request failed with status: 401');
    });

    it('should return free when userType is missing', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await FreeService.checkSubscriptionStatus('valid_token');

      expect(result.userType).toBe('free');
    });

    it('should throw error for network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(FreeService.checkSubscriptionStatus('valid_token')).rejects.toThrow('Network error');
    });
  });

  describe('enableFreeMode', () => {
    it('should set free mode storage correctly', async () => {
      const mockTimestamp = 1640995200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await FreeService.enableFreeMode();

      expect(mockStorage.set).toHaveBeenCalledWith({
        freeMode: true,
        freeActionCount: 0,
        lastAdTime: mockTimestamp,
      });

      Date.now.mockRestore();
    });
  });

  describe('disableFreeMode', () => {
    it('should disable free mode', async () => {
      await FreeService.disableFreeMode();

      expect(mockStorage.set).toHaveBeenCalledWith({
        freeMode: false,
      });
    });
  });

  describe('isFeatureAvailable', () => {
    it('should return true for all features when not in free mode', async () => {
      // Mock premium user
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: { type: 'premium' },
      });

      const result = await FreeService.isFeatureAvailable('cloud_sync');

      expect(result).toBe(true);
    });

    it('should return true for free features when in free mode', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.isFeatureAvailable('basic_tracking');

      expect(result).toBe(true);
    });

    it('should return false for premium features when in free mode', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.isFeatureAvailable('cloud_sync');

      expect(result).toBe(false);
    });

    it('should handle unknown features in free mode', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.isFeatureAvailable('unknown_feature');

      expect(result).toBe(false);
    });
  });

  describe('canAddBlockedSite', () => {
    it('should return true for premium users regardless of count', async () => {
      // Mock premium user
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: { type: 'premium' },
      });

      const currentSites = ['site1.com', 'site2.com', 'site3.com', 'site4.com', 'site5.com'];
      const result = await FreeService.canAddBlockedSite(currentSites);

      expect(result).toBe(true);
    });

    it('should return true for free users under the limit', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const currentSites = ['site1.com', 'site2.com'];
      const result = await FreeService.canAddBlockedSite(currentSites);

      expect(result).toBe(true);
    });

    it('should return false for free users at the limit', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const currentSites = ['site1.com', 'site2.com', 'site3.com'];
      const result = await FreeService.canAddBlockedSite(currentSites);

      expect(result).toBe(false);
    });

    it('should return false for free users over the limit', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const currentSites = ['site1.com', 'site2.com', 'site3.com', 'site4.com'];
      const result = await FreeService.canAddBlockedSite(currentSites);

      expect(result).toBe(false);
    });

    it('should handle empty blocked sites array', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.canAddBlockedSite([]);

      expect(result).toBe(true);
    });

    it('should handle undefined blocked sites array', async () => {
      // Mock free user
      mockStorage.get.mockResolvedValue({
        freeMode: true,
      });

      const result = await FreeService.canAddBlockedSite();

      expect(result).toBe(true);
    });
  });

  describe('trackKeyAction', () => {
    it('should return false when not in free mode', async () => {
      mockStorage.get
        .mockResolvedValueOnce({
          freeMode: false,
          authToken: 'valid_token',
          userInfo: { type: 'premium' },
        });

      const result = await FreeService.trackKeyAction();

      expect(result).toBe(false);
    });

    it('should return true and reset counter when action limit reached', async () => {
      mockStorage.get
        .mockResolvedValueOnce({
          freeMode: true,
          authToken: null,
          userInfo: null,
        })
        .mockResolvedValueOnce({
          freeActionCount: 5,
          lastAdTime: Date.now() - 1000,
        });

      const mockTimestamp = 1640995200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const result = await FreeService.trackKeyAction();

      expect(result).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith({
        freeActionCount: 0,
        lastAdTime: mockTimestamp,
      });

      Date.now.mockRestore();
    });

    it('should return true when 24 hours have passed since last ad', async () => {
      const mockTimestamp = 1640995200000;
      const oneDayAgo = mockTimestamp - 25 * 60 * 60 * 1000; // 25 hours ago
      
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      
      mockStorage.get
        .mockResolvedValueOnce({
          freeMode: true,
          authToken: null,
          userInfo: null,
        })
        .mockResolvedValueOnce({
          freeActionCount: 2,
          lastAdTime: oneDayAgo,
        });

      const result = await FreeService.trackKeyAction();

      expect(result).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith({
        freeActionCount: 0,
        lastAdTime: mockTimestamp,
      });

      Date.now.mockRestore();
    });

    it('should increment counter when under limit', async () => {
      mockStorage.get
        .mockResolvedValueOnce({
          freeMode: true,
          authToken: null,
          userInfo: null,
        })
        .mockResolvedValueOnce({
          freeActionCount: 3,
          lastAdTime: Date.now() - 1000,
        });

      const result = await FreeService.trackKeyAction();

      expect(result).toBe(false);
      expect(mockStorage.set).toHaveBeenCalledWith({
        freeActionCount: 4,
      });
    });

    it('should handle missing storage values', async () => {
      mockStorage.get
        .mockResolvedValueOnce({
          freeMode: true,
          authToken: null,
          userInfo: null,
        })
        .mockResolvedValueOnce({});

      const mockTimestamp = 1640995200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const result = await FreeService.trackKeyAction();

      expect(result).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith({
        freeActionCount: 0,
        lastAdTime: mockTimestamp,
      });

      Date.now.mockRestore();
    });
  });

  describe('getFreeModeInfo', () => {
    it('should return correct free mode limitations', () => {
      const info = FreeService.getFreeModeInfo();

      expect(info).toEqual({
        maxBlockedSites: 3,
        maxHistoryDays: 7,
        featureRestrictions: [
          'Cloud sync unavailable',
          'Limited to 3 blocked sites',
          'Limited to 7 days of history',
          'Basic statistics only',
        ],
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent isFreeMode calls', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: { type: 'premium' },
      });

      const promises = [
        FreeService.isFreeMode(),
        FreeService.isFreeMode(),
        FreeService.isFreeMode(),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([false, false, false]);
    });

    it('should handle malformed userInfo', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: 'invalid_json',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ userType: 'free' }),
      });

      const result = await FreeService.isFreeMode();

      expect(result).toBe(true);
    });

    it('should handle API timeout gracefully', async () => {
      mockStorage.get.mockResolvedValue({
        freeMode: false,
        authToken: 'valid_token',
        userInfo: null,
      });

      // Mock slow API response
      global.fetch.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: false }), 1000))
      );

      await expect(FreeService.checkSubscriptionStatus('valid_token')).rejects.toThrow('API request failed with status: undefined');
    });
  });
});
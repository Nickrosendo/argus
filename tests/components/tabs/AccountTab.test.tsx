import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccountTab from '../../../src/components/tabs/AccountTab';
import { StorageData } from '../../../src/types/storage';

// Mock PaymentModal
jest.mock('../../../src/components/PaymentModal', () => {
  return function MockPaymentModal({ isOpen, onClose, onPaymentSuccess }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="payment-modal">
        <button onClick={onPaymentSuccess}>Mock Payment Success</button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  };
});

// Mock browser API
const mockBrowserAPI = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
  },
};

// Mock fetch for API calls
global.fetch = jest.fn();
process.env.API_URL = 'http://localhost:3000';

// Mock the browser API globally
(global as any).chrome = mockBrowserAPI;
(global as any).browser = mockBrowserAPI;

// Mock useBrowserMessaging hook
jest.mock('../../../src/hooks/useBrowserMessaging', () => ({
  useBrowserMessaging: () => ({
    signout: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('AccountTab', () => {
  const mockData: StorageData = {
    sites: {},
    totalTime: 0,
    history: {},
    settings: {
      idleTime: 5,
      dailyLimit: 480,
      showNotifications: true,
      enableBlocking: true,
    },
    blockedSites: [],
    userInfo: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg',
    },
  };

  const defaultProps = {
    data: mockData,
    isAuthenticated: false,
    isFreeMode: true,
    onSignOut: jest.fn(),
    onAuth: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserAPI.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Free Mode Display', () => {
    it('should render free mode interface correctly', () => {
      render(<AccountTab {...defaultProps} />);

      expect(screen.getByText('Free Mode Account')).toBeInTheDocument();
      expect(screen.getByText('Cross-device data synchronization')).toBeInTheDocument();
      expect(screen.getByText('Advanced analytics & insights')).toBeInTheDocument();
      expect(screen.getByText('Cloud backup & recovery')).toBeInTheDocument();
      expect(screen.getByText('Enhanced productivity tracking')).toBeInTheDocument();
      expect(screen.getByText('Sign In to Unlock Premium Features')).toBeInTheDocument();
    });

    it('should handle sign in button click', () => {
      render(<AccountTab {...defaultProps} />);

      const signInButton = screen.getByText('Sign In to Unlock Premium Features');
      fireEvent.click(signInButton);

      expect(defaultProps.onAuth).toHaveBeenCalledWith(true);
    });

    it('should show payment modal in free mode', () => {
      render(<AccountTab {...defaultProps} />);

      // PaymentModal should not be visible initially
      expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated User Display', () => {
    const authenticatedProps = {
      ...defaultProps,
      isAuthenticated: true,
      isFreeMode: false,
    };

    beforeEach(() => {
      // Mock successful subscription status check
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: true,
          userType: 'premium',
          subscriptionId: 'sub_test123',
          status: 'active',
          currentPeriodEnd: 1640995200,
          cancelAtPeriodEnd: false,
        }),
      });

      mockBrowserAPI.storage.local.get.mockResolvedValue({
        lastSyncTime: Date.now() - 60000, // 1 minute ago
        authToken: 'valid_token_123',
      });
    });

    it('should render authenticated user interface', async () => {
      render(<AccountTab {...authenticatedProps} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should display user avatar when available', () => {
      render(<AccountTab {...authenticatedProps} />);

      const avatar = screen.getByAltText('Profile');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should display fallback avatar when picture not available', () => {
      const dataWithoutPicture = {
        ...mockData,
        userInfo: {
          ...mockData.userInfo!,
          picture: null,
        },
      };

      render(<AccountTab {...authenticatedProps} data={dataWithoutPicture} />);

      expect(screen.queryByAltText('Profile')).not.toBeInTheDocument();
      expect(screen.getByRole('presentation')).toBeInTheDocument(); // SVG placeholder
    });


    it('should handle sync failure gracefully', async () => {
      mockBrowserAPI.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(<AccountTab {...authenticatedProps} />);

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      // Use getAllByText to handle multiple "Syncing..." texts
      const syncingElements = screen.getAllByText('Syncing...');
      expect(syncingElements.length).toBeGreaterThan(0);

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });
    });

    it('should handle sign out', async () => {
      render(<AccountTab {...authenticatedProps} />);

      const signOutButton = screen.getByText('Sign Out');
      fireEvent.click(signOutButton);

      // The component should call onSignOut regardless of the signout result
      await waitFor(() => {
        expect(defaultProps.onSignOut).toHaveBeenCalled();
      });
    });

    it('should show upgrade button for authenticated free users', async () => {
      const freeAuthenticatedProps = {
        ...defaultProps,
        isAuthenticated: true,
        isFreeMode: true,
      };

      // Mock free user subscription status
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });

      render(<AccountTab {...freeAuthenticatedProps} />);

      // Wait for subscription status to load
      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Integration', () => {
    const authenticatedProps = {
      ...defaultProps,
      isAuthenticated: true,
      isFreeMode: false,
    };

    beforeEach(() => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({
        lastSyncTime: Date.now() - 60000,
        authToken: 'valid_token_123',
      });
    });

    it('should open payment modal when upgrade button is clicked', async () => {
      // Mock free user
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });

      render(<AccountTab {...authenticatedProps} />);

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('Upgrade to Premium');
      fireEvent.click(upgradeButton);

      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
    });

    it('should close payment modal', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });

      render(<AccountTab {...authenticatedProps} />);

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('Upgrade to Premium');
      fireEvent.click(upgradeButton);

      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();

      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
    });

    it('should handle payment success', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });

      render(<AccountTab {...authenticatedProps} />);

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('Upgrade to Premium');
      fireEvent.click(upgradeButton);

      const paymentSuccessButton = screen.getByText('Mock Payment Success');
      fireEvent.click(paymentSuccessButton);

      expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
    });
  });

  describe('Subscription Management', () => {
    const premiumProps = {
      ...defaultProps,
      isAuthenticated: true,
      isFreeMode: false,
    };

    beforeEach(() => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({
        lastSyncTime: Date.now() - 60000,
        authToken: 'valid_token_123',
      });
    });

    it('should show upgrade button when subscription info is not loaded', async () => {
      // Mock fetch to fail or return no subscription
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      render(<AccountTab {...premiumProps} />);

      // Wait for the component to finish loading
      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show upgrade button when user has no subscription', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });

      render(<AccountTab {...premiumProps} />);

      // Wait for the component to load subscription info
      await waitFor(() => {
        expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      }, { timeout: 3000 });
    });




  });

  describe('Sync Time Display', () => {
    const authenticatedProps = {
      ...defaultProps,
      isAuthenticated: true,
      isFreeMode: false,
    };

    beforeEach(() => {
      // Mock fetch for subscription status to avoid interference
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hasSubscription: false,
          userType: 'free',
        }),
      });
    });

    it('should display "Just now" for recent sync', async () => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({
        lastSyncTime: Date.now() - 30000, // 30 seconds ago
        authToken: 'valid_token_123',
      });

      render(<AccountTab {...authenticatedProps} />);

      await waitFor(() => {
        expect(screen.getByText('Last sync:')).toBeInTheDocument();
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });


  });

  describe('Error Handling', () => {
    const authenticatedProps = {
      ...defaultProps,
      isAuthenticated: true,
      isFreeMode: false,
    };

    it('should handle subscription status API errors gracefully', async () => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      global.fetch.mockRejectedValue(new Error('Network error'));

      render(<AccountTab {...authenticatedProps} />);

      // Should not crash and should still render basic UI
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should handle missing auth token gracefully', async () => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({});

      render(<AccountTab {...authenticatedProps} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

  });

  describe('Fallback State', () => {
    it('should render loading state for edge cases', () => {
      const edgeCaseProps = {
        ...defaultProps,
        isAuthenticated: false,
        isFreeMode: false,
        data: { ...mockData, userInfo: null },
      };

      render(<AccountTab {...edgeCaseProps} />);

      expect(screen.getByText('Loading account information...')).toBeInTheDocument();
    });
  });
});
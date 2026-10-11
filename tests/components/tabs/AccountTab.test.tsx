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

// The component captures the browser API when it is imported, which happens
// before any statement in this file runs. So the tests configure the fakes
// that tests/setup.js already installed instead of replacing them.
const mockBrowserAPI = (global as any).browser;

// Mock fetch for API calls
global.fetch = jest.fn();
process.env.API_URL = 'http://localhost:3000';

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
    onUpgrade: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserAPI.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Free Mode Display', () => {
    it('should say what works without an account and what Premium adds', () => {
      render(<AccountTab {...defaultProps} />);

      expect(screen.getByText('No account')).toBeInTheDocument();
      expect(screen.getByText(/your data stays on this device/i)).toBeInTheDocument();
      expect(screen.getByText('Unlimited website blocking')).toBeInTheDocument();
      expect(screen.getByText(/\$4\.99\/month or \$49\.99\/year/)).toBeInTheDocument();
      // Nothing that does not exist is promised
      expect(screen.queryByText(/advertisement/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/priority support/i)).not.toBeInTheDocument();
    });

    it('should start the upgrade flow from the upgrade button', () => {
      render(<AccountTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Upgrade to Premium'));

      expect(defaultProps.onUpgrade).toHaveBeenCalled();
    });

    it('should open the sign-in screen for someone who already has an account', () => {
      render(<AccountTab {...defaultProps} />);

      fireEvent.click(screen.getByText('I already have an account'));

      expect(defaultProps.onAuth).toHaveBeenCalledWith(true);
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
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      // Sync controls appear once the plan is known to be Premium
      expect(await screen.findByText('Sync Now')).toBeInTheDocument();
    });

    it('should show when the plan renews', async () => {
      render(<AccountTab {...authenticatedProps} />);

      expect(await screen.findByText(/Renews on .*2022|Renews on .*2021/)).toBeInTheDocument();
    });

    it('should not claim to be synced before any sync has happened', async () => {
      mockBrowserAPI.storage.local.get.mockResolvedValue({ authToken: 'valid_token_123' });

      render(<AccountTab {...authenticatedProps} />);

      await screen.findByText('Sync Now');
      expect(screen.getByText('Never')).toBeInTheDocument();
      expect(screen.queryByText('Synced')).not.toBeInTheDocument();
    });

    it('should ask for confirmation before cancelling the subscription', async () => {
      render(<AccountTab {...authenticatedProps} />);

      fireEvent.click(await screen.findByText('Cancel Subscription'));

      expect(screen.getByText(/Cancel Premium\?/)).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('cancel-subscription'),
        expect.anything()
      );

      fireEvent.click(screen.getByText('Yes, cancel'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('cancel-subscription'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should keep the subscription when the confirmation is declined', async () => {
      render(<AccountTab {...authenticatedProps} />);

      fireEvent.click(await screen.findByText('Cancel Subscription'));
      fireEvent.click(screen.getByText('Keep Premium'));

      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('cancel-subscription'),
        expect.anything()
      );
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


    it('should say that a sync failed and why', async () => {
      mockBrowserAPI.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(<AccountTab {...authenticatedProps} />);

      fireEvent.click(await screen.findByText('Sync Now'));

      expect(await screen.findByText('Sync failed: Network error')).toBeInTheDocument();
      expect(screen.queryByText('Synced')).not.toBeInTheDocument();
    });

    it('should show synced only after a sync succeeded', async () => {
      mockBrowserAPI.runtime.sendMessage.mockResolvedValue({ success: true });

      render(<AccountTab {...authenticatedProps} />);

      fireEvent.click(await screen.findByText('Sync Now'));

      expect(await screen.findByText('Synced')).toBeInTheDocument();
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

  describe('Upgrade', () => {
    it('should start the upgrade flow for a signed-in free user and not offer sync', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasSubscription: false, userType: 'free' }),
      });
      mockBrowserAPI.storage.local.get.mockResolvedValue({ authToken: 'valid_token_123' });

      render(<AccountTab {...defaultProps} isAuthenticated={true} isFreeMode={true} />);

      fireEvent.click(await screen.findByText('Upgrade to Premium'));

      expect(defaultProps.onUpgrade).toHaveBeenCalled();
      expect(screen.getByText(/syncing is part of Premium/i)).toBeInTheDocument();
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
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
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasSubscription: true, userType: 'premium', status: 'active' }),
      });
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
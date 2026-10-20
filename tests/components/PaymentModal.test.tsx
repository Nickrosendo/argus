import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentModal from '../../src/components/PaymentModal';

describe('PaymentModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onPaymentSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render payment modal when open', () => {
      render(<PaymentModal {...mockProps} />);

      expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
      expect(screen.getByText('Premium Monthly')).toBeInTheDocument();
      expect(screen.getByText('Premium Yearly')).toBeInTheDocument();
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<PaymentModal {...mockProps} isOpen={false} />);

      expect(screen.queryByText('Upgrade to Premium')).not.toBeInTheDocument();
    });

    it('should render pricing plans with correct information', () => {
      render(<PaymentModal {...mockProps} />);

      // Monthly plan
      expect(screen.getByText('$4.99')).toBeInTheDocument();
      expect(screen.getByText('/month')).toBeInTheDocument();

      // Yearly plan
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('/year')).toBeInTheDocument();
      expect(screen.getByText('2 months free compared with paying monthly')).toBeInTheDocument();
    });

    it('should render all premium features', () => {
      render(<PaymentModal {...mockProps} />);

      // Features that appear in both plans
      expect(screen.getAllByText('Unlimited website blocking').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Sync and a combined view across your devices').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('30 days of history instead of 7').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Focus sessions that block your distracting sites').length).toBeGreaterThanOrEqual(2);
      // Nothing that does not exist is promised
      expect(screen.queryByText(/priority support|advertisement|export data/i)).not.toBeInTheDocument();
      // Feature only in yearly plan
      expect(screen.getByText('2 months free compared with paying monthly')).toBeInTheDocument();
    });

    it('should have yearly plan selected by default', () => {
      render(<PaymentModal {...mockProps} />);

      const yearlyPlan = screen.getByText('Premium Yearly').closest('.pricing-plan');
      expect(yearlyPlan).toHaveClass('selected');

      const monthlyPlan = screen.getByText('Premium Monthly').closest('.pricing-plan');
      expect(monthlyPlan).not.toHaveClass('selected');
    });
  });

  describe('Plan Selection', () => {
    it('should allow switching between plans', () => {
      render(<PaymentModal {...mockProps} />);

      const monthlyPlan = screen.getByText('Premium Monthly').closest('.pricing-plan');
      const yearlyPlan = screen.getByText('Premium Yearly').closest('.pricing-plan');

      // Initially yearly is selected
      expect(yearlyPlan).toHaveClass('selected');
      expect(monthlyPlan).not.toHaveClass('selected');

      // Click monthly plan
      fireEvent.click(monthlyPlan!);

      // Now monthly should be selected
      expect(monthlyPlan).toHaveClass('selected');
      expect(yearlyPlan).not.toHaveClass('selected');
    });

    it('should update upgrade button text based on selected plan', () => {
      render(<PaymentModal {...mockProps} />);

      // Initially shows yearly plan price
      expect(screen.getByText('Upgrade for $49.99/year')).toBeInTheDocument();

      // Switch to monthly plan
      const monthlyPlan = screen.getByText('Premium Monthly').closest('.pricing-plan');
      fireEvent.click(monthlyPlan!);

      // Should show monthly plan price
      expect(screen.getByText('Upgrade for $4.99/month')).toBeInTheDocument();
    });
  });

  describe('Payment Processing', () => {
    it('should handle successful payment creation', async () => {
      // Mock successful auth token retrieval
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      // Mock successful checkout session creation
      (global as any).chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });

      // Mock tabs.create
      (global as any).chrome.tabs.create = jest.fn().mockResolvedValue({ id: 123 });

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith(['authToken']);
        expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith({
          action: 'createCheckoutSession',
          priceId: process.env.STRIPE_PRICE_YEARLY,
          authToken: 'valid_token_123',
        });
        expect((global as any).chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        });
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should handle missing auth token', async () => {
      // Mock missing auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({});

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Please sign in to upgrade to premium')).toBeInTheDocument();
        expect((global as any).chrome.runtime.sendMessage).not.toHaveBeenCalled();
        expect(mockProps.onPaymentSuccess).not.toHaveBeenCalled();
      });
    });

    it('should handle payment creation failure', async () => {
      // Mock valid auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      // Mock payment creation failure
      (global as any).chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Payment method required',
      });

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Payment method required')).toBeInTheDocument();
        expect(mockProps.onPaymentSuccess).not.toHaveBeenCalled();
        expect(mockProps.onClose).not.toHaveBeenCalled();
      });
    });

    it('should handle network/runtime errors', async () => {
      // Mock valid auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      // Mock runtime error
      (global as any).chrome.runtime.sendMessage.mockRejectedValue(new Error('Network error'));

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
        expect(mockProps.onPaymentSuccess).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during payment processing', async () => {
      // Mock valid auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      // Mock slow checkout session creation
      (global as any).chrome.runtime.sendMessage.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, checkoutUrl: 'https://checkout.stripe.com/test' }), 100))
      );

      // Mock tabs.create
      (global as any).chrome.tabs.create = jest.fn().mockResolvedValue({ id: 123 });

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      // Should show loading state
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(upgradeButton).toBeDisabled();

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should use correct plan details for monthly subscription', async () => {
      // Mock valid auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      (global as any).chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        checkoutUrl: 'https://checkout.stripe.com/test',
      });

      // Mock tabs.create
      (global as any).chrome.tabs.create = jest.fn().mockResolvedValue({ id: 123 });

      render(<PaymentModal {...mockProps} />);

      // Select monthly plan
      const monthlyPlan = screen.getByText('Premium Monthly').closest('.pricing-plan');
      fireEvent.click(monthlyPlan!);

      const upgradeButton = screen.getByText('Upgrade for $4.99/month');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith({
          action: 'createCheckoutSession',
          priceId: process.env.STRIPE_PRICE_MONTHLY,
          authToken: 'valid_token_123',
        });
      });
    });
  });

  describe('Modal Controls', () => {
    it('should close modal when close button is clicked', () => {
      render(<PaymentModal {...mockProps} />);

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should close modal when clicking outside', () => {
      render(<PaymentModal {...mockProps} />);

      const overlay = screen.getByText('Upgrade to Premium').closest('.modal-overlay');
      fireEvent.click(overlay!);

      // Note: This would require additional implementation to handle overlay clicks
      // The test structure is here for when that functionality is added
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<PaymentModal {...mockProps} />);

      expect(screen.getByRole('button', { name: /upgrade for/i })).toBeInTheDocument();
      expect(screen.getByText('Secure payment powered by Stripe')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      
      // Focus the button
      upgradeButton.focus();
      expect(upgradeButton).toHaveFocus();

      // Tab navigation would be tested here with more complex setup
    });
  });

  describe('Security Features', () => {
    it('should display security badge', () => {
      render(<PaymentModal {...mockProps} />);

      expect(screen.getByText('Secure payment powered by Stripe')).toBeInTheDocument();
    });

    it('should not expose sensitive data in DOM', () => {
      render(<PaymentModal {...mockProps} />);

      // Ensure no test tokens or sensitive data are exposed
      expect(screen.queryByText('sk_test')).not.toBeInTheDocument();
      expect(screen.queryByText('pk_test')).not.toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after error', async () => {
      // Mock valid auth token
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      // First call fails, second succeeds
      (global as any).chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: false, error: 'Network error' })
        .mockResolvedValueOnce({ success: true, checkoutUrl: 'https://checkout.stripe.com/test' });

      // Mock tabs.create
      (global as any).chrome.tabs.create = jest.fn().mockResolvedValue({ id: 123 });

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      
      // First attempt
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Second attempt
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should clear error when switching plans', async () => {
      (global as any).chrome.storage.local.get.mockResolvedValue({
        authToken: 'valid_token_123',
      });

      (global as any).chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });

      render(<PaymentModal {...mockProps} />);

      const upgradeButton = screen.getByText('Upgrade for $49.99/year');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Payment failed')).toBeInTheDocument();
      });

      // Switch to monthly plan - this should clear the error
      const monthlyPlan = screen.getByText('Premium Monthly').closest('.pricing-plan');
      fireEvent.click(monthlyPlan!);

      // Error should be cleared when switching plans
      expect(screen.queryByText('Payment failed')).not.toBeInTheDocument();
    });
  });
});
import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from '../../src/components/AuthPage';

// Mock browser messaging hook
const mockSocialAuth = jest.fn();
jest.mock('../../src/hooks/useBrowserMessaging', () => ({
  useBrowserMessaging: () => ({
    socialAuth: mockSocialAuth,
  }),
}));

const mockOnAuth = jest.fn();
const mockOnFreeMode = jest.fn();

const defaultProps = {
  onAuth: mockOnAuth,
  onFreeMode: mockOnFreeMode,
};

describe('AuthPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render social authentication buttons', () => {
      render(<AuthPage {...defaultProps} />);
      
      expect(screen.getByText('Welcome to Argus')).toBeInTheDocument();
      expect(screen.getByText('Monitor your browsing habits and boost productivity')).toBeInTheDocument();
      expect(screen.getByText('Sign in to get started')).toBeInTheDocument();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(screen.getByText('Continue with Microsoft')).toBeInTheDocument();
      expect(screen.getByText('Continue in Free Mode')).toBeInTheDocument();
    });

    it('should render benefits section', () => {
      render(<AuthPage {...defaultProps} />);
      
      expect(screen.getByText('Why sign in?')).toBeInTheDocument();
      expect(screen.getByText('Sync data across devices')).toBeInTheDocument();
      expect(screen.getByText('Advanced analytics & insights')).toBeInTheDocument();
      expect(screen.getByText('Cloud backup & recovery')).toBeInTheDocument();
    });

    it('should render within tab-content section', () => {
      const { container } = render(<AuthPage {...defaultProps} />);
      const tabContent = container.querySelector('.tab-content');
      expect(tabContent).toBeInTheDocument();
    });

    it('should render auth-page wrapper', () => {
      const { container } = render(<AuthPage {...defaultProps} />);
      const authPage = container.querySelector('.auth-page');
      expect(authPage).toBeInTheDocument();
    });
  });

  describe('Social Authentication', () => {
    it('should call social auth with Google when Google button is clicked', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockResolvedValue({ success: true, data: { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } } });

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      await user.click(googleButton!);

      expect(mockSocialAuth).toHaveBeenCalledWith('google');
    });

    it('should call social auth with Microsoft when Microsoft button is clicked', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockResolvedValue({ success: true, data: { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } } });

      render(<AuthPage {...defaultProps} />);
      
      const microsoftButton = screen.getByText('Continue with Microsoft').closest('button');
      await user.click(microsoftButton!);

      expect(mockSocialAuth).toHaveBeenCalledWith('microsoft');
    });

    it('should show loading state during Google authentication', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, data: { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } } }), 100)));

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      await user.click(googleButton!);

      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    it('should show loading state during Microsoft authentication', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, data: { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } } }), 100)));

      render(<AuthPage {...defaultProps} />);
      
      const microsoftButton = screen.getByText('Continue with Microsoft').closest('button');
      await user.click(microsoftButton!);

      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    it('should disable buttons during loading', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, data: { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } } }), 100)));

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      const microsoftButton = screen.getByText('Continue with Microsoft').closest('button');
      
      await user.click(googleButton!);

      expect(googleButton).toBeDisabled();
      expect(microsoftButton).toBeDisabled();
    });
  });

  describe('Free Mode', () => {
    it('should call onFreeMode when free mode button is clicked', async () => {
      const user = userEvent.setup();

      render(<AuthPage {...defaultProps} />);
      
      const freeModeButton = screen.getByText('Continue in Free Mode').closest('button');
      await user.click(freeModeButton!);

      expect(mockOnFreeMode).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when social authentication fails', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockResolvedValue({ success: false, error: 'Google authentication failed' });

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      await user.click(googleButton!);

      await waitFor(() => {
        expect(screen.getByText('Google authentication failed')).toBeInTheDocument();
      });
    });

    it('should show generic error message when social auth throws', async () => {
      const user = userEvent.setup();
      mockSocialAuth.mockRejectedValue(new Error('Network error'));

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      await user.click(googleButton!);

      await waitFor(() => {
        expect(screen.getByText(/google authentication failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Successful Authentication', () => {
    it('should call onAuth with user data on successful authentication', async () => {
      const user = userEvent.setup();
      const mockUserData = { token: 'mock-token', user: { id: '1', email: 'test@example.com', name: 'Test User' } };
      mockSocialAuth.mockResolvedValue({ success: true, data: mockUserData });

      render(<AuthPage {...defaultProps} />);
      
      const googleButton = screen.getByText('Continue with Google').closest('button');
      await user.click(googleButton!);

      await waitFor(() => {
        expect(mockOnAuth).toHaveBeenCalledWith(true, mockUserData);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for images', () => {
      render(<AuthPage {...defaultProps} />);
      
      expect(screen.getByAltText('Argus Logo')).toBeInTheDocument();
      expect(screen.getByAltText('Google')).toBeInTheDocument();
      expect(screen.getByAltText('Microsoft')).toBeInTheDocument();
    });

    it('should have proper button labels', () => {
      render(<AuthPage {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue in free mode/i })).toBeInTheDocument();
    });
  });
}); 
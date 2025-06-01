import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Header from '../../src/components/Header';

describe('Header Component', () => {
  const mockOnTabChange = jest.fn();

  const defaultProps = {
    activeTab: 'today' as const,
    onTabChange: mockOnTabChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render logo and title', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByAltText('Argus Logo')).toBeInTheDocument();
      expect(screen.getByText('Argus')).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('src', 'icons/icon48.png');
    });

    it('should render all tab buttons', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    it('should render navigation with proper structure', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header element
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // nav element
    });
  });

  describe('Active Tab State', () => {
    it('should highlight the today tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="today" />);
      
      const todayButton = screen.getByText('Today');
      expect(todayButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByText('Stats')).not.toHaveClass('active');
      expect(screen.getByText('History')).not.toHaveClass('active');
      expect(screen.getByText('Settings')).not.toHaveClass('active');
      expect(screen.getByText('Account')).not.toHaveClass('active');
    });

    it('should highlight the stats tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="stats" />);
      
      const statsButton = screen.getByText('Stats');
      expect(statsButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByText('Today')).not.toHaveClass('active');
      expect(screen.getByText('History')).not.toHaveClass('active');
      expect(screen.getByText('Settings')).not.toHaveClass('active');
      expect(screen.getByText('Account')).not.toHaveClass('active');
    });

    it('should highlight the history tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="history" />);
      
      const historyButton = screen.getByText('History');
      expect(historyButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByText('Today')).not.toHaveClass('active');
      expect(screen.getByText('Stats')).not.toHaveClass('active');
      expect(screen.getByText('Settings')).not.toHaveClass('active');
      expect(screen.getByText('Account')).not.toHaveClass('active');
    });

    it('should highlight the settings tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="settings" />);
      
      const settingsButton = screen.getByText('Settings');
      expect(settingsButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByText('Today')).not.toHaveClass('active');
      expect(screen.getByText('Stats')).not.toHaveClass('active');
      expect(screen.getByText('History')).not.toHaveClass('active');
      expect(screen.getByText('Account')).not.toHaveClass('active');
    });

    it('should highlight the account tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="account" />);
      
      const accountButton = screen.getByText('Account');
      expect(accountButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByText('Today')).not.toHaveClass('active');
      expect(screen.getByText('Stats')).not.toHaveClass('active');
      expect(screen.getByText('History')).not.toHaveClass('active');
      expect(screen.getByText('Settings')).not.toHaveClass('active');
    });
  });

  describe('Tab Navigation', () => {
    it('should call onTabChange with today when Today tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);
      
      await user.click(screen.getByText('Today'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('today');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with stats when Stats tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="today" />);
      
      await user.click(screen.getByText('Stats'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('stats');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with history when History tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="today" />);
      
      await user.click(screen.getByText('History'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('history');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with settings when Settings tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="today" />);
      
      await user.click(screen.getByText('Settings'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('settings');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with account when Account tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="today" />);
      
      await user.click(screen.getByText('Account'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('account');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange even when clicking the already active tab', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="today" />);
      
      await user.click(screen.getByText('Today'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('today');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Button Properties', () => {
    it('should render all tabs as buttons', () => {
      render(<Header {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
      
      buttons.forEach(button => {
        expect(button).toHaveClass('tab-btn');
      });
    });

    it('should apply correct CSS classes to all buttons', () => {
      render(<Header {...defaultProps} activeTab="stats" />);
      
      const todayButton = screen.getByText('Today');
      const statsButton = screen.getByText('Stats');
      const historyButton = screen.getByText('History');
      const settingsButton = screen.getByText('Settings');
      const accountButton = screen.getByText('Account');
      
      expect(todayButton).toHaveClass('tab-btn');
      expect(todayButton).not.toHaveClass('active');
      
      expect(statsButton).toHaveClass('tab-btn', 'active');
      
      expect(historyButton).toHaveClass('tab-btn');
      expect(historyButton).not.toHaveClass('active');
      
      expect(settingsButton).toHaveClass('tab-btn');
      expect(settingsButton).not.toHaveClass('active');
      
      expect(accountButton).toHaveClass('tab-btn');
      expect(accountButton).not.toHaveClass('active');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle keyboard navigation for tabs', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} />);
      
      const todayButton = screen.getByText('Today');
      
      // Focus the first tab
      todayButton.focus();
      expect(todayButton).toHaveFocus();
      
      // Press Enter to activate
      await user.keyboard('{Enter}');
      
      expect(mockOnTabChange).toHaveBeenCalledWith('today');
    });

    it('should handle space key activation for tabs', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} />);
      
      const statsButton = screen.getByText('Stats');
      
      // Focus the stats tab
      statsButton.focus();
      expect(statsButton).toHaveFocus();
      
      // Press Space to activate
      await user.keyboard(' ');
      
      expect(mockOnTabChange).toHaveBeenCalledWith('stats');
    });
  });

  describe('State Updates', () => {
    it('should properly update active state when activeTab prop changes', () => {
      const { rerender } = render(<Header {...defaultProps} activeTab="today" />);
      
      expect(screen.getByText('Today')).toHaveClass('active');
      expect(screen.getByText('Stats')).not.toHaveClass('active');
      
      rerender(<Header {...defaultProps} activeTab="stats" />);
      
      expect(screen.getByText('Today')).not.toHaveClass('active');
      expect(screen.getByText('Stats')).toHaveClass('active');
    });

    it('should maintain tab order regardless of active tab', () => {
      const { rerender } = render(<Header {...defaultProps} activeTab="today" />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('Today');
      expect(buttons[1]).toHaveTextContent('Stats');
      expect(buttons[2]).toHaveTextContent('History');
      expect(buttons[3]).toHaveTextContent('Settings');
      expect(buttons[4]).toHaveTextContent('Account');
      
      rerender(<Header {...defaultProps} activeTab="account" />);
      
      const updatedButtons = screen.getAllByRole('button');
      expect(updatedButtons[0]).toHaveTextContent('Today');
      expect(updatedButtons[1]).toHaveTextContent('Stats');
      expect(updatedButtons[2]).toHaveTextContent('History');
      expect(updatedButtons[3]).toHaveTextContent('Settings');
      expect(updatedButtons[4]).toHaveTextContent('Account');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // nav
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('should have proper heading structure', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Argus');
    });

    it('should have proper alt text for logo', () => {
      render(<Header {...defaultProps} />);
      
      const logo = screen.getByAltText('Argus Logo');
      expect(logo).toBeInTheDocument();
    });
  });
}); 
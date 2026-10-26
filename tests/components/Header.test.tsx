import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Header from '../../src/components/Header';


describe('Header Component', () => {
  const mockOnTabChange = jest.fn();
  const mockOnToggleSettings = jest.fn();

  const defaultProps = {
    activeTab: 'stats' as const,
    onTabChange: mockOnTabChange,
    onToggleSettings: mockOnToggleSettings,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render all tab buttons with correct aria-labels', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByLabelText('Stats')).toBeInTheDocument();
      expect(screen.getByLabelText('History')).toBeInTheDocument();
      expect(screen.getByLabelText('Sites')).toBeInTheDocument();
      expect(screen.getByLabelText('Focus')).toBeInTheDocument();
    });

    it('should render navigation with proper structure', () => {
      render(<Header {...defaultProps} />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header element
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // nav element
    });

    it('renders the four tabs with no lock icon and no Premium label', () => {
      render(<Header {...defaultProps} />);

      expect(screen.queryByLabelText(/premium/i)).not.toBeInTheDocument();
      expect(document.querySelector('.tab-lock')).toBeNull();
      expect(screen.queryByText(/premium/i)).not.toBeInTheDocument();
    });
  });

  describe('Active Tab State', () => {
    it('should highlight the stats tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="stats" />);
      
      const statsButton = screen.getByLabelText('Stats');
      expect(statsButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByLabelText('History')).not.toHaveClass('active');
      expect(screen.getByLabelText('Sites')).not.toHaveClass('active');
      expect(screen.getByLabelText('Focus')).not.toHaveClass('active');
    });

    it('should highlight the history tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="history" />);
      
      const historyButton = screen.getByLabelText('History');
      expect(historyButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByLabelText('Stats')).not.toHaveClass('active');
      expect(screen.getByLabelText('Sites')).not.toHaveClass('active');
      expect(screen.getByLabelText('Focus')).not.toHaveClass('active');
    });

    it('should highlight the sites tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="sites" />);
      
      const sitesButton = screen.getByLabelText('Sites');
      expect(sitesButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByLabelText('Stats')).not.toHaveClass('active');
      expect(screen.getByLabelText('History')).not.toHaveClass('active');
      expect(screen.getByLabelText('Focus')).not.toHaveClass('active');
    });

    it('should highlight the focus tab when it is active', () => {
      render(<Header {...defaultProps} activeTab="focus" />);
      
      const focusButton = screen.getByLabelText('Focus');
      expect(focusButton).toHaveClass('active');
      
      // Other tabs should not be active
      expect(screen.getByLabelText('Stats')).not.toHaveClass('active');
      expect(screen.getByLabelText('History')).not.toHaveClass('active');
      expect(screen.getByLabelText('Sites')).not.toHaveClass('active');
    });

    it('marks the gear as pressed while Settings is open', () => {
      render(<Header {...defaultProps} activeTab="settings" />);

      expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Stats')).not.toHaveClass('active');
    });

    it('leaves the gear unpressed on a content tab', () => {
      render(<Header {...defaultProps} activeTab="stats" />);

      expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Tab Navigation', () => {
    it('should call onTabChange with stats when Stats tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="history" />);
      
      await user.click(screen.getByLabelText('Stats'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('stats');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with history when History tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);
      
      await user.click(screen.getByLabelText('History'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('history');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with sites when Sites tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);
      
      await user.click(screen.getByLabelText('Sites'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('sites');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange with focus when Focus tab is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);
      
      await user.click(screen.getByLabelText('Focus'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('focus');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleSettings when the gear is clicked', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));

      expect(mockOnToggleSettings).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange even when clicking the already active tab', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} activeTab="stats" />);
      
      await user.click(screen.getByLabelText('Stats'));
      
      expect(mockOnTabChange).toHaveBeenCalledWith('stats');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Button Properties', () => {
    it('should render navigation tabs as buttons', () => {
      render(<Header {...defaultProps} />);
      
      // There should be 4 navigation tab buttons (stats, history, sites, focus)
      const tabButtons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label') && 
        ['Stats', 'History', 'Sites', 'Focus'].indexOf(button.getAttribute('aria-label')!) !== -1
      );
      expect(tabButtons).toHaveLength(4);
      
      tabButtons.forEach(button => {
        expect(button).toHaveClass('nav-icon-btn');
      });
    });

    it('should apply correct CSS classes to all navigation buttons', () => {
      render(<Header {...defaultProps} activeTab="history" />);
      
      const statsButton = screen.getByLabelText('Stats');
      const historyButton = screen.getByLabelText('History');
      const sitesButton = screen.getByLabelText('Sites');
      const focusButton = screen.getByLabelText('Focus');
      
      expect(statsButton).toHaveClass('nav-icon-btn');
      expect(statsButton).not.toHaveClass('active');
      
      expect(historyButton).toHaveClass('nav-icon-btn', 'active');
      
      expect(sitesButton).toHaveClass('nav-icon-btn');
      expect(sitesButton).not.toHaveClass('active');
      
      expect(focusButton).toHaveClass('nav-icon-btn');
      expect(focusButton).not.toHaveClass('active');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable with keyboard', () => {
      render(<Header {...defaultProps} activeTab="stats" />);
      
      const statsButton = screen.getByLabelText('Stats');
      const historyButton = screen.getByLabelText('History');
      const sitesButton = screen.getByLabelText('Sites');
      const focusButton = screen.getByLabelText('Focus');
      
      // All buttons should be focusable (buttons are focusable by default)
      expect(statsButton.tagName).toBe('BUTTON');
      expect(historyButton.tagName).toBe('BUTTON');
      expect(sitesButton.tagName).toBe('BUTTON');
      expect(focusButton.tagName).toBe('BUTTON');
    });

    it('should handle keyboard navigation for tabs', () => {
      render(<Header {...defaultProps} />);
      
      const statsButton = screen.getByLabelText('Stats');
      
      // Focus the first tab
      statsButton.focus();
      expect(document.activeElement).toBe(statsButton);
      
      // Simulate arrow key navigation (this would depend on the actual implementation)
      fireEvent.keyDown(statsButton, { key: 'ArrowRight' });
      // Note: The actual keyboard navigation behavior would depend on the Header implementation
    });
  });

  describe('State Updates', () => {
    it('should properly update active state when activeTab prop changes', () => {
      const { rerender } = render(<Header {...defaultProps} activeTab="stats" />);
      
      expect(screen.getByLabelText('Stats')).toHaveClass('active');
      expect(screen.getByLabelText('History')).not.toHaveClass('active');
      
      rerender(<Header {...defaultProps} activeTab="history" />);
      
      expect(screen.getByLabelText('Stats')).not.toHaveClass('active');
      expect(screen.getByLabelText('History')).toHaveClass('active');
    });

    it('should maintain tab order regardless of active tab', () => {
      render(<Header {...defaultProps} activeTab="focus" />);
      
      const buttons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label') && 
        ['Stats', 'History', 'Sites', 'Focus'].indexOf(button.getAttribute('aria-label')!) !== -1
      );
      
      expect(buttons[0]).toHaveAttribute('aria-label', 'Stats');
      expect(buttons[1]).toHaveAttribute('aria-label', 'History');
      expect(buttons[2]).toHaveAttribute('aria-label', 'Sites');
      expect(buttons[3]).toHaveAttribute('aria-label', 'Focus');
    });
  });
}); 

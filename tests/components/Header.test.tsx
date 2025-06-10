import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Header from '../../src/components/Header';

const defaultProps = {
  activeTab: 'stats' as const,
  onTabChange: jest.fn(),
  onMenuAction: jest.fn(),
  isAuthenticated: false,
  isFreeMode: true,
};

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders logo and navigation buttons', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByAltText('Argus Logo')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('highlights the active tab', () => {
    render(<Header {...defaultProps} activeTab="history" />);

    const historyButton = screen.getByLabelText('History');
    expect(historyButton).toHaveClass('active');
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    render(<Header {...defaultProps} />);

    await user.click(screen.getByLabelText('Sites'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('sites');
  });
});

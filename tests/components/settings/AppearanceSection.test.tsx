import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AppearanceSection from '../../../src/components/settings/AppearanceSection';

const mockSystemDark = (dark: boolean): void => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as any;
};

describe('AppearanceSection', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows System pressed by default', () => {
    mockSystemDark(false);
    render(<AppearanceSection value="system" onChange={jest.fn()} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with dark when Dark is clicked', () => {
    mockSystemDark(false);
    const onChange = jest.fn();
    render(<AppearanceSection value="system" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('says what System follows right now', () => {
    mockSystemDark(false);
    const { unmount } = render(<AppearanceSection value="system" onChange={jest.fn()} />);
    expect(screen.getByText('Following your computer: light right now')).toBeInTheDocument();
    unmount();

    mockSystemDark(true);
    render(<AppearanceSection value="system" onChange={jest.fn()} />);
    expect(screen.getByText('Following your computer: dark right now')).toBeInTheDocument();
  });

  it('says Always light or Always dark for a manual choice', () => {
    mockSystemDark(true);
    const { rerender } = render(<AppearanceSection value="light" onChange={jest.fn()} />);
    expect(screen.getByText('Always light')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<AppearanceSection value="dark" onChange={jest.fn()} />);
    expect(screen.getByText('Always dark')).toBeInTheDocument();
  });
});

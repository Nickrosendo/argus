import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Footer from '../../src/components/Footer';
import { DONATE_URL, SOURCE_URL, PRIVACY_URL } from '../../src/lib/links';

// Mock package.json
jest.mock('../../package.json', () => ({
  version: '1.0.1'
}), { virtual: true });

describe('Footer Component', () => {
  it('renders the version', () => {
    render(<Footer />);
    expect(screen.getByText('v1.0.1')).toBeInTheDocument();
  });

  it.each([
    ['Donate', DONATE_URL],
    ['Source code', SOURCE_URL],
    ['Privacy', PRIVACY_URL],
  ])('links %s to its URL in a new tab', (name, href) => {
    render(<Footer />);
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has a footer element', () => {
    render(<Footer />);
    expect(document.querySelector('footer')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import SupportSection from '../../../src/components/settings/SupportSection';
import { DONATE_URL, SOURCE_URL } from '../../../src/lib/links';

describe('SupportSection', () => {
  it('renders the text, a Donate link and the source link', () => {
    render(<SupportSection />);
    expect(screen.getByText('Support Argus')).toBeInTheDocument();
    expect(screen.getByText(
      'Argus is free and open source, made by one person. If it helps you, you can support it.'
    )).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Donate' })).toHaveAttribute('href', DONATE_URL);
    expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', SOURCE_URL);
  });
});

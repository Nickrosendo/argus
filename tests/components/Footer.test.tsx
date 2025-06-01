import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Footer from '../../src/components/Footer';

describe('Footer Component', () => {
  describe('Rendering', () => {
    it('should render the footer component', () => {
      render(<Footer />);
      
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    });

    it('should render version information', () => {
      render(<Footer />);
      
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('should render privacy policy link', () => {
      render(<Footer />);
      
      const privacyLink = screen.getByText('Privacy Policy');
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', 'https://argus-privacy.com');
      expect(privacyLink).toHaveAttribute('target', '_blank');
      expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<Footer />);
      
      const footerElement = document.querySelector('footer');
      expect(footerElement).toBeInTheDocument();
    });

    it('should have proper link attributes for security', () => {
      render(<Footer />);
      
      const privacyLink = screen.getByText('Privacy Policy');
      expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
}); 
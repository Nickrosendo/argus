import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SiteIcon from '../../src/components/ui/SiteIcon';

// The component reads the browser API that tests/setup.js installed
const runtime = (global as any).browser.runtime;

describe('SiteIcon', () => {
  const withFaviconPermission = (granted: boolean) => {
    runtime.getManifest = jest.fn(() => ({ permissions: granted ? ['storage', 'favicon'] : ['storage'] }));
  };

  afterEach(() => {
    delete runtime.getManifest;
  });

  it("should use the browser's cached icon for the site when the permission is held", () => {
    withFaviconPermission(true);

    const { container } = render(<SiteIcon domain="github.com" favicon="https://github.com/favicon.ico" />);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(
      'chrome-extension://test//_favicon/?pageUrl=https%3A%2F%2Fgithub.com&size=32'
    );
  });

  it('should fall back to the recorded icon address, then to the initial', () => {
    withFaviconPermission(true);
    const { container } = render(<SiteIcon domain="github.com" favicon="https://github.com/favicon.ico" />);

    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('https://github.com/favicon.ico');

    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('G');
  });

  it('should use the recorded icon address where the browser offers no icon service', () => {
    withFaviconPermission(false);

    const { container } = render(<SiteIcon domain="github.com" favicon="https://github.com/favicon.ico" />);

    expect(container.querySelector('img')!.getAttribute('src')).toBe('https://github.com/favicon.ico');
  });

  it('should show the initial when there is no icon at all', () => {
    withFaviconPermission(false);

    const { container } = render(<SiteIcon domain="example.org" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('E');
  });

  it('should not break when the manifest cannot be read', () => {
    const { container } = render(<SiteIcon domain="example.org" />);

    expect(container.textContent).toBe('E');
  });
});

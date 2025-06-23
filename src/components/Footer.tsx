import React from 'react';
// @ts-ignore
import packageJson from '../../package.json';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="version">v{packageJson.version}</div>
      <a href="https://argus-privacy.com" target="_blank" rel="noopener noreferrer" className="privacy-link">
        Privacy Policy
      </a>
    </footer>
  );
};

export default Footer; 
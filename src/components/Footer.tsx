import React from 'react';
// @ts-ignore
import packageJson from '../../package.json';
import DonateButton from './ui/DonateButton';
import { SOURCE_URL, PRIVACY_URL } from '../lib/links';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="version">v{packageJson.version}</div>
      <DonateButton />
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source code</a>
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="privacy-link">Privacy</a>
    </footer>
  );
};

export default Footer;

import React from 'react';
import DonateButton from '../ui/DonateButton';
import { SOURCE_URL } from '../../lib/links';

const SupportSection: React.FC = () => (
  <div className="setting-section">
    <h3>Support Argus</h3>
    <p className="setting-note">
      Argus is free and open source, made by one person. If it helps you, you can support it.
    </p>
    <div className="support-actions">
      <DonateButton />
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source code</a>
    </div>
  </div>
);

export default SupportSection;

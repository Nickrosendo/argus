import React from 'react';
import { Heart } from 'lucide-react';
import { DONATE_URL } from '../../lib/links';

interface DonateButtonProps {
  className?: string;
}

const DonateButton: React.FC<DonateButtonProps> = ({ className }) => (
  <a
    href={DONATE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={['donate-btn', className].filter(Boolean).join(' ')}
  >
    <Heart size={14} aria-hidden="true" />
    Donate
  </a>
);

export default DonateButton;

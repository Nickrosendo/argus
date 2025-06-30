import React from 'react';
import { Lock } from 'lucide-react';

interface LockIconProps {
  className?: string;
  size?: number;
}

const LockIcon: React.FC<LockIconProps> = ({ className = '', size = 16 }) => {
  return (
    <div className={`lock-icon-wrapper ${className}`}>
      <Lock size={size} className="lock-icon" />
    </div>
  );
};

export default LockIcon;
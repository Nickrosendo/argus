import React from 'react';
import { Lock, Crown } from 'lucide-react';

interface UpgradePromptProps {
  featureName: string;
  description: string;
  onUpgrade: () => void;
  className?: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ 
  featureName, 
  description, 
  onUpgrade,
  className = ''
}) => {
  return (
    <div className={`upgrade-prompt ${className}`}>
      <div className="upgrade-content">
        <div className="upgrade-icon">
          <Lock className="lock-icon" size={32} />
          <Crown className="crown-icon" size={20} />
        </div>
        
        <h3 className="upgrade-title">{featureName} - Premium Feature</h3>
        <p className="upgrade-description">{description}</p>
        
        <div className="upgrade-benefits">
          <h4>Upgrade to Premium for:</h4>
          <ul>
            <li>Access to all advanced features</li>
            <li>Cloud sync across devices</li>
            <li>No advertisements</li>
            <li>Priority support</li>
          </ul>
        </div>
        
        <button 
          className="upgrade-button"
          onClick={onUpgrade}
        >
          <Crown size={16} />
          Upgrade to Premium
        </button>
      </div>
    </div>
  );
};

export default UpgradePrompt;
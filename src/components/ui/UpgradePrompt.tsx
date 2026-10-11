import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { PREMIUM_FEATURES, PRICE_SUMMARY } from '../../lib/plans';

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
        
        <h3 className="upgrade-title">{featureName} is part of Premium</h3>
        <p className="upgrade-description">{description}</p>
        
        <div className="upgrade-benefits">
          <h4>Premium includes:</h4>
          <ul>
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        
        <button 
          className="upgrade-button"
          onClick={onUpgrade}
        >
          <Crown size={16} />
          Upgrade to Premium
        </button>
        <p className="upgrade-price">{PRICE_SUMMARY}. Cancel any time.</p>
      </div>
    </div>
  );
};

export default UpgradePrompt;
import React, { useState } from 'react';
import { UserInfo } from '../types/storage';
import { useBrowserMessaging } from '../hooks/useBrowserMessaging';
import { PREMIUM_FEATURES, PRICE_SUMMARY } from '../lib/plans';

interface UserData {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface AuthPageProps {
  onAuth: (isAuthenticated: boolean, userData?: UserData) => void;
  onFreeMode: () => void;
  // True when the user got here by choosing to upgrade
  upgradeIntent?: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuth, onFreeMode, upgradeIntent = false }) => {
  const [socialLoading, setSocialLoading] = useState<{ google: boolean; microsoft: boolean }>({
    google: false,
    microsoft: false
  });
  const [errors, setErrors] = useState<{ general?: string }>({});
  
  const { socialAuth } = useBrowserMessaging();
  
  // Feature flag for Microsoft auth
  const isMicrosoftAuthEnabled = false;

  const handleSocialAuth = async (provider: 'google' | 'microsoft'): Promise<void> => {
    setSocialLoading(prev => ({ ...prev, [provider]: true }));
    setErrors({});

    try {
      const response = await socialAuth(provider);
      
      if (response.success && response.data) {
        const userData: UserData = {
          token: response.data.token,
          user: response.data.user
        };
        
        onAuth(true, userData);
      } else {
        setErrors({
          general: response.error || `${provider} authentication failed. Please try again.`
        });
      }
    } catch (error) {
      console.error(`${provider} authentication error:`, error);
      setErrors({
        general: `${provider} authentication failed. Please check your connection and try again.`
      });
    } finally {
      setSocialLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  return (
    <section className="tab-content">
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <img src="icons/icon128.png" alt="Argus Logo" className="auth-logo" />
            <h2 className="auth-title">{upgradeIntent ? 'Upgrade to Premium' : 'Sign in to Argus'}</h2>
            <p className="auth-subtitle">
              {upgradeIntent
                ? `Step 1 of 2: sign in so your subscription is tied to you. Premium is ${PRICE_SUMMARY}.`
                : 'An account is only needed for Premium. Argus works without one.'}
            </p>
          </div>

          {/* Social Authentication Section */}
          <div className="social-auth-section">
            <h3 className="social-auth-title">{upgradeIntent ? 'Sign in, then choose a plan' : 'Sign in'}</h3>
            
            <button 
              className="social-auth-btn google-btn"
              onClick={() => handleSocialAuth('google')}
              disabled={socialLoading.google || socialLoading.microsoft}
            >
              <div className="social-btn-content">
                {socialLoading.google ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" className="social-icon" />
                )}
                <span>{socialLoading.google ? 'Signing in...' : 'Continue with Google'}</span>
              </div>
            </button>
            
            {isMicrosoftAuthEnabled && (
              <button 
                className="social-auth-btn microsoft-btn"
                onClick={() => handleSocialAuth('microsoft')}
                disabled={socialLoading.google || socialLoading.microsoft}
              >
                <div className="social-btn-content">
                  {socialLoading.microsoft ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <img src="https://img.icons8.com/color/16/000000/microsoft.png" alt="Microsoft" className="social-icon" />
                  )}
                  <span>{socialLoading.microsoft ? 'Signing in...' : 'Continue with Microsoft'}</span>
                </div>
              </button>
            )}
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="auth-error">
              <svg className="error-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.general}
            </div>
          )}

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Free Mode Option */}
          <button className="free-mode-btn" onClick={onFreeMode}>
            <div className="free-mode-content">
              <svg className="free-mode-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414-1.414L9 5.586 7.707 4.293a1 1 0 00-1.414 1.414L8.586 8l-2.293 2.293a1 1 0 101.414 1.414L9 10.414l2.293 2.293a1 1 0 001.414-1.414L10.414 9l2.293-2.293a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              <span>{upgradeIntent ? 'Not now' : 'Continue without an account'}</span>
            </div>
            <small>Free: today's stats, 7 days of history, 3 blocked sites</small>
          </button>

          {/* Benefits Section */}
          <div className="auth-benefits">
            <h4>Premium includes</h4>
            <ul className="benefits-list">
              {PREMIUM_FEATURES.map((feature) => (
                <li key={feature}>
                  <svg className="benefit-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuthPage; 

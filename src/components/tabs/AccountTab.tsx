import React, { useState, useEffect } from 'react';
import { StorageData, UserInfo } from '../../types/storage';
import { useBrowserMessaging } from '../../hooks/useBrowserMessaging';
import { PREMIUM_FEATURES, PRICE_SUMMARY } from '../../lib/plans';
import FreeService from '../../../services/FreeService';

interface AccountTabProps {
  data: StorageData;
  isAuthenticated: boolean;
  isFreeMode: boolean;
  onSignOut: () => void;
  onAuth: (success: boolean) => void;
  onUpgrade?: () => void;
}

interface SubscriptionInfo {
  hasSubscription: boolean;
  userType: string;
  subscriptionId?: string;
  status?: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const AccountTab: React.FC<AccountTabProps> = ({ 
  data, 
  isAuthenticated, 
  isFreeMode, 
  onSignOut, 
  onAuth,
  onUpgrade
}) => {
  // 'idle' until a sync is attempted here; never claims "synced" on its own
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [syncError, setSyncError] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string>('');
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);
  const { userInfo } = data;
  
  const { signout } = useBrowserMessaging();

  // Load subscription info when authenticated
  useEffect(() => {
    const loadSubscriptionInfo = async () => {
      if (!isAuthenticated) return;
      
      setIsLoadingSubscription(true);
      try {
        const result = await browserAPI.storage.local.get(['authToken']);
        const authToken = result.authToken;
        
        if (!authToken) {
          // No auth token means free account
          setSubscriptionInfo({ hasSubscription: false, userType: 'free' });
          setIsLoadingSubscription(false);
          return;
        }

        const response = await fetch(`${__API_URL__}/payments/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const subscriptionData = await response.json();
          setSubscriptionInfo(subscriptionData);
        } else {
          // API call failed, assume free account
          setSubscriptionInfo({ hasSubscription: false, userType: 'free' });
        }
      } catch (error) {
        console.error('Failed to load subscription info:', error);
        // On error, assume free account
        setSubscriptionInfo({ hasSubscription: false, userType: 'FREE' });
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    loadSubscriptionInfo();
  }, [isAuthenticated]);

  // Load last sync time from storage on component mount
  useEffect(() => {
    const loadLastSyncTime = async () => {
      try {
        const result = await browserAPI.storage.local.get(['lastSyncTime']);
        if (result.lastSyncTime) {
          const syncTime = new Date(result.lastSyncTime);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
          
          if (diffMinutes < 1) {
            setLastSyncTime('Just now');
          } else if (diffMinutes < 60) {
            setLastSyncTime(`${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`);
          } else {
            const diffHours = Math.floor(diffMinutes / 60);
            setLastSyncTime(`${diffHours} hour${diffHours === 1 ? '' : 's'} ago`);
          }
        }
      } catch (error) {
        console.error('Failed to load sync time:', error);
      }
    };

    if (isAuthenticated) {
      loadLastSyncTime();
    }
  }, [isAuthenticated]);

  const handleSyncNow = async (): Promise<void> => {
    setSyncStatus('syncing');
    
    try {
      // Send sync message to background worker with manual flag
      const response = await browserAPI.runtime.sendMessage({ 
        action: 'syncWithApi',
        manual: true  // Mark as manual sync (user-initiated)
      });
      
      if (response && response.success) {
        setSyncStatus('synced');
        setSyncError('');
        setLastSyncTime('Just now');
      } else {
        throw new Error((response && response.error) || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('failed');
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  const handleRefreshSubscription = async (): Promise<void> => {
    setIsRefreshingSubscription(true);
    
    try {
      console.log('Refreshing subscription status...');
      const isPremium = await FreeService.refreshSubscriptionStatus();
      
      // Reload subscription info from storage
      const result = await browserAPI.storage.local.get(['authToken']);
      const authToken = result.authToken;
      
      if (authToken) {
        const response = await fetch(`${__API_URL__}/payments/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const subscriptionData = await response.json();
          setSubscriptionInfo(subscriptionData);
        }
      }
      
      // Trigger a page refresh to update restricted tabs
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    } finally {
      setIsRefreshingSubscription(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      // Call background worker to handle sign out
      const response = await signout();
      
      if (response.success) {
        onSignOut(); // Notify parent component
      } else {
        console.error('Sign out failed:', response.error);
        // Still call onSignOut to update UI state
        onSignOut();
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Still call onSignOut to update UI state
      onSignOut();
    }
  };

  const handleSignIn = (): void => {
    // Trigger the auth overlay for social authentication
    onAuth(true); // Request to show auth overlay
  };

  const handleUpgrade = (): void => {
    if (onUpgrade) onUpgrade();
  };

  const handleCancelSubscription = async (): Promise<void> => {
    setConfirmingCancel(false);
    setSubscriptionError('');
    try {
      const result = await browserAPI.storage.local.get(['authToken']);
      const authToken = result.authToken;
      
      if (!authToken) return;

      const response = await fetch(`${__API_URL__}/payments/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Reload subscription info
        const updatedResponse = await fetch(`${__API_URL__}/payments/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (updatedResponse.ok) {
          const subscriptionData = await updatedResponse.json();
          setSubscriptionInfo(subscriptionData);
        }
      } else {
        setSubscriptionError('Could not cancel the subscription. Please try again.');
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      setSubscriptionError('Could not cancel the subscription. Please try again.');
    }
  };

  const handleReactivateSubscription = async (): Promise<void> => {
    try {
      const result = await browserAPI.storage.local.get(['authToken']);
      const authToken = result.authToken;
      
      if (!authToken) return;

      const response = await fetch(`${__API_URL__}/payments/reactivate-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Reload subscription info
        const updatedResponse = await fetch(`${__API_URL__}/payments/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (updatedResponse.ok) {
          const subscriptionData = await updatedResponse.json();
          setSubscriptionInfo(subscriptionData);
        }
      }
    } catch (error) {
      console.error('Failed to reactivate subscription:', error);
    }
  };

  if (isFreeMode && !isAuthenticated) {
    return (
      <section className="tab-content">
        <div className="free-mode-account-info">
          <div className="account-card">
            <div className="account-header">
              <svg className="account-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <h2>No account</h2>
            </div>
            
            <div className="account-description">
              <p>
                You're using Argus without an account. Everything works, and your data stays on this device.
              </p>
              
              <div className="free-mode-features">
                <h3>Premium ({PRICE_SUMMARY}) adds:</h3>
                <ul className="features-list">
                  {PREMIUM_FEATURES.map((feature) => (
                    <li key={feature}>
                      <svg className="feature-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="account-actions">
              <button onClick={handleUpgrade} className="primary-btn">
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Upgrade to Premium
              </button>
              <button onClick={handleSignIn} className="secondary-btn">
                I already have an account
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isAuthenticated && userInfo) {
    const hasPremium = !!subscriptionInfo && subscriptionInfo.hasSubscription;
    // The API reports the end of the paid period as a unix timestamp in seconds
    const periodEndText = subscriptionInfo && subscriptionInfo.currentPeriodEnd
      ? new Date(subscriptionInfo.currentPeriodEnd * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const renderSubscriptionButton = () => {
      if (isLoadingSubscription) {
        return (
          <button className="secondary-btn" disabled>
            Loading...
          </button>
        );
      }

      if (!subscriptionInfo || !subscriptionInfo.hasSubscription) {
        return (
          <button onClick={handleUpgrade} className="primary-btn">
            <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upgrade to Premium
          </button>
        );
      }

      if (subscriptionInfo.cancelAtPeriodEnd) {
        return (
          <button onClick={handleReactivateSubscription} className="primary-btn">
            <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reactivate Subscription
          </button>
        );
      }

      if (confirmingCancel) {
        return (
          <div className="confirm-row">
            <p className="confirm-text">
              Cancel Premium? You keep it until {periodEndText || 'the end of the period you paid for'}.
            </p>
            <button onClick={() => setConfirmingCancel(false)} className="secondary-btn">
              Keep Premium
            </button>
            <button onClick={handleCancelSubscription} className="danger-btn">
              Yes, cancel
            </button>
          </div>
        );
      }

      return (
        <button onClick={() => setConfirmingCancel(true)} className="danger-btn">
          Cancel Subscription
        </button>
      );
    };

    return (
      <section className="tab-content">
        <div className="regular-account-info">
          <div className="account-card">
            <div className="account-header">
              {userInfo.picture ? (
                <img src={userInfo.picture} alt="Profile" className="profile-picture" />
              ) : (
                <div className="profile-placeholder" role="presentation">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
              <div className="profile-info">
                <h2>{userInfo.name || userInfo.email.split('@')[0]}</h2>
                <p className="user-email">{userInfo.email}</p>
                <span className={`account-badge ${(!subscriptionInfo || !subscriptionInfo.hasSubscription) ? 'free' : 'premium'}`}>
                  {isLoadingSubscription 
                    ? 'Loading...' 
                    : (!subscriptionInfo || !subscriptionInfo.hasSubscription) 
                      ? 'Free Account' 
                      : subscriptionInfo.cancelAtPeriodEnd 
                        ? 'Premium (Canceling)' 
                        : 'Premium Account'
                  }
                </span>
                {hasPremium && periodEndText && (
                  <p className="plan-renewal">
                    {subscriptionInfo!.cancelAtPeriodEnd ? `Premium ends on ${periodEndText}` : `Renews on ${periodEndText}`}
                  </p>
                )}
                {subscriptionError && <p className="plan-error">{subscriptionError}</p>}
              </div>
            </div>
            
            <div className="account-stats">
              <div className="stat-item">
                <h3>Sync across devices</h3>
                {hasPremium ? (
                  <>
                    <div className={`sync-indicator ${syncStatus === 'failed' ? 'failed' : syncStatus === 'syncing' ? 'syncing' : 'synced'}`}>
                      <div className="sync-dot"></div>
                      <span className="sync-text">
                        {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'failed' ? `Sync failed: ${syncError}` : syncStatus === 'synced' ? 'Synced' : 'On'}
                      </span>
                    </div>
                    <div className="last-sync">
                      Last sync: <span>{lastSyncTime}</span>
                    </div>
                  </>
                ) : (
                  <div className="last-sync">
                    Not syncing. Your data stays on this device; syncing is part of Premium.
                  </div>
                )}
              </div>
            </div>
            
            <div className="account-actions">
              {hasPremium && (
                <button 
                  onClick={handleSyncNow} 
                  className="secondary-btn"
                  disabled={syncStatus === 'syncing'}
                >
                  {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
              
              <button 
                onClick={handleRefreshSubscription} 
                className="secondary-btn"
                disabled={isRefreshingSubscription}
                title="Refresh subscription status from server"
              >
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                {isRefreshingSubscription ? 'Refreshing...' : 'Refresh Status'}
              </button>
              
              {renderSubscriptionButton()}
              
              <button onClick={handleSignOut} className="danger-btn">
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Fallback case - should not normally reach here
  return (
    <section className="tab-content">
      <div className="account-card">
        <h2>Account</h2>
        <p>Loading account information...</p>
      </div>
    </section>
  );
};

export default AccountTab; 

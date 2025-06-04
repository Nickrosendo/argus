import React, { useState, useEffect } from 'react';
import { StorageData, UserInfo } from '../../types/storage';
import { useBrowserMessaging } from '../../hooks/useBrowserMessaging';

type AuthMode = 'signin' | 'signup';

interface AccountTabProps {
  data: StorageData;
  isAuthenticated: boolean;
  isFreeMode: boolean;
  onSignOut: () => void;
  onAuth: (success: boolean) => void;
  setAuthMode?: (mode: AuthMode) => void;
}

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const AccountTab: React.FC<AccountTabProps> = ({ 
  data, 
  isAuthenticated, 
  isFreeMode, 
  onSignOut, 
  onAuth, 
  setAuthMode 
}) => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const { userInfo } = data;
  
  const { signout } = useBrowserMessaging();

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
      // Send sync message to background worker
      const response = await browserAPI.runtime.sendMessage({ 
        action: 'syncWithApi' 
      });
      
      if (response.success) {
        setSyncStatus('synced');
        setLastSyncTime('Just now');
        
        // Store sync time
        await browserAPI.storage.local.set({
          lastSyncTime: Date.now()
        });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('synced'); // Reset status even on error
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

  const handleCreateAccount = (): void => {
    // Set auth mode to signup and trigger the auth overlay
    if (setAuthMode) {
      setAuthMode('signup');
    }
    onAuth(true); // Request to show auth overlay
  };

  const handleSignIn = (): void => {
    // Set auth mode to signin and trigger the auth overlay
    if (setAuthMode) {
      setAuthMode('signin');
    }
    onAuth(true); // Request to show auth overlay
  };

  if (isFreeMode) {
    return (
      <section className="tab-content">
        <div className="free-mode-account-info">
          <div className="account-card">
            <h2>Free Mode Account</h2>
            <p>
              You're currently using Argus without an account. Your data is stored only on this device 
              and will not be synced to the cloud.
            </p>
            
            <div className="account-actions">
              <button onClick={handleCreateAccount} className="primary-btn">
                Create an Account
              </button>
              <button onClick={handleSignIn} className="primary-btn">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isAuthenticated && userInfo) {
    return (
      <section className="tab-content">
        <div className="regular-account-info">
          <div className="account-card">
            <h2>Your Account</h2>
            
            <div className="account-info">
              <div className="account-field">
                <label>Username</label>
                <div className="account-value">{userInfo.name || userInfo.email.split('@')[0]}</div>
              </div>
              <div className="account-field">
                <label>Email</label>
                <div className="account-value">{userInfo.email}</div>
              </div>
              <div className="account-field">
                <label>Account Type</label>
                <div className="account-value">Premium</div>
              </div>
            </div>
            
            <div className="sync-status">
              <h3>Data Sync</h3>
              <p>
                Your data is <span className={`sync-status-text ${syncStatus}`}>
                  {syncStatus === 'syncing' ? 'syncing' : 'synced'}
                </span> with the Argus cloud.
              </p>
              <div className="last-sync">
                Last sync: <span>{lastSyncTime}</span>
              </div>
            </div>
            
            <div className="account-actions">
              <button 
                onClick={handleSyncNow} 
                className="primary-btn"
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </button>
              <button onClick={handleSignOut} className="warning-btn">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // This shouldn't happen as the auth overlay should be shown
  return (
    <section className="tab-content">
      <div className="loading">Loading account information...</div>
    </section>
  );
};

export default AccountTab; 
import React, { useState } from 'react';

const AccountTab = ({ data, isAuthenticated, isFreeMode, onSignOut, onAuth, setAuthMode }) => {
  const [syncStatus, setSyncStatus] = useState('synced');
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const { userInfo } = data;

  const handleSyncNow = async () => {
    setSyncStatus('syncing');
    
    // Simulate sync process
    setTimeout(() => {
      setSyncStatus('synced');
      setLastSyncTime('Just now');
    }, 2000);
  };

  const handleCreateAccount = () => {
    // Set auth mode to signup and trigger the auth overlay
    if (setAuthMode) {
      setAuthMode('signup');
    }
    onAuth(true); // Request to show auth overlay
  };

  const handleSignIn = () => {
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
                <div className="account-value">{userInfo.username}</div>
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
              <button onClick={onSignOut} className="warning-btn">
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

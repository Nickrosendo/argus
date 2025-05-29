import React from 'react';

const Header = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'stats', label: 'Stats' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
    { id: 'account', label: 'Account' }
  ];

  return (
    <header>
      <div className="logo">
        <img src="icons/icon48.png" alt="Argus Logo" />
        <h1>Argus</h1>
      </div>
      <nav>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default Header; 
import React, { useState, useEffect } from 'react';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const SettingsTab = ({ data, updateStorage }) => {
  const { settings = {}, blockedSites = [] } = data;
  const [localSettings, setLocalSettings] = useState({
    idleTime: 5,
    dailyLimit: 8,
    showNotifications: true,
    enableBlocking: false,
    ...settings
  });
  const [newBlockedSite, setNewBlockedSite] = useState('');
  const [localBlockedSites, setLocalBlockedSites] = useState(blockedSites);

  // Update local state when data changes
  useEffect(() => {
    setLocalSettings(prev => ({ ...prev, ...settings }));
    setLocalBlockedSites(blockedSites);
  }, [settings, blockedSites]);

  const handleSettingChange = (key, value) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateStorage({ settings: newSettings });
  };

  const handleAddBlockedSite = () => {
    if (!newBlockedSite.trim()) return;
    
    const site = newBlockedSite.trim().toLowerCase();
    if (localBlockedSites.includes(site)) return;
    
    const updatedSites = [...localBlockedSites, site];
    setLocalBlockedSites(updatedSites);
    updateStorage({ blockedSites: updatedSites });
    setNewBlockedSite('');
    
    // Update blocking rules
    updateBlockingRules(updatedSites, localSettings.enableBlocking);
  };

  const handleRemoveBlockedSite = (site) => {
    const updatedSites = localBlockedSites.filter(s => s !== site);
    setLocalBlockedSites(updatedSites);
    updateStorage({ blockedSites: updatedSites });
    
    // Update blocking rules
    updateBlockingRules(updatedSites, localSettings.enableBlocking);
  };

  const handleBlockingToggle = (enabled) => {
    handleSettingChange('enableBlocking', enabled);
    updateBlockingRules(localBlockedSites, enabled);
  };

  const updateBlockingRules = (sites, enabled) => {
    if (!browserAPI.declarativeNetRequest) return;

    // Remove existing rules
    browserAPI.declarativeNetRequest.getDynamicRules((existingRules) => {
      const ruleIds = existingRules.map(rule => rule.id);
      
      browserAPI.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: enabled ? sites.map((site, index) => ({
          id: index + 1,
          priority: 1,
          action: { type: 'redirect', redirect: { url: browserAPI.runtime.getURL('blocked.html') } },
          condition: { urlFilter: `*://*.${site}/*` }
        })) : []
      });
    });
  };

  const handleExportData = () => {
    browserAPI.storage.local.get(null, (allData) => {
      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `argus-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    });
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      browserAPI.storage.local.clear(() => {
        updateStorage({
          sites: {},
          totalTime: 0,
          history: {},
          settings: {
            idleTime: 5,
            dailyLimit: 8,
            showNotifications: true,
            enableBlocking: false
          },
          blockedSites: []
        });
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddBlockedSite();
    }
  };

  return (
    <section className="tab-content">
      <div className="settings-form">
        <div className="setting-item">
          <label htmlFor="idle-time">Consider idle after (minutes):</label>
          <input
            type="number"
            id="idle-time"
            min="1"
            max="60"
            value={localSettings.idleTime}
            onChange={(e) => handleSettingChange('idleTime', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item">
          <label htmlFor="daily-limit">Daily screen time goal (hours):</label>
          <input
            type="number"
            id="daily-limit"
            min="0"
            max="24"
            step="0.5"
            value={localSettings.dailyLimit}
            onChange={(e) => handleSettingChange('dailyLimit', parseFloat(e.target.value))}
          />
        </div>

        <div className="setting-item checkbox">
          <input
            type="checkbox"
            id="show-notifications"
            checked={localSettings.showNotifications}
            onChange={(e) => handleSettingChange('showNotifications', e.target.checked)}
          />
          <label htmlFor="show-notifications">Show notifications</label>
        </div>

        {/* Website Blocking Section */}
        <div className="setting-section">
          <h3>Website Blocking</h3>
          <div className="setting-item checkbox">
            <input
              type="checkbox"
              id="enable-blocking"
              checked={localSettings.enableBlocking}
              onChange={(e) => handleBlockingToggle(e.target.checked)}
            />
            <label htmlFor="enable-blocking">Enable website blocking</label>
          </div>

          <div className="blocked-sites-container">
            <div className="blocked-sites-list">
              {localBlockedSites.length === 0 ? (
                <div className="no-blocked-sites">No blocked sites</div>
              ) : (
                localBlockedSites.map(site => (
                  <div key={site} className="blocked-site-item">
                    <span className="site-name">{site}</span>
                    <button
                      className="remove-site"
                      onClick={() => handleRemoveBlockedSite(site)}
                      title="Remove site"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="add-site-form">
              <input
                type="text"
                value={newBlockedSite}
                onChange={(e) => setNewBlockedSite(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="example.com"
              />
              <button onClick={handleAddBlockedSite}>Add Site</button>
            </div>
          </div>
        </div>

        <div className="setting-item">
          <button onClick={handleExportData}>Export Data</button>
          <button onClick={handleClearData} className="danger">Clear All Data</button>
        </div>
      </div>
    </section>
  );
};

export default SettingsTab; 
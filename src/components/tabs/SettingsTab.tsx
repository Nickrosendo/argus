import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageData, Settings } from '../../types/storage';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

interface SettingsTabProps {
  data: StorageData;
  updateStorage: (updates: Partial<StorageData>) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ data, updateStorage }) => {
  const { settings = {}, blockedSites = [] } = data;
  
  // Memoize the default settings to prevent infinite loops
  const defaultSettings = useMemo(() => ({
    idleTime: 5,
    dailyLimit: 8,
    showNotifications: true,
    enableBlocking: false,
  }), []);

  const [localSettings, setLocalSettings] = useState<Settings>({
    ...defaultSettings,
    ...settings
  });
  const [newBlockedSite, setNewBlockedSite] = useState<string>('');
  const [localBlockedSites, setLocalBlockedSites] = useState<string[]>(blockedSites);

  // Use refs to track previous values
  const prevSettingsRef = useRef<Partial<Settings> | undefined>();
  const prevBlockedSitesRef = useRef<string[]>([]);

  // Update local state when data changes, but only if the actual values changed
  useEffect(() => {
    const newSettings = { ...defaultSettings, ...settings };
    
    // Only update if the settings have actually changed
    if (JSON.stringify(prevSettingsRef.current) !== JSON.stringify(settings)) {
      setLocalSettings(newSettings);
      prevSettingsRef.current = settings;
    }
  }, [settings, defaultSettings]);

  useEffect(() => {
    // Only update if the blocked sites have actually changed
    if (JSON.stringify(prevBlockedSitesRef.current) !== JSON.stringify(blockedSites)) {
      setLocalBlockedSites(blockedSites);
      prevBlockedSitesRef.current = blockedSites;
    }
  }, [blockedSites]);

  const handleSettingChange = (key: keyof Settings, value: any): void => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateStorage({ settings: newSettings });
  };

  const handleAddBlockedSite = (): void => {
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

  const handleRemoveBlockedSite = (site: string): void => {
    const updatedSites = localBlockedSites.filter(s => s !== site);
    setLocalBlockedSites(updatedSites);
    updateStorage({ blockedSites: updatedSites });
    
    // Update blocking rules
    updateBlockingRules(updatedSites, localSettings.enableBlocking);
  };

  const handleBlockingToggle = (enabled: boolean): void => {
    handleSettingChange('enableBlocking', enabled);
    updateBlockingRules(localBlockedSites, enabled);
  };

  const updateBlockingRules = (sites: string[], enabled: boolean): void => {
    if (!browserAPI.declarativeNetRequest) return;

    // Remove existing rules
    browserAPI.declarativeNetRequest.getDynamicRules((existingRules: any[]) => {
      const ruleIds = existingRules.map(rule => rule.id);
      
      if (browserAPI.declarativeNetRequest) {
        browserAPI.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds,
          addRules: enabled ? sites.map((site, index) => ({
            id: index + 1,
            priority: 1,
            action: { type: 'redirect', redirect: { url: browserAPI.runtime.getURL('blocked.html') } },
            condition: { urlFilter: `*://*.${site}/*` }
          })) : []
        });
      }
    });
  };

  const handleExportData = (): void => {
    browserAPI.storage.local.get(null, (allData: any) => {
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

  const handleClearData = (): void => {
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
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

        {/* Data Management Section */}
        <div className="setting-section">
          <h3>Data Management</h3>
          <div className="data-actions">
            <button onClick={handleExportData} className="secondary-btn">
              Export Data
            </button>
            <button onClick={handleClearData} className="warning-btn">
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsTab; 
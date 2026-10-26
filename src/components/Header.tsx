import React from 'react';
import { Home, BarChart3, Globe, Shield, Settings } from "lucide-react";

export type TabId = "stats" | "history" | "sites" | "focus";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<any>;
}

interface HeaderProps {
  activeTab: TabId | "settings";
  onTabChange: (tab: TabId) => void;
  onToggleSettings: () => void;
}

const tabs: Tab[] = [
  { id: 'stats', label: 'Stats', icon: Home },
  { id: 'history', label: 'History', icon: BarChart3 },
  { id: 'sites', label: 'Sites', icon: Globe },
  { id: 'focus', label: 'Focus', icon: Shield }
];

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onToggleSettings }) => {
  return (
    <header className="header-container">
      <div className="logo">
        <img src="icons/icon48.png" alt="Argus Logo" />
        <h1>Argus</h1>
      </div>
      <nav className="icon-navigation">
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`nav-icon-btn nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              title={tab.label}
            >
              <IconComponent className="nav-icon-svg" />
              <span className="nav-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        className={`nav-icon-btn settings-gear ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={onToggleSettings}
        aria-label="Settings"
        aria-pressed={activeTab === 'settings'}
        title="Settings"
      >
        <Settings className="nav-icon-svg" />
      </button>
    </header>
  );
};

export default Header;

import React from 'react';
import { Home, BarChart3, Globe, Clock, Eye } from "lucide-react";
import MenuPopup from './MenuPopup';

type TabId = "stats" | "history";
type MenuAction = "settings" | "account";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<any>;
}

interface HeaderProps {
  activeTab: TabId | "settings" | "account";
  onTabChange: (tabId: TabId) => void;
  onMenuAction: (action: MenuAction) => void;
  isAuthenticated: boolean;
  isFreeMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  onTabChange,
  onMenuAction,
  isAuthenticated,
  isFreeMode
}) => {
  const tabs: Tab[] = [
    { id: 'stats', label: 'Stats', icon: Home },
    { id: 'history', label: 'History', icon: BarChart3 }
  ];

  // Additional navigation icons (for future features)
  const additionalIcons = [
    { icon: Globe, label: 'Sites' },
    { icon: Clock, label: 'Time' },
    { icon: Eye, label: 'Monitor' }
  ];

  return (
    <header className="header-container">
      <div className="logo">
        <img src="icons/icon48.png" alt="Argus Logo" />
        <h1>Argus</h1>
      </div>
      <nav className="icon-navigation">
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-icon-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
            >
              <IconComponent className="nav-icon-svg" />
            </button>
          );
        })}
        
        {additionalIcons.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <button
              key={`additional-${index}`}
              className="nav-icon-btn"
              aria-label={item.label}
            >
              <IconComponent className="nav-icon-svg" />
            </button>
          );
        })}
      </nav>
      
      <MenuPopup 
        onAction={onMenuAction}
        isAuthenticated={isAuthenticated}
        isFreeMode={isFreeMode}
      />
    </header>
  );
};

export default Header; 
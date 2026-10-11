import React, { useState, useEffect } from 'react';
import { Home, BarChart3, Globe, Shield } from "lucide-react";
import MenuPopup from './MenuPopup';
import LockIcon from './ui/LockIcon';
import FreeService from '../../services/FreeService';

type TabId = "stats" | "history" | "sites" | "focus";
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
  onUpgradeClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  onTabChange,
  onMenuAction,
  isAuthenticated,
  isFreeMode,
  onUpgradeClick
}) => {
  const [restrictedTabs, setRestrictedTabs] = useState<Set<TabId>>(new Set());

  const tabs: Tab[] = [
    { id: 'stats', label: 'Stats', icon: Home },
    { id: 'history', label: 'History', icon: BarChart3 },
    { id: 'sites', label: 'Sites', icon: Globe },
    { id: 'focus', label: 'Focus', icon: Shield }
  ];

  // Check which tabs are restricted for free users
  useEffect(() => {
    const checkRestrictions = async () => {
      const restricted = new Set<TabId>();
      
      for (const tab of tabs) {
        const isRestricted = await FreeService.isTabRestricted(tab.id);
        if (isRestricted) {
          restricted.add(tab.id);
        }
      }
      
      setRestrictedTabs(restricted);
    };

    checkRestrictions();
  }, [isFreeMode]);

  // A locked tab still opens: the app shows what the feature does and how
  // to get it, instead of bouncing the user to the sign-in screen
  const handleTabClick = (tabId: TabId) => {
    onTabChange(tabId);
  };

  return (
    <header className="header-container">
      <div className="logo">
        <img src="icons/icon48.png" alt="Argus Logo" />
        <h1>Argus</h1>
      </div>
      <nav className="icon-navigation">
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          const isRestricted = restrictedTabs.has(tab.id);
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              className={`nav-icon-btn nav-tab-btn ${isActive ? 'active' : ''} ${isRestricted ? 'locked' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              aria-label={isRestricted ? `${tab.label} (Premium)` : tab.label}
              title={isRestricted ? `${tab.label} is part of Premium` : tab.label}
            >
              <IconComponent className="nav-icon-svg" />
              <span className="nav-tab-label">{tab.label}</span>
              {isRestricted && <LockIcon className="tab-lock" size={12} />}
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
import React, { useState, useEffect } from "react";
import Header from "./Header";
import AuthOverlay from "./AuthOverlay";
import StatsTab from "./tabs/StatsTab";
import HistoryTab from "./tabs/HistoryTab";
import SitesTab from "./tabs/SitesTab";
import FocusTab from "./tabs/FocusTab";
import SettingsTab from "./tabs/SettingsTab";
import AccountTab from "./tabs/AccountTab";
import Footer from "./Footer";
import { useBrowserStorage } from "../hooks/useBrowserStorage";
import { useBrowserMessaging } from "../hooks/useBrowserMessaging";
import { StorageData, UserInfo } from "../types/storage";

type TabId = "stats" | "history" | "sites" | "focus" | "settings" | "account";

type AuthMode = "signin" | "signup";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(false);

  // Use the correct hook interface with keys and default values
  const { data: storageData, loading, updateStorage } = useBrowserStorage(
    ["sites", "totalTime", "history", "settings", "userInfo", "authToken", "freeMode"],
    {
      sites: {},
      totalTime: 0,
      history: {},
      settings: {
        idleTime: 5,
        dailyLimit: 8,
        showNotifications: true,
        enableBlocking: false,
      },
      userInfo: null,
      authToken: null,
      freeMode: true,
    }
  );

  const handleTabChange = (tabId: "stats" | "history" | "sites" | "focus"): void => {
    setActiveTab(tabId);
  };

  const handleMenuAction = (action: "settings" | "account"): void => {
    setActiveTab(action);
  };

  const handleAuth = (success: boolean, userData?: { token: string; user: UserInfo }): void => {
    if (success && userData) {
      setIsAuthenticated(true);
      setShowAuthOverlay(false);
      setIsFreeMode(false);

      // Update storage with authenticated user data
      updateStorage({
        userInfo: userData.user,
        authToken: userData.token,
        freeMode: false,
      });

      console.log("Authentication successful:", userData);
    } else if (success && !userData) {
      // Request to show auth overlay
      setShowAuthOverlay(true);
    }
  };

  const handleSignOut = (): void => {
    setIsAuthenticated(false);
    setIsFreeMode(true);

    // Clear user data from storage
    updateStorage({ 
      userInfo: null, 
      authToken: null,
      freeMode: true 
    });

    // Show auth overlay again
    setShowAuthOverlay(true);

    console.log("Sign out successful");
  };

  const handleFreeMode = (): void => {
    setIsFreeMode(true);
    setShowAuthOverlay(false);
    setIsAuthenticated(false);
    updateStorage({ freeMode: true });
    console.log("Entering free mode");
  };

  const handleCloseAuthOverlay = (): void => {
    setShowAuthOverlay(false);
  };

  // Check authentication status on app load
  useEffect(() => {
    if (!loading && storageData) {
      const { userInfo, authToken, freeMode } = storageData;

      if (userInfo && authToken && userInfo.email) {
        setIsAuthenticated(true);
        setIsFreeMode(false);
      } else if (freeMode) {
        setIsFreeMode(true);
        setIsAuthenticated(false);
      } else {
        setShowAuthOverlay(true);
      }
    }
  }, [loading, storageData]);

  // Handle browser messaging for sync updates
  const { } = useBrowserMessaging();

  // Show loading state
  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Default to empty storage data if not available
  const defaultStorageData: StorageData = {
    sites: {},
    totalTime: 0,
    history: {},
    settings: {
      idleTime: 5,
      dailyLimit: 8,
      showNotifications: true,
      enableBlocking: false,
    },
    blockedSites: [],
    authToken: null,
    userInfo: null,
    freeMode: true,
    lastUpdated: new Date().toISOString(),
  };

  const currentStorageData = { ...defaultStorageData, ...storageData } as StorageData;

  // Render current tab content
  let currentTab: React.ReactNode;

  switch (activeTab) {
    case "stats": {
      currentTab = <StatsTab data={currentStorageData} />;
      break;
    }
    case "history": {
      currentTab = <HistoryTab data={currentStorageData} />;
      break;
    }
    case "sites": {
      currentTab = <SitesTab data={currentStorageData} />;
      break;
    }
    case "focus": {
      currentTab = <FocusTab data={currentStorageData} updateStorage={updateStorage} />;
      break;
    }
    case "settings": {
      currentTab = (
        <SettingsTab data={currentStorageData} updateStorage={updateStorage} />
      );
      break;
    }
    case "account": {
      currentTab = (
        <AccountTab
          data={currentStorageData}
          isAuthenticated={isAuthenticated}
          isFreeMode={isFreeMode}
          onSignOut={handleSignOut}
          onAuth={handleAuth}
          setAuthMode={setAuthMode}
        />
      );
      break;
    }
    default: {
      currentTab = <StatsTab data={currentStorageData} />;
    }
  }

  return (
    <div className="app">
      
      {showAuthOverlay && (
        <AuthOverlay
          authMode={authMode}
          setAuthMode={setAuthMode}
          onAuth={handleAuth}
          onFreeMode={handleFreeMode}
          onClose={handleCloseAuthOverlay}
        />
      )}

      {isFreeMode && (
        <div id="free-mode-info" className="free-mode-info">
          You're using Argus in free mode. Some features may be limited.
        </div>
      )}

      <Header 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        onMenuAction={handleMenuAction}
        isAuthenticated={isAuthenticated}
        isFreeMode={isFreeMode}
      />

      <main className="main-tab-content">{currentTab}</main>

      <Footer />
    </div>
  );
};

export default App; 

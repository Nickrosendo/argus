import React, { useState, useEffect } from "react";
import AuthPage from "./AuthPage";
import Header from "./Header";
import Footer from "./Footer";
import StatsTab from "./tabs/StatsTab";
import HistoryTab from "./tabs/HistoryTab";
import SitesTab from "./tabs/SitesTab";
import FocusTab from "./tabs/FocusTab";
import SettingsTab from "./tabs/SettingsTab";
import AccountTab from "./tabs/AccountTab";
import { StorageData, UserInfo } from "../types/storage";
import { useBrowserStorage } from "../hooks/useBrowserStorage";
import { useBrowserMessaging } from "../hooks/useBrowserMessaging";

type TabId = "stats" | "history" | "sites" | "focus" | "settings" | "account" | "auth";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(true);

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
        enableBlocking: true,
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
      setIsFreeMode(false);

      // Update storage with authenticated user data
      updateStorage({
        userInfo: userData.user,
        authToken: userData.token,
        freeMode: false,
      });

      // Switch to stats tab after successful authentication
      setActiveTab("stats");

      console.log("Authentication successful:", userData);
    } else if (success && !userData) {
      // Request to show auth tab
      setActiveTab("auth");
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

    // Show auth tab again
    setActiveTab("auth");

    console.log("Sign out successful");
  };

  const handleFreeMode = (): void => {
    setIsFreeMode(true);
    setIsAuthenticated(false);
    updateStorage({ freeMode: true });
    
    // Switch to stats tab after choosing free mode
    setActiveTab("stats");
    
    console.log("Entering free mode");
  };

  // Check authentication status on app load
  useEffect(() => {
    if (!loading && storageData) {
      const { userInfo, authToken, freeMode } = storageData;

      if (userInfo && authToken && (userInfo as UserInfo).email) {
        setIsAuthenticated(true);
        setIsFreeMode(false);
      } else if (freeMode) {
        setIsFreeMode(true);
        setIsAuthenticated(false);
      } else {
        // Show auth tab if no authentication state is found
        setActiveTab("auth");
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
    case "auth": {
      currentTab = (
        <AuthPage
          onAuth={handleAuth}
          onFreeMode={handleFreeMode}
        />
      );
      break;
    }
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
      currentTab = <FocusTab data={currentStorageData} />;
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
        />
      );
      break;
    }
    default: {
      currentTab = <StatsTab data={currentStorageData} />;
    }
  }

  // Show auth tab if not authenticated and not in free mode
  const shouldShowAuthTab = !isAuthenticated && !isFreeMode;
  
  return (
    <div className="app">
      {isFreeMode && !shouldShowAuthTab && (
        <div id="free-mode-info" className="free-mode-info">
          You're using Argus in free mode. Some features may be limited.
        </div>
      )}

      {/* Only show header if not showing auth tab */}
      {activeTab !== "auth" && (
        <Header 
          activeTab={activeTab as "stats" | "history" | "sites" | "focus"} 
          onTabChange={handleTabChange}
          onMenuAction={handleMenuAction}
          isAuthenticated={isAuthenticated}
          isFreeMode={isFreeMode}
        />
      )}

      <main className="main-tab-content">{currentTab}</main>

      {/* Only show footer if not showing auth tab */}
      {activeTab !== "auth" && <Footer />}
    </div>
  );
};

export default App; 

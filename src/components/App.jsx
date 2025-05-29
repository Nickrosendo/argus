import React, { useState, useEffect } from "react";
import Header from "./Header";
import AuthOverlay from "./AuthOverlay";
import TodayTab from "./tabs/TodayTab";
import StatsTab from "./tabs/StatsTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";
import AccountTab from "./tabs/AccountTab";
import Footer from "./Footer";
import { useBrowserStorage } from "../hooks/useBrowserStorage";

const App = () => {
  console.log("App: Component rendering test 123...");

  const [activeTab, setActiveTab] = useState("today");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // 'signin' or 'signup'
  const [isFreeMode, setIsFreeMode] = useState(true); // Start in free mode by default
  const [showAuthOverlay, setShowAuthOverlay] = useState(false); // Add state for auth overlay

  const {
    data: storageData,
    loading,
    updateStorage,
  } = useBrowserStorage(
    [
      "sites",
      "totalTime",
      "history",
      "settings",
      "blockedSites",
      "authToken",
      "userInfo",
    ],
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
      blockedSites: [],
      authToken: null,
      userInfo: null,
    }
  );

  console.log("App: Current state:", {
    activeTab,
    isAuthenticated,
    isFreeMode,
    loading,
    storageData,
  });

  // Check authentication status
  useEffect(() => {
    console.log(
      "App: Auth effect triggered with:",
      storageData.authToken,
      storageData.userInfo
    );
    if (storageData.authToken && storageData.userInfo) {
      setIsAuthenticated(true);
      setIsFreeMode(false);
    } else if (storageData.authToken === false) {
      // Explicitly set to false means user chose free mode
      setIsAuthenticated(false);
      setIsFreeMode(true);
    } else {
      // No auth state set - default to free mode
      setIsAuthenticated(false);
      setIsFreeMode(true);
    }
  }, [storageData.authToken, storageData.userInfo]);

  // Listen for settings tab open event
  useEffect(() => {
    const handleOpenSettings = () => {
      setActiveTab("settings");
    };

    window.addEventListener("openSettingsTab", handleOpenSettings);
    return () =>
      window.removeEventListener("openSettingsTab", handleOpenSettings);
  }, []);

  const handleTabChange = (tabId) => {
    console.log("App: Tab changed to:", tabId);
    setActiveTab(tabId);
  };

  const handleAuth = (success, userData = null) => {
    console.log("App: Auth handler called:", success, userData);
    if (success && userData) {
      // Successful authentication with user data
      setIsAuthenticated(true);
      setIsFreeMode(false);
      setShowAuthOverlay(false); // Hide overlay on success
      updateStorage({
        authToken: userData.token,
        userInfo: userData.user,
      });
    } else if (success && !userData) {
      // This is a request to show the auth overlay
      setShowAuthOverlay(true);
    }
  };

  const handleFreeMode = () => {
    console.log("App: Free mode selected");
    setIsFreeMode(true);
    setIsAuthenticated(false);
    setShowAuthOverlay(false); // Hide overlay when choosing free mode
    updateStorage({ authToken: false });
  };

  const handleSignOut = () => {
    console.log("App: Sign out");
    setIsAuthenticated(false);
    setIsFreeMode(true);
    setShowAuthOverlay(false); // Hide overlay on sign out
    updateStorage({
      authToken: null,
      userInfo: null,
    });
  };

  const handleCloseAuthOverlay = () => {
    setShowAuthOverlay(false);
  };

  if (loading) {
    console.log("App: Still loading...");
    return (
      <div className="loading-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Only show auth overlay if explicitly requested (like from Account tab)
  console.log("App: Show auth overlay:", showAuthOverlay);

  let currentTab = null;

  switch (activeTab) {
    case "today": {
      currentTab = (
        <TodayTab data={storageData} updateStorage={updateStorage} />
      );
      break;
    }

    case "stats": {
      currentTab = <StatsTab data={storageData} />;
      break;
    }
    case "history": {
      currentTab = <HistoryTab data={storageData} />;
      break;
    }
    case "settings": {
      currentTab = (
        <SettingsTab data={storageData} updateStorage={updateStorage} />
      );
      break;
    }
    case "account": {
      currentTab = (
        <AccountTab
          data={storageData}
          isAuthenticated={isAuthenticated}
          isFreeMode={isFreeMode}
          onSignOut={handleSignOut}
          onAuth={handleAuth}
          setAuthMode={setAuthMode} // Pass setAuthMode to allow setting the auth mode
        />
      );
      break;
    }
    default: {
      currentTab = (
        <TodayTab data={storageData} updateStorage={updateStorage} />
      );
    }
  }

  console.log(
    "App: About to render app, current tab:",
    currentTab,
    "activeTab:",
    activeTab
  );
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

      <Header activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="main-tab-content">{currentTab}</main>

      <Footer />
    </div>
  );
};

export default App;

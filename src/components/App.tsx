import React, { useState, useEffect, useMemo } from "react";
import Header, { TabId } from "./Header";
import Footer from "./Footer";
import StatsTab from "./tabs/StatsTab";
import HistoryTab from "./tabs/HistoryTab";
import SitesTab from "./tabs/SitesTab";
import FocusTab from "./tabs/FocusTab";
import SettingsTab from "./tabs/SettingsTab";
import WelcomeCard from "./ui/WelcomeCard";
import { StorageData } from "../types/storage";
import { useBrowserStorage } from "../hooks/useBrowserStorage";
import { useBrowserMessaging } from "../hooks/useBrowserMessaging";

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Used for any key that is not in storage yet
const DEFAULT_STORAGE_DATA: StorageData = {
  sites: {},
  totalTime: 0,
  history: {},
  settings: {
    idleTime: 5,
    dailyLimit: 8,
    enableBlocking: false,
  },
  blockedSites: [],
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId | "settings">("stats");
  const [lastContentTab, setLastContentTab] = useState<TabId>("stats");

  const { data: storageData, loading, updateStorage } = useBrowserStorage(
    ["sites", "totalTime", "hourly", "history", "settings", "blockedSites", "blockingEnabled", "onboardingDone", "focusSession", "focusStats"],
    {
      sites: {},
      totalTime: 0,
      history: {},
      settings: {
        idleTime: 5,
        dailyLimit: 8,
        enableBlocking: true,
      },
    }
  );

  const handleTabChange = (tabId: TabId): void => {
    setActiveTab(tabId);
  };

  // Settings is a view of its own, opened by the gear; the last content tab is
  // remembered so the gear can take the user back to it
  useEffect(() => {
    if (activeTab !== "settings") setLastContentTab(activeTab);
  }, [activeTab]);

  const openSettings = (): void => setActiveTab("settings");

  const handleToggleSettings = (): void => {
    if (activeTab === "settings") {
      setActiveTab(lastContentTab);
    } else {
      openSettings();
    }
  };

  const dismissWelcome = (): void => {
    updateStorage({ onboardingDone: true });
  };

  // The blocked page's "Manage block list" opens the popup on Settings
  useEffect(() => {
    if (window.location.hash === "#settings") {
      openSettings();
    }
    const onOpenSettings = (): void => openSettings();
    window.addEventListener("openSettingsTab", onOpenSettings);
    return () => window.removeEventListener("openSettingsTab", onOpenSettings);
  }, []);

  // Handle browser messaging for sync updates
  const { } = useBrowserMessaging();

  // The data every tab renders, recomputed only when storage changes so the
  // tabs' own memoised calculations are not redone on every render
  const currentStorageData = useMemo(
    () => ({ ...DEFAULT_STORAGE_DATA, ...storageData }) as StorageData,
    [storageData]
  );

  // Tell the background a popup is open so it saves totals every few seconds
  // while the numbers are on screen (it saves every 30 seconds otherwise)
  useEffect(() => {
    const runtime = browserAPI.runtime as any;
    if (!runtime || !runtime.connect) return;

    let port: any = null;
    let closed = false;
    const connect = () => {
      if (closed) return;
      port = runtime.connect({ name: "popup" });
      // The background worker can be restarted while the popup stays open
      port.onDisconnect.addListener(() => setTimeout(connect, 1000));
    };
    connect();

    return () => {
      closed = true;
      if (port) port.disconnect();
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }



  // A new user (nothing recorded on earlier days) sees the welcome once
  const showWelcome =
    !currentStorageData.onboardingDone &&
    Object.keys(currentStorageData.history || {}).length === 0;

  // Render current tab content
  let currentTab: React.ReactNode;

  switch (activeTab) {
    case "stats": {
      currentTab = (
        <>
          {showWelcome && (
            <WelcomeCard
              onDismiss={dismissWelcome}
              onOpenSettings={() => {
                dismissWelcome();
                openSettings();
              }}
            />
          )}
          <StatsTab data={currentStorageData} />
        </>
      );
      break;
    }
    case "history": {
      currentTab = (
        <HistoryTab data={currentStorageData} />
      );
      break;
    }
    case "sites": {
      currentTab = <SitesTab data={currentStorageData} />;
      break;
    }
    case "focus": {
      currentTab = <FocusTab data={currentStorageData} onOpenSettings={openSettings} />;
      break;
    }
    case "settings": {
      currentTab = (
        <SettingsTab data={currentStorageData} updateStorage={updateStorage} />
      );
      break;
    }
    default: {
      currentTab = <StatsTab data={currentStorageData} />;
    }
  }

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onToggleSettings={handleToggleSettings}
      />

      {currentStorageData.settings?.trackingPaused && activeTab !== "settings" && (
        <button className="paused-notice" onClick={openSettings}>
          Tracking is paused. Nothing is being recorded. Resume in Settings
        </button>
      )}

      <main className="main-tab-content">{currentTab}</main>

      <Footer />
    </div>
  );
};

export default App;

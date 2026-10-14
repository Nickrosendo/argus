import React, { useState, useEffect, useMemo } from "react";
import AuthPage from "./AuthPage";
import Header from "./Header";
import Footer from "./Footer";
import StatsTab from "./tabs/StatsTab";
import HistoryTab from "./tabs/HistoryTab";
import SitesTab from "./tabs/SitesTab";
import FocusTab from "./tabs/FocusTab";
import SettingsTab from "./tabs/SettingsTab";
import AccountTab from "./tabs/AccountTab";
import UpgradePrompt from "./ui/UpgradePrompt";
import WelcomeCard from "./ui/WelcomeCard";
import PaymentModal from "./PaymentModal";
import { mergeRemoteUsage } from "../utils/mergeUsage";
import { StorageData, UserInfo } from "../types/storage";
import { useBrowserStorage } from "../hooks/useBrowserStorage";
import { useBrowserMessaging } from "../hooks/useBrowserMessaging";
import FreeService from "../../services/FreeService";

type TabId = "stats" | "history" | "sites" | "focus" | "settings" | "account" | "auth";

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
  authToken: null,
  userInfo: null,
  freeMode: true,
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(true);
  const [restrictedTabs, setRestrictedTabs] = useState<Set<string>>(new Set());
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  // The user chose to upgrade while signed out: continue to payment after sign-in
  const [pendingUpgrade, setPendingUpgrade] = useState(false);

  const { data: storageData, loading, updateStorage } = useBrowserStorage(
    ["sites", "totalTime", "hourly", "history", "settings", "blockedSites", "blockingEnabled", "remoteDays", "syncEnabled", "userInfo", "authToken", "freeMode", "onboardingDone", "focusSession", "focusStats"],
    {
      sites: {},
      totalTime: 0,
      history: {},
      settings: {
        idleTime: 5,
        dailyLimit: 8,
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

  const handleAuth = async (success: boolean, userData?: { token: string; user: UserInfo }): Promise<void> => {
    if (success && userData) {
      setIsAuthenticated(true);
      
      // Check subscription status to determine if user is premium
      let isPremium = false;
      let updatedUserInfo = userData.user;
      
      try {
        const subscriptionData = await FreeService.checkSubscriptionStatus(userData.token);
        console.log('subscriptionData: ', subscriptionData);
        isPremium = subscriptionData.userType === 'premium';
        
        // Update user info with subscription data
        updatedUserInfo = {
          ...userData.user,
          type: subscriptionData.userType,
          subscriptionStatus: subscriptionData.subscriptionStatus
        };
        
        console.log("Subscription check result:", subscriptionData);
      } catch (error) {
        console.error("Failed to check subscription status:", error);
        // Default to free mode if subscription check fails
        updatedUserInfo = {
          ...userData.user,
          type: 'free'
        };
      } finally {
        setIsCheckingSubscription(false);
      }
      
      setIsFreeMode(!isPremium);

      // Update storage with authenticated user data and subscription status
      updateStorage({
        userInfo: updatedUserInfo,
        authToken: userData.token,
        freeMode: !isPremium,
      });

      // Switch to stats tab after successful authentication
      setActiveTab("stats");

      // Second step of an upgrade that started while signed out
      if (pendingUpgrade && !isPremium) {
        setShowPayment(true);
      }
      setPendingUpgrade(false);

      console.log("Authentication successful:", { 
        user: updatedUserInfo, 
        isPremium, 
        freeMode: !isPremium 
      });
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
    
    setPendingUpgrade(false);

    // Switch to stats tab after choosing free mode
    setActiveTab("stats");
    
    console.log("Entering free mode");
  };

  // The one upgrade path, used by every upgrade button: signed-in users go
  // straight to the plan picker, signed-out users sign in first and continue
  const handleUpgradeClick = (): void => {
    if (isAuthenticated) {
      setShowPayment(true);
    } else {
      setPendingUpgrade(true);
      setActiveTab("auth");
    }
  };

  const dismissWelcome = (): void => {
    updateStorage({ onboardingDone: true });
  };

  // Check authentication status on app load
  useEffect(() => {
    // Set a timeout to prevent banner from showing indefinitely
    const timeoutId = setTimeout(() => {
      setIsCheckingSubscription(false);
    }, 3000); // 3 second timeout

    const checkAuthStatus = async () => {
      if (!loading && storageData) {
        const { userInfo, authToken, freeMode } = storageData;

        if (userInfo && authToken && (userInfo as UserInfo).email) {
          console.log("App load auth check - user is authenticated:", { 
            userEmail: (userInfo as UserInfo).email,
            hasAuthToken: !!authToken,
            currentUserType: userInfo.type
          });
          
          setIsAuthenticated(true);
          
          // Check subscription status to ensure we have current user type
          try {
            const subscriptionData = await FreeService.checkSubscriptionStatus(authToken);
            const isPremium = subscriptionData.userType === 'premium';
            
            // Update user info with fresh subscription data
            const updatedUserInfo = {
              ...userInfo,
              type: subscriptionData.userType,
              subscriptionStatus: subscriptionData.subscriptionStatus
            };
            
            setIsFreeMode(!isPremium);
            
            // Update storage with fresh subscription data
            updateStorage({
              userInfo: updatedUserInfo,
              freeMode: !isPremium
            });
            
            console.log("App load auth check with subscription refresh:", { 
              isAuthenticated: true,
              userInfo: updatedUserInfo, 
              isPremium, 
              isFreeMode: !isPremium,
              userType: subscriptionData.userType 
            });
          } catch (error) {
            console.error("Failed to refresh subscription status on app load:", error);
            // Fall back to stored user info but preserve authentication
            const isFree = userInfo.type !== 'premium';
            setIsFreeMode(isFree);
            
            console.log("App load auth check (fallback - still authenticated):", { 
              isAuthenticated: true,
              userInfo, 
              isFree, 
              userType: userInfo.type 
            });
          } finally {
            setIsCheckingSubscription(false);
            clearTimeout(timeoutId);
          }
        } else {
          // No valid authentication found (no userInfo, authToken, or email)
          setIsAuthenticated(false);
          setIsFreeMode(true);
          setIsCheckingSubscription(false);
          clearTimeout(timeoutId);
          
          // Only show auth tab if explicitly not in free mode
          if (freeMode === false) {
            setActiveTab("auth");
          }
          
          console.log("App load auth check (no authentication):", { 
            userInfo, 
            authToken, 
            freeMode,
            showingAuthTab: freeMode === false
          });
        }
      }
    };
    
    checkAuthStatus();

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId);
    // Re-run only when the signed-in account changes. Depending on the whole
    // storageData object would re-run this (and its API call) on every storage
    // write, including the write this effect makes itself.
  }, [loading, storageData?.authToken, (storageData?.userInfo as UserInfo | null)?.email]);

  // Check which tabs are restricted when free mode changes
  useEffect(() => {
    const checkRestrictions = async () => {
      const restricted = new Set<string>();
      const tabsToCheck = ['focus', 'sites', 'history'];
      
      for (const tabId of tabsToCheck) {
        const isRestricted = await FreeService.isTabRestricted(tabId);
        if (isRestricted) {
          restricted.add(tabId);
        }
      }
      
      setRestrictedTabs(restricted);
    };

    checkRestrictions();
  }, [isFreeMode]);

  // Handle browser messaging for sync updates
  const { } = useBrowserMessaging();

  // The data every tab renders. Recomputed only when storage or the plan
  // changes, so the tabs' own memoised calculations are not redone on every render.
  const currentStorageData = useMemo(() => {
    const localStorageData = { ...DEFAULT_STORAGE_DATA, ...storageData } as StorageData;
    // Premium accounts see their other devices' usage combined with this one's
    return isFreeMode
      ? localStorageData
      : mergeRemoteUsage(localStorageData, localStorageData.remoteDays);
  }, [storageData, isFreeMode]);

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
    case "auth": {
      currentTab = (
        <AuthPage
          onAuth={handleAuth}
          onFreeMode={handleFreeMode}
          upgradeIntent={pendingUpgrade}
        />
      );
      break;
    }
    case "stats": {
      currentTab = (
        <>
          {showWelcome && (
            <WelcomeCard
              onDismiss={dismissWelcome}
              onOpenSettings={() => {
                dismissWelcome();
                setActiveTab("settings");
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
        <HistoryTab data={currentStorageData} isFreeMode={isFreeMode} onUpgrade={handleUpgradeClick} />
      );
      break;
    }
    case "sites": {
      currentTab = <SitesTab data={currentStorageData} />;
      break;
    }
    case "focus": {
      if (restrictedTabs.has('focus')) {
        currentTab = (
          <UpgradePrompt
            featureName="Focus"
            description="Start a timed session and Argus blocks every site on your block list until it ends."
            onUpgrade={handleUpgradeClick}
          />
        );
      } else {
        currentTab = <FocusTab data={currentStorageData} onOpenSettings={() => setActiveTab("settings")} />;
      }
      break;
    }
    case "settings": {
      currentTab = (
        <SettingsTab data={currentStorageData} updateStorage={updateStorage} onUpgrade={handleUpgradeClick} />
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
          onUpgrade={handleUpgradeClick}
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
      {/* Only show header if not showing auth tab */}
      {activeTab !== "auth" && (
        <Header 
          activeTab={activeTab as "stats" | "history" | "sites" | "focus"} 
          onTabChange={handleTabChange}
          onMenuAction={handleMenuAction}
          isAuthenticated={isAuthenticated}
          isFreeMode={isFreeMode}
          onUpgradeClick={handleUpgradeClick}
        />
      )}

      {currentStorageData.settings?.trackingPaused && activeTab !== "auth" && activeTab !== "settings" && (
        <button className="paused-notice" onClick={() => setActiveTab("settings")}>
          Tracking is paused. Nothing is being recorded. Resume in Settings
        </button>
      )}

      <main className="main-tab-content">{currentTab}</main>

      {/* Only show footer if not showing auth tab */}
      {activeTab !== "auth" && <Footer />}

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onPaymentSuccess={() => setShowPayment(false)}
      />
    </div>
  );
};

export default App; 

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
import UpgradePrompt from "./ui/UpgradePrompt";
import { StorageData, UserInfo } from "../types/storage";
import { useBrowserStorage } from "../hooks/useBrowserStorage";
import { useBrowserMessaging } from "../hooks/useBrowserMessaging";
import FreeService from "../../services/FreeService";

type TabId = "stats" | "history" | "sites" | "focus" | "settings" | "account" | "auth";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(true);
  const [restrictedTabs, setRestrictedTabs] = useState<Set<string>>(new Set());
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  const { data: storageData, loading, updateStorage } = useBrowserStorage(
    ["sites", "totalTime", "history", "settings", "blockedSites", "blockingEnabled", "userInfo", "authToken", "freeMode"],
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
    
    // Switch to stats tab after choosing free mode
    setActiveTab("stats");
    
    console.log("Entering free mode");
  };

  const handleUpgradeClick = (): void => {
    // Show auth tab to encourage signup/login
    setActiveTab("auth");
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
      if (restrictedTabs.has('history')) {
        currentTab = (
          <UpgradePrompt
            featureName="Browsing History"
            description="Detailed view of your browsing history and time spent on different websites."
            onUpgrade={handleUpgradeClick}
          />
        );
      } else {
        currentTab = <HistoryTab data={currentStorageData} />;
      }
      break;
    }
    case "sites": {
      if (restrictedTabs.has('sites')) {
        currentTab = (
          <UpgradePrompt
            featureName="Top Visited Sites"
            description="Detailed analytics of your most visited websites and browsing patterns."
            onUpgrade={handleUpgradeClick}
          />
        );
      } else {
        currentTab = <SitesTab data={currentStorageData} />;
      }
      break;
    }
    case "focus": {
      if (restrictedTabs.has('focus')) {
        currentTab = (
          <UpgradePrompt
            featureName="Zen Mode"
            description="Focus timer with website blocking to boost your productivity."
            onUpgrade={handleUpgradeClick}
          />
        );
      } else {
        currentTab = <FocusTab data={currentStorageData} />;
      }
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
      {isFreeMode && !shouldShowAuthTab && !isCheckingSubscription && (
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
          onUpgradeClick={handleUpgradeClick}
        />
      )}

      <main className="main-tab-content">{currentTab}</main>

      {/* Only show footer if not showing auth tab */}
      {activeTab !== "auth" && <Footer />}
    </div>
  );
};

export default App; 

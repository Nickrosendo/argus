// Argus - Authentication JavaScript
import authService from '../services/AuthService.js';
import apiService from '../services/ApiService.js';
import freeService from '../services/FreeService.js';

// Browser API compatibility
(function() {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // Elements
  let authOverlay, signinTab, signupTab, signinForm, signupForm, signinError, signupError, freeButton;
  let accountUsername, accountEmail, accountType, syncStatusText, lastSyncTime, syncNowBtn, signoutBtn, freeModeInfo;
  let freeModeAccountInfo, regularAccountInfo, createAccountBtn, signinAccountBtn;

  // Initialize authentication
  document.addEventListener("DOMContentLoaded", async () => {
    // Initialize elements
    initializeElements();
    
    // Set up auth tab switching
    setupAuthTabs();

    // Set up form submissions
    setupAuthForms();

    // Setup account actions
    setupAccountActions();

    // Check if user is authenticated or in free mode
    await checkAuthenticationAndFreeMode();
  });

  // Initialize all elements
  function initializeElements() {
    authOverlay = document.getElementById("auth-overlay");
    signinTab = document.getElementById("signin-tab");
    signupTab = document.getElementById("signup-tab");
    signinForm = document.getElementById("signin-form");
    signupForm = document.getElementById("signup-form");
    signinError = document.getElementById("signin-error");
    signupError = document.getElementById("signup-error");
    freeButton = document.getElementById("use-free-mode");

    // Account tab elements
    accountUsername = document.getElementById("account-username");
    accountEmail = document.getElementById("account-email");
    accountType = document.getElementById("account-type");
    syncStatusText = document.getElementById("sync-status-text");
    lastSyncTime = document.getElementById("last-sync-time");
    syncNowBtn = document.getElementById("sync-now-btn");
    signoutBtn = document.getElementById("signout-btn");
    freeModeInfo = document.getElementById("free-mode-info");
    
    // Free mode account elements
    freeModeAccountInfo = document.getElementById("free-mode-account-info");
    regularAccountInfo = document.getElementById("regular-account-info");
    createAccountBtn = document.getElementById("create-account-btn");
    signinAccountBtn = document.getElementById("signin-account-btn");
    
    // Debug check for free button
    if (!freeButton) {
      console.error("Free mode button not found!");
    }
    
    // Set up additional account buttons if they exist
    if (createAccountBtn) {
      createAccountBtn.addEventListener("click", () => {
        showAuthOverlay();
        signupTab.click();
      });
    }
    
    if (signinAccountBtn) {
      signinAccountBtn.addEventListener("click", () => {
        showAuthOverlay();
        signinTab.click();
      });
    }
  }

  // Set up authentication tabs
  function setupAuthTabs() {
    signinTab.addEventListener("click", () => {
      signinTab.classList.add("active");
      signupTab.classList.remove("active");
      signinForm.classList.add("active");
      signupForm.classList.remove("active");
      signinError.textContent = "";
      signupError.textContent = "";
    });

    signupTab.addEventListener("click", () => {
      signupTab.classList.add("active");
      signinTab.classList.remove("active");
      signupForm.classList.add("active");
      signinForm.classList.remove("active");
      signinError.textContent = "";
      signupError.textContent = "";
    });
  }

  // Set up authentication forms
  function setupAuthForms() {
    // Handle sign in form submission
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("signin-username").value;
      const password = document.getElementById("signin-password").value;

      try {
        signinError.textContent = "";
        await authService.signin(username, password);
        // If login successful, disable free mode
        await freeService.disableFreeMode();
        await checkAuthenticationAndFreeMode();
      } catch (error) {
        signinError.textContent = error.message;
      }
    });

    // Handle sign up form submission
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("signup-username").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;

      try {
        signupError.textContent = "";
        await authService.signup(username, password, email);
        // If signup successful, disable free mode
        await freeService.disableFreeMode();
        await checkAuthenticationAndFreeMode();
      } catch (error) {
        signupError.textContent = error.message;
      }
    });

    // Handle free mode button click
    if (freeButton) {
      freeButton.addEventListener("click", async () => {
        try {
          console.log("Free mode button clicked");
          await freeService.enableFreeMode();
          await checkAuthenticationAndFreeMode();
        } catch (error) {
          console.error("Error enabling free mode:", error);
        }
      });
    }
  }

  // Set up account actions
  function setupAccountActions() {
    // Handle sync now button
    syncNowBtn.addEventListener("click", async () => {
      const isFreeMode = await freeService.isFreeMode();
      
      if (isFreeMode) {
        // Don't sync in free mode
        return;
      }
      
      try {
        // Send message to background script to trigger sync
        browserAPI.runtime.sendMessage({ action: "syncWithApi" }, (response) => {
          if (response && response.success) {
            // Update last sync time
            const now = new Date();
            lastSyncTime.textContent = now.toLocaleString();
            syncStatusText.textContent = "synced";
          } else {
            syncStatusText.textContent = "failed to sync";
          }
        });
      } catch (error) {
        console.error("Sync error:", error);
        syncStatusText.textContent = "failed to sync";
      }
    });

    // Handle sign out button
    signoutBtn.addEventListener("click", async () => {
      try {
        const isFreeMode = await freeService.isFreeMode();
        
        if (isFreeMode) {
          // In free mode, just disable free mode and show auth overlay
          await freeService.disableFreeMode();
          showAuthOverlay();
        } else {
          // Regular sign out for authenticated users
          await authService.signout();
          await checkAuthenticationAndFreeMode();
        }
      } catch (error) {
        console.error("Sign out error:", error);
      }
    });
  }

  // Show authentication overlay
  function showAuthOverlay() {
    // Clear forms
    signinForm.reset();
    signupForm.reset();
    signinError.textContent = "";
    signupError.textContent = "";
    
    // Show the auth overlay
    authOverlay.style.display = "flex";
    
    // Reset to signin tab by default
    signinTab.click();
  }

  // Check if user is authenticated or in free mode and update UI accordingly
  async function checkAuthenticationAndFreeMode() {
    try {
      const isAuthenticated = await authService.isAuthenticated();
      const isFreeMode = await freeService.isFreeMode();

      if (isAuthenticated) {
        // Hide auth overlay - user is authenticated
        authOverlay.style.display = "none";
        
        // Hide free mode info if visible
        if (freeModeInfo) {
          freeModeInfo.style.display = "none";
        }
        
        // Show regular account info, hide free mode account info
        if (regularAccountInfo) regularAccountInfo.style.display = "block";
        if (freeModeAccountInfo) freeModeAccountInfo.style.display = "none";

        // Load user data
        await loadUserData();

        // Sync data with the API
        await syncData();

        // Update sign out button text
        if (signoutBtn) {
          signoutBtn.textContent = "Sign Out";
        }
      } else if (isFreeMode) {
        // Hide auth overlay - user is in free mode
        authOverlay.style.display = "none";
        
        // Show free mode info if exists
        if (freeModeInfo) {
          freeModeInfo.style.display = "block";
          updateFreeModeInfo();
        }
        
        // Show free mode account info, hide regular account info
        if (regularAccountInfo) regularAccountInfo.style.display = "none";
        if (freeModeAccountInfo) freeModeAccountInfo.style.display = "block";
        
        // Update account section for free mode
        if (accountUsername) accountUsername.textContent = "Free User";
        if (accountEmail) accountEmail.textContent = "Not available in free mode";
        if (accountType) accountType.textContent = "Free";
        if (syncStatusText) syncStatusText.textContent = "not available";
        if (lastSyncTime) lastSyncTime.textContent = "never (free mode)";
        if (syncNowBtn) syncNowBtn.disabled = true;
        
        // Change sign out button to "Switch to Account" in free mode
        if (signoutBtn) {
          signoutBtn.textContent = "Sign In / Sign Up";
        }
      } else {
        // Show auth overlay - user is not authenticated and not in free mode
        showAuthOverlay();
        
        // Hide both account sections until authentication is resolved
        if (regularAccountInfo) regularAccountInfo.style.display = "none";
        if (freeModeAccountInfo) freeModeAccountInfo.style.display = "none";
      }
    } catch (error) {
      console.error("Authentication check error:", error);
      // Show auth overlay on error
      authOverlay.style.display = "flex";
      
      // Hide both account sections on error
      if (regularAccountInfo) regularAccountInfo.style.display = "none";
      if (freeModeAccountInfo) freeModeAccountInfo.style.display = "none";
    }
  }

  // Update free mode info in the UI
  function updateFreeModeInfo() {
    if (!freeModeInfo) return;
    
    const limitations = freeService.getFreeModeInfo();
    
    let limitsList = '';
    limitations.featureRestrictions.forEach(restriction => {
      limitsList += `<li>${restriction}</li>`;
    });
    
    const content = `
      <div class="free-mode-banner">
        <h3>You're using Argus in Free Mode</h3>
        <p>You're using Argus without an account. Some features are limited:</p>
        <ul>${limitsList}</ul>
        <div class="free-mode-actions">
          <button id="upgrade-from-free" class="upgrade-btn">Upgrade to Premium</button>
          <button id="signin-from-free" class="signin-btn">Sign In to Existing Account</button>
        </div>
      </div>
    `;
    
    freeModeInfo.innerHTML = content;
    
    // Add event listener to upgrade button
    const upgradeBtn = document.getElementById("upgrade-from-free");
    if (upgradeBtn) {
      upgradeBtn.addEventListener("click", () => {
        showAuthOverlay();
        signupTab.click();
      });
    }
    
    // Add event listener to sign in button
    const signinBtn = document.getElementById("signin-from-free");
    if (signinBtn) {
      signinBtn.addEventListener("click", () => {
        showAuthOverlay();
        signinTab.click();
      });
    }
  }

  // Load user data into account tab
  async function loadUserData() {
    try {
      const userData = await apiService.getUser();

      // Update UI with user data
      if (userData && accountUsername) {
        accountUsername.textContent = userData.username || "Unknown";
        accountEmail.textContent = userData.email || "Not provided";
        accountType.textContent =
          userData.type?.charAt(0).toUpperCase() + userData.type?.slice(1) || "Standard";
      }
    } catch (error) {
      console.error("Load user data error:", error);
      if (accountUsername) accountUsername.textContent = "Error loading data";
      if (accountEmail) accountEmail.textContent = "Error loading data";
      if (accountType) accountType.textContent = "Error loading data";
    }
  }

  // Sync data with the API
  async function syncData() {
    try {
      const isFreeMode = await freeService.isFreeMode();
      
      if (isFreeMode) {
        // Don't sync in free mode
        if (syncStatusText) syncStatusText.textContent = "not available";
        if (lastSyncTime) lastSyncTime.textContent = "never (free mode)";
        if (syncNowBtn) syncNowBtn.disabled = true;
        return;
      }
      
      if (syncStatusText) syncStatusText.textContent = "syncing";
      if (syncNowBtn) syncNowBtn.disabled = true;

      try {
        // Send message to background script to trigger sync
        browserAPI.runtime.sendMessage({ action: "syncWithApi" }, (response) => {
          if (response && response.success) {
            // Update last sync time
            const now = new Date();
            if (lastSyncTime) lastSyncTime.textContent = now.toLocaleString();
            if (syncStatusText) syncStatusText.textContent = "synced";
            if (syncNowBtn) syncNowBtn.disabled = false;
          } else {
            if (syncStatusText) syncStatusText.textContent = "failed to sync";
            if (syncNowBtn) syncNowBtn.disabled = false;
          }
        });
      } catch (error) {
        console.error("Sync error:", error);
        if (syncStatusText) syncStatusText.textContent = "failed to sync";
        if (syncNowBtn) syncNowBtn.disabled = false;
      }
    } catch (error) {
      console.error("Sync setup error:", error);
      if (syncStatusText) syncStatusText.textContent = "error";
      if (syncNowBtn) syncNowBtn.disabled = false;
    }
  }
})();

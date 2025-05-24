// Argus - Authentication JavaScript

// Browser API compatibility
(() => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // Import services
  const getAuthService = async () => {
    return (await import("../services/AuthService.js")).default;
  };

  const getApiService = async () => {
    return (await import("../services/ApiService.js")).default;
  };

  // Elements
  const authOverlay = document.getElementById("auth-overlay");
  const signinTab = document.getElementById("signin-tab");
  const signupTab = document.getElementById("signup-tab");
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const signinError = document.getElementById("signin-error");
  const signupError = document.getElementById("signup-error");

  // Account tab elements
  const accountUsername = document.getElementById("account-username");
  const accountEmail = document.getElementById("account-email");
  const accountType = document.getElementById("account-type");
  const syncStatusText = document.getElementById("sync-status-text");
  const lastSyncTime = document.getElementById("last-sync-time");
  const syncNowBtn = document.getElementById("sync-now-btn");
  const signoutBtn = document.getElementById("signout-btn");

  // Initialize authentication
  document.addEventListener("DOMContentLoaded", async () => {
    // Set up auth tab switching
    setupAuthTabs();

    // Set up form submissions
    setupAuthForms();

    // Setup account actions
    setupAccountActions();

    // Check if user is authenticated
    await checkAuthentication();
  });

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
        const authService = await getAuthService();
        await authService.signin(username, password);
        await checkAuthentication();
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
        const authService = await getAuthService();
        await authService.signup(username, password, email);
        await checkAuthentication();
      } catch (error) {
        signupError.textContent = error.message;
      }
    });
  }

  // Set up account actions
  function setupAccountActions() {
    // Handle sync now button
    syncNowBtn.addEventListener("click", async () => {
      await syncData();
    });

    // Handle sign out button
    signoutBtn.addEventListener("click", async () => {
      try {
        const authService = await getAuthService();
        await authService.signout();
        await checkAuthentication();
      } catch (error) {
        console.error("Sign out error:", error);
      }
    });
  }

  // Check if user is authenticated and show/hide auth overlay
  async function checkAuthentication() {
    try {
      const authService = await getAuthService();
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated) {
        // Hide auth overlay
        authOverlay.style.display = "none";

        // Load user data
        await loadUserData();

        // Sync data with the API
        await syncData();
      } else {
        // Show auth overlay
        authOverlay.style.display = "flex";

        // Clear forms
        signinForm.reset();
        signupForm.reset();
      }
    } catch (error) {
      console.error("Authentication check error:", error);
      // Show auth overlay on error
      authOverlay.style.display = "flex";
    }
  }

  // Load user data into account tab
  async function loadUserData() {
    try {
      const apiService = await getApiService();
      const userData = await apiService.getUser();

      // Update UI with user data
      if (userData) {
        accountUsername.textContent = userData.username;
        accountEmail.textContent = userData.email || "Not provided";
        accountType.textContent =
          userData.type.charAt(0).toUpperCase() + userData.type.slice(1);
      }
    } catch (error) {
      console.error("Load user data error:", error);
      accountUsername.textContent = "Error loading data";
      accountEmail.textContent = "Error loading data";
      accountType.textContent = "Error loading data";
    }
  }

  // Sync data with the API
  async function syncData() {
    try {
      syncStatusText.textContent = "syncing";
      syncNowBtn.disabled = true;

      const apiService = await getApiService();

      // Get user data first to get the userId
      const userData = await apiService.getUser();

      if (!userData) {
        throw new Error("User data not available");
      }

      // Get stored browser usage data
      const { sites = {} } = await new Promise((resolve) => {
        browserAPI.storage.local.get(["sites"], resolve);
      });

      // Generate a device ID if not already stored
      let { deviceId } = await new Promise((resolve) => {
        browserAPI.storage.local.get(["deviceId"], resolve);
      });

      if (!deviceId) {
        deviceId = `argus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await new Promise((resolve) => {
          browserAPI.storage.local.set({ deviceId }, resolve);
        });
      }

      // Sync the data with the API
      await apiService.syncBrowserUsage(userData.id, deviceId, { sites });

      // Update UI
      syncStatusText.textContent = "synced";
      lastSyncTime.textContent = new Date().toLocaleTimeString();
    } catch (error) {
      console.error("Sync error:", error);
      syncStatusText.textContent = "failed to sync";
    } finally {
      syncNowBtn.disabled = false;
    }
  }
})();

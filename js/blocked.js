// Argus - Blocked Website JavaScript

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockedDomain = urlParams.get('domain');
const originalUrl = urlParams.get('url');

// DOM elements
const blockedDomainEl = document.getElementById('blocked-domain');
const unblockCountEl = document.getElementById('unblocks-remaining');
const goBackBtn = document.getElementById('go-back');
const openSettingsBtn = document.getElementById('open-settings');
const removeFromBlocklistBtn = document.getElementById('remove-from-blocklist');

// Unblock duration buttons
const unblock5minBtn = document.getElementById('unblock-5min');
const unblock15minBtn = document.getElementById('unblock-15min');
const unblock30minBtn = document.getElementById('unblock-30min');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Display the blocked domain
  if (blockedDomain) {
    blockedDomainEl.textContent = blockedDomain;
  }

  // Get the remaining unblock count for today
  const data = await getStorageData();
  
  // Initialize unblock counter for today if not set
  if (!data.unblockData || data.unblockData.date !== getTodayDateString()) {
    await resetDailyUnblocks();
    unblockCountEl.textContent = '3';
  } else {
    unblockCountEl.textContent = data.unblockData.remaining;
  }

  // Set up event listeners
  setupEventListeners();
});

// Setup event listeners for all buttons
function setupEventListeners() {
  // Go back button
  goBackBtn.addEventListener('click', () => {
    window.history.back();
  });

  // Open settings button
  openSettingsBtn.addEventListener('click', () => {
    browserAPI.runtime.sendMessage({ 
      action: 'openBlocklistSettings' 
    });
  });

  // Remove from blocklist permanently
  removeFromBlocklistBtn.addEventListener('click', async () => {
    if (blockedDomain) {
      await removeFromBlocklist(blockedDomain);
      if (originalUrl) {
        window.location.href = originalUrl;
      }
    }
  });

  // Temporary unblock buttons
  unblock5minBtn.addEventListener('click', () => {
    temporaryUnblock(5);
  });

  unblock15minBtn.addEventListener('click', () => {
    temporaryUnblock(15);
  });

  unblock30minBtn.addEventListener('click', () => {
    temporaryUnblock(30);
  });
}

// Get storage data
async function getStorageData() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['blockedSites', 'unblockData'], (result) => {
      resolve(result);
    });
  });
}

// Set storage data
async function setStorageData(data) {
  return new Promise((resolve) => {
    browserAPI.storage.local.set(data, () => {
      resolve();
    });
  });
}

// Remove a domain from the blocklist
async function removeFromBlocklist(domain) {
  const data = await getStorageData();
  const blockedSites = data.blockedSites || [];
  
  // Remove the domain from the blocklist
  const updatedBlocklist = blockedSites.filter(site => site !== domain);
  
  // Update storage
  await setStorageData({ blockedSites: updatedBlocklist });
  
  // Notify background script to update blocking rules
  browserAPI.runtime.sendMessage({ 
    action: 'updateBlockedSites' 
  });
}

// Temporarily unblock a site for the specified number of minutes
async function temporaryUnblock(minutes) {
  // Check if unblocks are available
  const data = await getStorageData();
  
  // Initialize if not set
  if (!data.unblockData || data.unblockData.date !== getTodayDateString()) {
    await resetDailyUnblocks();
    data.unblockData = {
      date: getTodayDateString(),
      remaining: 3,
      temporaryUnblocks: {}
    };
  }
  
  // Check if any unblocks left
  if (data.unblockData.remaining <= 0) {
    alert('You have no unblocks remaining today. Try again tomorrow.');
    return;
  }
  
  // Decrement unblock count
  data.unblockData.remaining--;
  unblockCountEl.textContent = data.unblockData.remaining;
  
  // Add temporary exception for this domain
  if (!data.unblockData.temporaryUnblocks) {
    data.unblockData.temporaryUnblocks = {};
  }
  
  // Set expiration time
  const expirationTime = Date.now() + (minutes * 60 * 1000);
  data.unblockData.temporaryUnblocks[blockedDomain] = expirationTime;
  
  // Update storage
  await setStorageData({ unblockData: data.unblockData });
  
  // Notify background script to update temporary unblocks
  browserAPI.runtime.sendMessage({ 
    action: 'updateTemporaryUnblocks',
    domain: blockedDomain,
    expirationTime: expirationTime
  });
  
  // Redirect to the original URL
  if (originalUrl) {
    window.location.href = originalUrl;
  }
}

// Reset daily unblock count
async function resetDailyUnblocks() {
  const unblockData = {
    date: getTodayDateString(),
    remaining: 3,
    temporaryUnblocks: {}
  };
  
  await setStorageData({ unblockData: unblockData });
  return unblockData;
}

// Get today's date as a string
function getTodayDateString() {
  return new Date().toDateString();
} 
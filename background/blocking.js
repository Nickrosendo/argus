// Website blocking: network rules, temporary unblocks and navigation checks
import browserApiService from "../services/BrowserApiService";
import {
  FREE_MODE_MAX_BLOCKED_SITES,
} from './constants.js';
import { state } from './state.js';

// Update the blocked sites configuration
export async function updateBlockedSites() {
  const result = await browserApiService.getStorage([
    "blockingEnabled",
    "blockedSites",
    "settings",
    "freeMode",
  ]);
  // Check both blockingEnabled and settings.enableBlocking for compatibility
  const blockingEnabled =
    result.blockingEnabled || result.settings?.enableBlocking || false;
  let blockedSites = result.blockedSites || [];
  const isFreeMode = result.freeMode === true;

  // In free mode only the first few sites are enforced. The stored list is
  // left intact so nothing is lost if the account is premium again later.
  if (isFreeMode && blockedSites.length > FREE_MODE_MAX_BLOCKED_SITES) {
    blockedSites = blockedSites.slice(0, FREE_MODE_MAX_BLOCKED_SITES);
  }

  // Filter out temporarily unblocked sites for the network rules
  const currentlyBlockedSites = blockedSites.filter(site => !isTemporarilyUnblocked(site));

  // Update the actual network blocking rules
  console.log(`Updating network blocking rules: ${blockingEnabled ? 'enabled' : 'disabled'}, blocking ${currentlyBlockedSites.length} sites`);
  await browserApiService.updateBlockedSites(currentlyBlockedSites, blockingEnabled);
}

// Check and clean up expired temporary unblocks
export async function checkTemporaryUnblocks() {
  const now = Date.now();
  let hasChanges = false;

  // Check each temporary unblock
  for (const domain in state.temporaryUnblocks) {
    if (state.temporaryUnblocks[domain] <= now) {
      console.log(`Temporary unblock for ${domain} has expired`);
      delete state.temporaryUnblocks[domain];
      hasChanges = true;
    }
  }

  // If we made changes, update the storage and blocking rules
  if (hasChanges) {
    const data = await browserApiService.getStorage(["unblockData"]);

    if (data.unblockData) {
      data.unblockData.temporaryUnblocks = state.temporaryUnblocks;
      await browserApiService.setStorage({ unblockData: data.unblockData });
    }

    // Update the network blocking rules to re-block expired temporary unblocks
    await updateBlockedSites();
  }
}

// Check and reset unblock data if it's a new day
export async function checkAndResetUnblockData() {
  const data = await browserApiService.getStorage(["unblockData"]);
  const today = new Date().toDateString();

  if (data.unblockData && data.unblockData.date !== today) {
    console.log("Resetting unblock data for new day");

    // Keep any valid temporary unblocks
    const validUnblocks = {};
    for (const [domain, expiry] of Object.entries(
      data.unblockData.temporaryUnblocks || {}
    )) {
      if (expiry > Date.now()) {
        validUnblocks[domain] = expiry;
      }
    }

    const newUnblockData = {
      date: today,
      remaining: 3,
      temporaryUnblocks: validUnblocks,
    };

    await browserApiService.setStorage({ unblockData: newUnblockData });
    state.temporaryUnblocks = validUnblocks;
  }
}

// Check if a domain is temporarily unblocked
export function isTemporarilyUnblocked(domain) {
  // Clean domain for comparison
  const cleanDomain = domain.replace(/^www\./, "");

  // Check each temporary unblock entry
  for (const [tempDomain, expirationTime] of Object.entries(
    state.temporaryUnblocks
  )) {
    const cleanTempDomain = tempDomain.replace(/^www\./, "");

    // Check if domains match and the unblock hasn't expired
    if (
      (cleanDomain === cleanTempDomain ||
        cleanDomain.endsWith(`.${cleanTempDomain}`)) &&
      expirationTime > Date.now()
    ) {
      return true;
    }
  }

  return false;
}

// Handle temporary unblock
export async function handleTemporaryUnblock(domain, expirationTime) {
  // Update local state
  state.temporaryUnblocks[domain] = expirationTime;

  console.log(
    `Temporarily unblocked ${domain} until ${new Date(expirationTime).toLocaleTimeString()}`
  );

  // Update the network blocking rules immediately to reflect the temporary unblock
  await updateBlockedSites();
}

// Handle website navigation for blocking checks
export async function handleBeforeNavigate(details) {
  console.log('Handling before navigate for URL:', details);
  // Only handle main frame navigation (not iframes, images, etc.)
  if (details.frameId !== 0) return;
  
  try {
    const shouldBlock = await isUrlBlocked(details.url);
    console.log('should block: ', shouldBlock);
    if (shouldBlock) {
      console.log(`Blocking navigation to ${details.url}`);
      // The declarativeNetRequest rules should handle the redirect
      // But we can also track the block attempt
      await trackBlockedAttempt(details.url);
    }
  } catch (error) {
    console.error("Error checking blocked URL:", error);
  }
}

// Check if a URL should be blocked
export async function isUrlBlocked(url) {
  try {
    // Skip extension URLs and special URLs
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') || 
        url.startsWith('moz-extension://') || 
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('safari-extension://')) {
      return false;
    }

    // Get blocking configuration
    const result = await browserApiService.getStorage([
      'blockingEnabled',
      'blockedSites',
      'freeMode'
    ]);

    console.log('Checking if URL is blocked:', url);
    
    const blockingEnabled = result.blockingEnabled || false;
    const blockedSites = result.blockedSites || [];
    const isFreeMode = result.freeMode === true;

    // If blocking is not enabled, don't block anything
    if (!blockingEnabled || blockedSites.length === 0) {
      return false;
    }

    // Parse the URL to get the domain
    let domain;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.toLowerCase();
    } catch (error) {
      console.error("Invalid URL:", url);
      return false;
    }
    console.log(`Checking domain ${domain} against blocked sites`);

    console.log(`Blocked sites: ${blockedSites}`);
    // Check if the domain is in the blocked list
    for (const blockedSite of blockedSites) {
      const cleanBlockedSite = blockedSite.replace(/^www\./, '').toLowerCase();
      const cleanDomain = domain.replace(/^www\./, '');

      // Check exact match or subdomain match
      if (cleanDomain === cleanBlockedSite || 
          cleanDomain.endsWith(`.${cleanBlockedSite}`)) {
        
        // Check if it's temporarily unblocked
        if (isTemporarilyUnblocked(cleanBlockedSite)) {
          console.log(`Site ${cleanBlockedSite} is temporarily unblocked`);
          return false;
        }

        // In free mode, apply additional restrictions if needed
        if (isFreeMode) {
          // For now, free mode users can block sites same as premium
          // but we could add additional logic here
        }

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking if URL is blocked:", error);
    return false;
  }
}

// Track blocked attempts for analytics/debugging
export async function trackBlockedAttempt(url) {
  try {
    const result = await browserApiService.getStorage(['blockedAttempts']);
    const blockedAttempts = result.blockedAttempts || {};
    
    const domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const today = new Date().toDateString();
    
    if (!blockedAttempts[today]) {
      blockedAttempts[today] = {};
    }
    
    blockedAttempts[today][domain] = (blockedAttempts[today][domain] || 0) + 1;
    
    // Keep only last 7 days of blocked attempts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    Object.keys(blockedAttempts).forEach(date => {
      if (new Date(date) < sevenDaysAgo) {
        delete blockedAttempts[date];
      }
    });
    
    await browserApiService.setStorage({ blockedAttempts });
    
    console.log(`Blocked attempt recorded for ${domain}`);
  } catch (error) {
    console.error("Error tracking blocked attempt:", error);
  }
}

// Redirect to blocked page (fallback for cases where declarativeNetRequest doesn't work)
export async function redirectToBlockedPage(tabId, url) {
  try {
    const domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const blockedPageUrl = browserApiService.getExtensionUrl(`blocked.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}`);
    
    await browserApiService.updateTab(tabId, blockedPageUrl);
    console.log(`Redirected tab ${tabId} to blocked page for ${domain}`);
  } catch (error) {
    console.error("Error redirecting to blocked page:", error);
  }
}

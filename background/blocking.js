// Website blocking: network rules, temporary unblocks and navigation checks
import browserApiService from "../services/BrowserApiService";
import { state, isFocusActive, persistTrackingState } from './state.js';
import { enqueueStorageWrite } from './writeQueue.js';

// Update the blocked sites configuration
export async function updateBlockedSites() {
  const result = await browserApiService.getStorage([
    "blockingEnabled",
    "blockedSites",
    "settings",
  ]);
  // Check both blockingEnabled and settings.enableBlocking for compatibility
  // A focus session blocks the list even when blocking is switched off
  const focusActive = isFocusActive();
  const blockingEnabled =
    focusActive || result.blockingEnabled || result.settings?.enableBlocking || false;
  const blockedSites = result.blockedSites || [];

  // Filter out temporarily unblocked sites for the network rules
  // ...and ignores temporary unblocks until it ends
  const currentlyBlockedSites = focusActive
    ? blockedSites
    : blockedSites.filter(site => !isTemporarilyUnblocked(site));

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
  if (isFocusActive()) {
    throw new Error("A focus session is running. Sites stay blocked until it ends.");
  }

  // Update local state
  state.temporaryUnblocks[domain] = expirationTime;

  console.log(
    `Temporarily unblocked ${domain} until ${new Date(expirationTime).toLocaleTimeString()}`
  );

  // Update the network blocking rules immediately to reflect the temporary unblock
  await updateBlockedSites();
}

// The same visit can be reported by both the navigation and the tab change
const REPEAT_WINDOW_MS = 2000;
const recentBlocks = new Map(); // tabId -> { url, at }
// A tab going back from the blocked page passes through the blocked address,
// which Chrome keeps in the history just before the blocked page
const leavingBlockedPage = new Map(); // tabId -> { url, at }
// The navigation check running in each tab; the tab-change fallback waits for it
const navigationChecks = new Map(); // tabId -> Promise

const isRecent = (entries, tabId, url) => {
  const entry = entries.get(tabId);
  return !!entry && entry.url === url && Date.now() - entry.at < REPEAT_WINDOW_MS;
};

// Send a tab to the blocked page and count the attempt, once per visit
async function sendToBlockedPage(tabId, url, blockedSite) {
  if (isRecent(recentBlocks, tabId, url) || isRecent(leavingBlockedPage, tabId, url)) return;
  recentBlocks.set(tabId, { url, at: Date.now() });

  if (!(await redirectToBlockedPage(tabId, url, blockedSite))) {
    // Not switched (e.g. the tab could not be edited): leave it to the fallback
    recentBlocks.delete(tabId);
    return;
  }
  await trackBlockedAttempt(url);
}

// The tab-change fallback: blocks a visit the navigation check did not handle
export async function blockTab(tabId, url, blockedSite) {
  if (!(tabId >= 0)) return;
  await navigationChecks.get(tabId);
  await sendToBlockedPage(tabId, url, blockedSite);
}

// Which blocked address each tab's blocked page replaced. Going back from the
// blocked page reopens that address, so it must not be blocked again. The tab
// itself cannot tell: by the time the worker asks, it may already show the
// browser's error page for the address.
function setBlockedPageTab(tabId, url) {
  if (url) state.blockedPageTabs[tabId] = url;
  else delete state.blockedPageTabs[tabId];
  persistTrackingState();
}

async function checkNavigation({ tabId, url }) {
  try {
    const replacedUrl = state.blockedPageTabs[tabId];
    const blockedSite = await findBlockedSite(url);
    // Any other address (not the blocked page itself): the tab has moved on
    if (replacedUrl && !url.startsWith(browserApiService.getExtensionUrl('blocked.html'))) {
      setBlockedPageTab(tabId, null);
    }
    if (!blockedSite) return;

    // Going back from the blocked page: step back once more instead of
    // blocking the same address again, which would trap the tab. (Typing the
    // same address again on the blocked page looks the same, and also steps back.)
    if (replacedUrl === url) {
      leavingBlockedPage.set(tabId, { url, at: Date.now() });
      if (await browserApiService.goBack(tabId)) return;
      // Nothing to go back to (the blocked site opened the tab): show the
      // blocked page again rather than the browser's error page (not a new attempt)
      leavingBlockedPage.delete(tabId);
      recentBlocks.set(tabId, { url, at: Date.now() });
      if (!(await redirectToBlockedPage(tabId, url, blockedSite))) recentBlocks.delete(tabId);
      return;
    }

    console.log(`Blocking navigation to ${url}`);
    await sendToBlockedPage(tabId, url, blockedSite);
  } catch (error) {
    console.error("Error checking blocked URL:", error);
  }
}

// Block a blocked site as soon as a tab starts opening it, in any tab. The
// network rules only stop the request ("block" needs no access to the site);
// switching the tab to the blocked page is done here.
export function handleBeforeNavigate(details) {
  // Only handle main frame navigation (not iframes, images, etc.)
  if (details.frameId !== 0 || !(details.tabId >= 0)) return;
  // Chrome loads some pages ahead, while an address is typed; the network rules
  // stop those, and the visit comes through here again once it is opened
  if (details.documentLifecycle === 'prerender') return;

  const check = checkNavigation(details);
  navigationChecks.set(details.tabId, check);
  check.then(() => {
    if (navigationChecks.get(details.tabId) === check) navigationChecks.delete(details.tabId);
  });
  return check;
}

// Check if a URL should be blocked
export async function isUrlBlocked(url) {
  return (await findBlockedSite(url)) !== null;
}

// The block list entry a URL falls under (e.g. "a.com" for sub.a.com), or null
// when it should not be blocked right now
export async function findBlockedSite(url) {
  try {
    // Skip extension URLs and special URLs
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') || 
        url.startsWith('moz-extension://') || 
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('safari-extension://')) {
      return null;
    }

    // Get blocking configuration
    const result = await browserApiService.getStorage([
      'blockingEnabled',
      'blockedSites',
      'settings',
    ]);

    console.log('Checking if URL is blocked:', url);
    
    const focusActive = isFocusActive();
    const blockingEnabled =
      focusActive || result.blockingEnabled || result.settings?.enableBlocking || false;
    const blockedSites = result.blockedSites || [];

    // If blocking is not enabled, don't block anything
    if (!blockingEnabled || blockedSites.length === 0) {
      return null;
    }

    // Parse the URL to get the domain
    let domain;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.toLowerCase();
    } catch (error) {
      console.error("Invalid URL:", url);
      return null;
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
        if (!focusActive && isTemporarilyUnblocked(cleanBlockedSite)) {
          console.log(`Site ${cleanBlockedSite} is temporarily unblocked`);
          return null;
        }

        return cleanBlockedSite;
      }
    }

    return null;
  } catch (error) {
    console.error("Error checking if URL is blocked:", error);
    return null;
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

    // Also counted for the running focus session, if any
    if (isFocusActive()) {
      await enqueueStorageWrite(async () => {
        const { focusStats } = await browserApiService.getStorage(['focusStats']);
        if (focusStats && focusStats.date === today) {
          focusStats.blocked = (focusStats.blocked || 0) + 1;
          await browserApiService.setStorage({ focusStats });
        }
      });
    }
    
    console.log(`Blocked attempt recorded for ${domain}`);
  } catch (error) {
    console.error("Error tracking blocked attempt:", error);
  }
}

// Switch a tab to the blocked page; returns whether it worked. "domain" is the
// block list entry: the page unblocks or removes exactly that
export async function redirectToBlockedPage(tabId, url, blockedSite) {
  try {
    const domain = blockedSite || new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const blockedPageUrl = browserApiService.getExtensionUrl(`blocked.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}`);
    
    const tab = await browserApiService.updateTab(tabId, blockedPageUrl);
    if (!tab) return false;
    setBlockedPageTab(tabId, url);
    console.log(`Redirected tab ${tabId} to blocked page for ${domain}`);
    return true;
  } catch (error) {
    console.error("Error redirecting to blocked page:", error);
    return false;
  }
}

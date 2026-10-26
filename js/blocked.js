// Argus - Blocked Website JavaScript

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const DAILY_UNBLOCKS = 3;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockedDomain = urlParams.get('domain');
const originalUrl = urlParams.get('url');

// DOM elements
const blockedDomainEl = document.getElementById('blocked-domain');
const unblockCountEl = document.getElementById('unblocks-remaining');
const unblockOptionsEl = document.getElementById('unblock-options');
const focusNoticeEl = document.getElementById('focus-notice');
const focusEndsEl = document.getElementById('focus-ends');
const attemptsEl = document.getElementById('attempts-today');
const messageEl = document.getElementById('blocked-message');
const goBackBtn = document.getElementById('go-back');
const openSettingsBtn = document.getElementById('open-settings');
const removeFromBlocklistBtn = document.getElementById('remove-from-blocklist');
const unblockButtons = [
  { el: document.getElementById('unblock-5min'), minutes: 5 },
  { el: document.getElementById('unblock-15min'), minutes: 15 },
  { el: document.getElementById('unblock-30min'), minutes: 30 },
];

// Light, dark or follow the computer, as chosen in Settings. js/theme-init.js
// already applied the cached choice; this follows the stored setting.
function applyThemeSetting(settings) {
  const theme = settings && settings.theme;
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
  try {
    localStorage.setItem('argusTheme', theme === 'light' || theme === 'dark' ? theme : 'system');
  } catch (error) {
    // The theme still applies for this page
  }
}

browserAPI.storage.local.get(['settings'], (data) => applyThemeSetting(data && data.settings));

const stripWww = (domain) => String(domain || '').toLowerCase().replace(/^www\./, '');

// Where to send the user once the site is allowed again. Only an http(s)
// address on the blocked site itself is accepted; anything else in the "url"
// parameter is ignored.
function getReturnUrl() {
  const fallback = blockedDomain ? `https://${blockedDomain}/` : null;
  if (!originalUrl) return fallback;

  try {
    const parsed = new URL(originalUrl);
    const host = stripWww(parsed.hostname);
    const blocked = stripWww(blockedDomain);
    const sameSite = host === blocked || host.endsWith(`.${blocked}`);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && sameSite ? parsed.href : fallback;
  } catch (error) {
    return fallback;
  }
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}

function getStorageData() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['blockedSites', 'unblockData', 'focusSession', 'blockedAttempts'], resolve);
  });
}

function setStorageData(data) {
  return new Promise((resolve) => {
    browserAPI.storage.local.set(data, resolve);
  });
}

function sendMessage(message) {
  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage(message, (response) => {
      // Reading lastError marks a failed delivery as handled
      resolve(browserAPI.runtime.lastError ? null : response);
    });
  });
}

function getTodayDateString() {
  return new Date().toDateString();
}

// Today's unblock allowance, started fresh each day
function getUnblockData(data) {
  return data.unblockData && data.unblockData.date === getTodayDateString()
    ? data.unblockData
    : { date: getTodayDateString(), remaining: DAILY_UNBLOCKS, temporaryUnblocks: {} };
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  if (blockedDomain) {
    blockedDomainEl.textContent = blockedDomain;
  }

  const data = await getStorageData();

  // How often this site was stopped today
  const attempts = ((data.blockedAttempts || {})[getTodayDateString()] || {})[stripWww(blockedDomain)] || 0;
  if (attempts > 0) {
    attemptsEl.textContent = `Argus has stopped you here ${attempts} time${attempts === 1 ? '' : 's'} today.`;
    attemptsEl.hidden = false;
  }

  // During a focus session the site stays blocked until the session ends
  const focusSession = data.focusSession;
  if (focusSession && focusSession.endsAt > Date.now()) {
    focusEndsEl.textContent = new Date(focusSession.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    focusNoticeEl.hidden = false;
    unblockOptionsEl.hidden = true;
  } else {
    unblockCountEl.textContent = getUnblockData(data).remaining;
  }

  setupEventListeners();
});

function setupEventListeners() {
  goBackBtn.addEventListener('click', () => {
    window.history.back();
  });

  openSettingsBtn.addEventListener('click', () => {
    sendMessage({ action: 'openBlocklistSettings' });
  });

  // Removing a site for good takes a second, deliberate click
  let removeArmed = false;
  removeFromBlocklistBtn.addEventListener('click', async () => {
    if (!blockedDomain) return;

    if (!removeArmed) {
      removeArmed = true;
      removeFromBlocklistBtn.textContent = `Click again to stop blocking ${blockedDomain}`;
      setTimeout(() => {
        removeArmed = false;
        removeFromBlocklistBtn.textContent = 'Remove from block list permanently';
      }, 5000);
      return;
    }

    await removeFromBlocklist(blockedDomain);
    const returnUrl = getReturnUrl();
    if (returnUrl) window.location.href = returnUrl;
  });

  unblockButtons.forEach(({ el, minutes }) => {
    el.addEventListener('click', () => temporaryUnblock(minutes));
  });
}

// Remove a domain from the blocklist
async function removeFromBlocklist(domain) {
  const data = await getStorageData();
  const target = stripWww(domain);

  await setStorageData({
    blockedSites: (data.blockedSites || []).filter((site) => stripWww(site) !== target),
  });

  // Wait for the background to rewrite the blocking rules
  await sendMessage({ action: 'updateBlockedSites' });
}

// Temporarily unblock a site for the specified number of minutes
async function temporaryUnblock(minutes) {
  const data = await getStorageData();
  const unblockData = getUnblockData(data);

  if (unblockData.remaining <= 0) {
    showMessage('You have no unblocks left today. They reset tomorrow.');
    return;
  }

  // Ask the background first: it refuses during a focus session, and an
  // unblock is only used up once the site is really unblocked
  const expirationTime = Date.now() + minutes * 60 * 1000;
  const response = await sendMessage({
    action: 'updateTemporaryUnblocks',
    domain: blockedDomain,
    expirationTime: expirationTime,
  });

  if (!response || !response.success) {
    showMessage((response && response.error) || 'Could not unblock the site. Please try again.');
    return;
  }

  unblockData.remaining -= 1;
  unblockData.temporaryUnblocks = { ...(unblockData.temporaryUnblocks || {}), [blockedDomain]: expirationTime };
  await setStorageData({ unblockData });
  unblockCountEl.textContent = unblockData.remaining;

  const returnUrl = getReturnUrl();
  if (returnUrl) window.location.href = returnUrl;
}

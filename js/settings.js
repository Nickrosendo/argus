// Import free service
import freeService from '../services/FreeService';

// Free mode constants
const FREE_MODE_MAX_BLOCKED_SITES = 3;

// ... existing code ...

// Handle adding a new blocked site
document.getElementById('add-blocked-site').addEventListener('click', async () => {
  const input = document.getElementById('new-blocked-site');
  const site = input.value.trim();
  
  if (!site) return;
  
  // Get current blocked sites
  const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
  
  // Check if site is already blocked
  if (blockedSites.includes(site)) {
    showNotification('This site is already blocked.', 'warning');
    return;
  }
  
  // Check for free mode limitations
  const isFreeMode = await freeService.isFreeMode();
  if (isFreeMode && blockedSites.length >= FREE_MODE_MAX_BLOCKED_SITES) {
    // Show upgrade message if in free mode and at limit
    const shouldShowAd = await freeService.trackKeyAction();
    if (shouldShowAd) {
      await freeService.displayAd();
    } else {
      showFreeModeLimitMessage();
    }
    return;
  }
  
  // Add to blocked sites
  blockedSites.push(site);
  await browser.storage.local.set({ blockedSites });
  
  // Clear input and update the UI
  input.value = '';
  renderBlockedSites();
  
  // Notify background script to update rules
  browser.runtime.sendMessage({ action: 'updateBlockedSites' });
  
  showNotification(`${site} has been blocked.`, 'success');
});

// ... existing code ...

// Function to show free mode limit message
function showFreeModeLimitMessage() {
  const message = document.createElement('div');
  message.className = 'free-limit-message';
  message.innerHTML = `
    <div class="free-limit-content">
      <h3>Free Mode Limit Reached</h3>
      <p>You can block up to ${FREE_MODE_MAX_BLOCKED_SITES} websites in Free Mode.</p>
      <p>Upgrade to Premium for unlimited website blocking.</p>
      <button id="free-limit-upgrade" class="upgrade-btn">Upgrade to Premium</button>
      <button id="free-limit-close" class="cancel-btn">Close</button>
    </div>
  `;
  
  document.body.appendChild(message);
  
  // Add event listeners
  document.getElementById('free-limit-upgrade').addEventListener('click', () => {
    // Show authentication overlay with signup tab active
    const authOverlay = document.getElementById('auth-overlay');
    const signupTab = document.getElementById('signup-tab');
    
    if (authOverlay && signupTab) {
      authOverlay.style.display = 'flex';
      signupTab.click();
    }
    
    document.body.removeChild(message);
  });
  
  document.getElementById('free-limit-close').addEventListener('click', () => {
    document.body.removeChild(message);
  });
} 
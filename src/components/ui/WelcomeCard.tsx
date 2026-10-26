import React from 'react';

interface WelcomeCardProps {
  onOpenSettings: () => void;
  onDismiss: () => void;
}

// Shown once to a new user: what Argus does with their data and the two
// things worth setting up
const WelcomeCard: React.FC<WelcomeCardProps> = ({ onOpenSettings, onDismiss }) => (
  <div className="welcome-card glass-card">
    <h2 className="welcome-title">Welcome to Argus</h2>
    <ul className="welcome-list">
      <li>Argus counts the time you actively spend on each website. It pauses when you're idle or the browser is in the background.</li>
      <li>Free and open source. No account, no server: everything Argus records stays in this browser.</li>
      <li>Set a daily goal and choose sites to block in Settings.</li>
    </ul>
    <div className="welcome-actions">
      <button className="secondary-btn" onClick={onDismiss}>Got it</button>
      <button className="primary-btn" onClick={onOpenSettings}>Open Settings</button>
    </div>
  </div>
);

export default WelcomeCard;

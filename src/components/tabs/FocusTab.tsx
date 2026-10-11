import React, { useEffect, useState } from 'react';
import { StorageData } from '../../types/storage';
import { formatTime } from '../../utils/timeUtils';
import { Shield, Play, Square, Clock } from 'lucide-react';

interface FocusTabProps {
  data: StorageData;
  onOpenSettings?: () => void;
}

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

/**
 * Focus sessions run in the background worker: for the chosen time every site
 * on the block list is blocked, whether or not the popup is open. This screen
 * only starts and stops a session and shows the one stored by the worker.
 */
const FocusTab: React.FC<FocusTabProps> = ({ data, onOpenSettings }) => {
  const { focusSession, focusStats, blockedSites = [] } = data;
  const [duration, setDuration] = useState(25); // minutes
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isActive = !!focusSession && focusSession.endsAt > now;

  // Tick once a second while a session is running
  useEffect(() => {
    if (!focusSession) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [focusSession]);

  const send = async (message: { action: string; minutes?: number }): Promise<void> => {
    setIsBusy(true);
    setError('');
    try {
      const response = await browserAPI.runtime.sendMessage(message);
      if (!response || !response.success) {
        setError((response && response.error) || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const remainingSeconds = isActive ? Math.ceil((focusSession!.endsAt - now) / 1000) : duration * 60;
  const totalSeconds = isActive ? focusSession!.minutes * 60 : duration * 60;
  const progress = isActive ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;

  const today = new Date().toDateString();
  const stats = focusStats && focusStats.date === today
    ? focusStats
    : { started: 0, completed: 0, focusTime: 0, blocked: 0 };
  // Time in the running session counts as it happens
  const focusTime = stats.focusTime + (isActive ? now - focusSession!.startedAt : 0);
  const finished = stats.started - (isActive ? 1 : 0);

  return (
    <section className="tab-content">
      <div className="focus-container">
        <div className="zen-mode-section">
          <div className="zen-mode-header">
            <Shield className="zen-mode-icon" />
            <h2 className="zen-mode-title">Focus</h2>
          </div>
          <p className="zen-mode-description">
            {blockedSites.length > 0
              ? `During a session Argus blocks the ${blockedSites.length} site${blockedSites.length === 1 ? '' : 's'} on your block list, and temporary unblocks are switched off.`
              : 'During a session Argus blocks every site on your block list. Your block list is empty, so nothing would be blocked.'}
          </p>
          {blockedSites.length === 0 && onOpenSettings && (
            <button className="link-btn" onClick={onOpenSettings}>
              Add sites to block in Settings
            </button>
          )}
        </div>

        <div className="focus-timer-section">
          <div className="timer-header">
            <Clock className="timer-icon" />
            <h3 className="timer-title">{isActive ? 'Session in progress' : 'Start a session'}</h3>
          </div>

          <div className="timer-display">
            <div className="timer-time">
              {pad(Math.floor(remainingSeconds / 60))}:{pad(remainingSeconds % 60)}
            </div>
            <div className="timer-progress">
              <div className="timer-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="timer-status">
              {isActive
                ? `Blocking until ${new Date(focusSession!.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. You can close this popup.`
                : 'Ready to start'}
            </div>
          </div>

          <div className="timer-controls">
            {isActive ? (
              <button
                className="timer-btn secondary"
                onClick={() => send({ action: 'stopFocusSession' })}
                disabled={isBusy}
              >
                <Square className="btn-icon" />
                End session early
              </button>
            ) : (
              <button
                className="timer-btn primary"
                onClick={() => send({ action: 'startFocusSession', minutes: duration })}
                disabled={isBusy}
              >
                <Play className="btn-icon" />
                Start {duration}-minute session
              </button>
            )}
          </div>

          {error && <p className="plan-error">{error}</p>}

          {!isActive && (
            <div className="timer-duration">
              <label className="duration-label" htmlFor="focus-duration">Session length (minutes)</label>
              <div className="duration-controls">
                <input
                  id="focus-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.min(180, Math.max(1, parseInt(e.target.value) || 25)))}
                  className="duration-input"
                  min="1"
                  max="180"
                />
                {[25, 50].map((preset) => (
                  <button
                    key={preset}
                    className={`duration-preset ${duration === preset ? 'active' : ''}`}
                    onClick={() => setDuration(preset)}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's numbers, all recorded by the background worker */}
        <div className="focus-stats-grid">
          <div className="focus-stat-card">
            <div className="focus-stat-value">{stats.started}</div>
            <div className="focus-stat-label">Sessions today</div>
          </div>
          <div className="focus-stat-card">
            <div className="focus-stat-value">{focusTime > 0 ? formatTime(focusTime) : '0m'}</div>
            <div className="focus-stat-label">Focus time today</div>
          </div>
          <div className="focus-stat-card">
            <div className="focus-stat-value">{stats.blocked}</div>
            <div className="focus-stat-label">Blocked visits</div>
          </div>
          <div className="focus-stat-card">
            <div className="focus-stat-value">{finished > 0 ? `${Math.round((stats.completed / finished) * 100)}%` : '—'}</div>
            <div className="focus-stat-label">Finished without ending early</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FocusTab;

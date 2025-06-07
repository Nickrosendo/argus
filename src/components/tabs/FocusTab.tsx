import React, { useState, useEffect, useMemo } from 'react';
import { StorageData } from '../../types/storage';
import { Shield, Clock, AlertTriangle, Play, Pause, RotateCcw, Plus, X } from 'lucide-react';

interface FocusTabProps {
  data: StorageData;
  updateStorage: (updates: Partial<StorageData>) => void;
}

interface TimerState {
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isComplete: boolean;
}

const FocusTab: React.FC<FocusTabProps> = ({ data, updateStorage }) => {
  const { blockedSites = [], settings } = data;
  
  // Timer state
  const [timer, setTimer] = useState<TimerState>({
    minutes: 25,
    seconds: 0,
    isRunning: false,
    isComplete: false
  });
  
  const [timerDuration, setTimerDuration] = useState(25); // in minutes
  const [newSite, setNewSite] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Focus session statistics (simplified for demo)
  const focusStats = useMemo(() => {
    const today = new Date().toDateString();
    // In a real implementation, these would come from stored session data
    return {
      sessionsToday: 12,
      focusTime: '5h 30m',
      sitesBlocked: blockedSites.length,
      successRate: 89
    };
  }, [blockedSites]);

  // Timer effect
  useEffect(() => {
    let interval: number | null = null;
    
    if (timer.isRunning && !timer.isComplete) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev.seconds > 0) {
            return { ...prev, seconds: prev.seconds - 1 };
          } else if (prev.minutes > 0) {
            return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
          } else {
            // Timer complete
            setIsBlocking(false);
            return { ...prev, isRunning: false, isComplete: true };
          }
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer.isRunning, timer.isComplete]);

  const startTimer = () => {
    setTimer(prev => ({ ...prev, isRunning: true, isComplete: false }));
    setIsBlocking(true);
  };

  const pauseTimer = () => {
    setTimer(prev => ({ ...prev, isRunning: false }));
    setIsBlocking(false);
  };

  const resetTimer = () => {
    setTimer({
      minutes: timerDuration,
      seconds: 0,
      isRunning: false,
      isComplete: false
    });
    setIsBlocking(false);
  };

  const setDuration = (minutes: number) => {
    setTimerDuration(minutes);
    if (!timer.isRunning) {
      setTimer({
        minutes,
        seconds: 0,
        isRunning: false,
        isComplete: false
      });
    }
  };

  const addBlockedSite = () => {
    if (newSite.trim() && blockedSites.indexOf(newSite.trim()) === -1) {
      const updatedSites = [...blockedSites, newSite.trim()];
      updateStorage({ blockedSites: updatedSites });
      setNewSite('');
    }
  };

  const removeBlockedSite = (site: string) => {
    const updatedSites = blockedSites.filter(s => s !== site);
    updateStorage({ blockedSites: updatedSites });
  };

  const formatTime = (minutes: number, seconds: number): string => {
    const padZero = (num: number): string => num < 10 ? '0' + num : num.toString();
    return `${padZero(minutes)}:${padZero(seconds)}`;
  };

  const getTimerStatus = (): string => {
    if (timer.isComplete) return 'Session complete!';
    if (timer.isRunning) return 'Focus session active';
    return 'Ready to start';
  };

  return (
    <section className="tab-content">
      <div className="focus-container">
        {/* Zen Mode Section */}
        <div className="zen-mode-section">
          <div className="zen-mode-header">
            <Shield className="zen-mode-icon" />
            <h2 className="zen-mode-title">Zen Mode</h2>
          </div>
          <p className="zen-mode-description">
            Block distracting websites and focus with the Pomodoro technique
          </p>
        </div>

        {/* Focus Timer Section */}
        <div className="focus-timer-section">
          <div className="timer-header">
            <Clock className="timer-icon" />
            <h3 className="timer-title">Focus Timer</h3>
          </div>
          <p className="timer-subtitle">Pomodoro technique timer</p>
          
          <div className="timer-display">
            <div className="timer-time">{formatTime(timer.minutes, timer.seconds)}</div>
            <div className="timer-progress">
              <div 
                className="timer-progress-bar"
                style={{ 
                  width: `${((timerDuration * 60 - (timer.minutes * 60 + timer.seconds)) / (timerDuration * 60)) * 100}%` 
                }}
              />
            </div>
            <div className="timer-status">{getTimerStatus()}</div>
          </div>

          <div className="timer-controls">
            <button 
              className={`timer-btn primary ${timer.isRunning ? 'hidden' : ''}`}
              onClick={startTimer}
              disabled={timer.isComplete}
            >
              <Play className="btn-icon" />
              Start
            </button>
            
            <button 
              className={`timer-btn secondary ${!timer.isRunning ? 'hidden' : ''}`}
              onClick={pauseTimer}
            >
              <Pause className="btn-icon" />
              Pause
            </button>
            
            <button 
              className="timer-btn tertiary"
              onClick={resetTimer}
            >
              <RotateCcw className="btn-icon" />
              Reset
            </button>
          </div>

          <div className="timer-duration">
            <label className="duration-label">Timer Duration (minutes)</label>
            <div className="duration-controls">
              <input
                type="number"
                value={timerDuration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 25)}
                className="duration-input"
                min="1"
                max="120"
              />
              <button 
                className={`duration-preset ${timerDuration === 25 ? 'active' : ''}`}
                onClick={() => setDuration(25)}
              >
                25m
              </button>
              <button 
                className={`duration-preset ${timerDuration === 50 ? 'active' : ''}`}
                onClick={() => setDuration(50)}
              >
                50m
              </button>
            </div>
          </div>
        </div>

        {/* Blocked Sites Section */}
        <div className="blocked-sites-section">
          <div className="blocked-sites-header">
            <AlertTriangle className="blocked-sites-icon" />
            <h3 className="blocked-sites-title">Blocked Sites</h3>
          </div>
          <p className="blocked-sites-subtitle">Websites to block during focus sessions</p>
          
          <div className="add-site-form">
            <input
              type="text"
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              placeholder="Enter website (e.g., facebook.com)"
              className="add-site-input"
              onKeyPress={(e) => e.key === 'Enter' && addBlockedSite()}
            />
            <button 
              className="add-site-btn"
              onClick={addBlockedSite}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="blocked-sites-list">
            {blockedSites.length === 0 ? (
              <div className="no-blocked-sites">
                No websites blocked yet
              </div>
            ) : (
              blockedSites.map((site, index) => (
                <div key={index} className="blocked-site-item">
                  <div className="blocked-site-info">
                    <div className="blocked-site-dot" />
                    <span className="blocked-site-name">{site}</span>
                  </div>
                  <button
                    className="remove-site-btn"
                    onClick={() => removeBlockedSite(site)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="blocking-status">
            <span className="blocking-status-label">Blocking Status</span>
            <span className={`blocking-status-badge ${isBlocking ? 'active' : 'inactive'}`}>
              {isBlocking ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Focus Statistics */}
        <div className="focus-stats-grid">
          <div className="focus-stat-card">
            <div className="focus-stat-value">{focusStats.sessionsToday}</div>
            <div className="focus-stat-label">Sessions today</div>
          </div>
          
          <div className="focus-stat-card">
            <div className="focus-stat-value">{focusStats.focusTime}</div>
            <div className="focus-stat-label">Focus time today</div>
          </div>
          
          <div className="focus-stat-card">
            <div className="focus-stat-value">{focusStats.sitesBlocked}</div>
            <div className="focus-stat-label">Sites blocked</div>
          </div>
          
          <div className="focus-stat-card">
            <div className="focus-stat-value">{focusStats.successRate}%</div>
            <div className="focus-stat-label">Success rate</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FocusTab; 
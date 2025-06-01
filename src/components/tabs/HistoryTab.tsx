import React, { useState, useMemo } from 'react';
import { formatTime } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';

interface HistoryTabProps {
  data: StorageData;
}

interface SiteIconProps {
  domain: string;
  favicon?: string;
}

interface SelectedDateData {
  sites?: { [domain: string]: SiteInfo };
  totalTime: number;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ data }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { history = {} } = data;

  // Get data for selected date
  const selectedDateData: SelectedDateData = useMemo(() => {
    const dateString = selectedDate.toDateString();
    return history[dateString] || { sites: {}, totalTime: 0 };
  }, [selectedDate, history]);

  // Sort sites for selected date
  const sortedSites = useMemo(() => {
    return Object.entries(selectedDateData.sites || {})
      .sort(([, a], [, b]) => b.totalTime - a.totalTime);
  }, [selectedDateData.sites]);

  const navigateDate = (direction: number): void => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const formatSelectedDate = (): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (selectedDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const canNavigateNext = (): boolean => {
    const today = new Date();
    return selectedDate.toDateString() !== today.toDateString();
  };

  const SiteIcon: React.FC<SiteIconProps> = ({ domain, favicon }) => {
    if (favicon) {
      return <img src={favicon} alt={`${domain} icon`} />;
    }
    return <span>{domain.charAt(0).toUpperCase()}</span>;
  };

  return (
    <section className="tab-content">
      <div className="date-selector">
        <button 
          className="nav-arrow" 
          onClick={() => navigateDate(-1)}
        >
          &#8249;
        </button>
        <span className="selected-date">{formatSelectedDate()}</span>
        <button 
          className="nav-arrow" 
          onClick={() => navigateDate(1)}
          disabled={!canNavigateNext()}
          style={{ opacity: canNavigateNext() ? 1 : 0.5 }}
        >
          &#8250;
        </button>
      </div>

      <div className="history-data">
        {selectedDateData.totalTime === 0 ? (
          <div className="no-data">
            No data available for {formatSelectedDate().toLowerCase()}
          </div>
        ) : (
          <>
            <div className="day-summary">
              <h3>Total Screen Time</h3>
              <div className="total-time">{formatTime(selectedDateData.totalTime)}</div>
            </div>

            <div className="sites-container">
              <h3>Sites Visited</h3>
              <div className="sites-list">
                {sortedSites.map(([domain, siteData]) => (
                  <div key={domain} className="site-item">
                    <div className="site-icon">
                      <SiteIcon domain={domain} favicon={siteData.favicon} />
                    </div>
                    <div className="site-info">
                      <div className="site-domain">{domain}</div>
                      <div className="site-time">{formatTime(siteData.totalTime)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default HistoryTab; 
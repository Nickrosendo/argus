import React, { useMemo } from 'react';
import { formatTime, getLastNDays } from '../../utils/timeUtils';

const TodayTab = ({ data, updateStorage }) => {
  const { sites = {}, totalTime = 0, history = {}, settings = {} } = data;

  // Calculate weekly average
  const weeklyAverage = useMemo(() => {
    const last7Days = getLastNDays(7);
    let totalWeekTime = totalTime; // Include today's time
    let daysWithData = totalTime > 0 ? 1 : 0;
    
    // Sum up time from previous 6 days
    last7Days.slice(0, 6).forEach(date => {
      const dateString = date.toDateString();
      const dayData = history[dateString];
      
      if (dayData && dayData.totalTime > 0) {
        totalWeekTime += dayData.totalTime;
        daysWithData++;
      }
    });
    
    return daysWithData > 0 ? totalWeekTime / daysWithData : 0;
  }, [totalTime, history]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    const dailyLimit = settings.dailyLimit || 8; // Default 8 hours
    const limitInMs = dailyLimit * 60 * 60 * 1000;
    return Math.min((totalTime / limitInMs) * 100, 100);
  }, [totalTime, settings.dailyLimit]);

  // Sort sites by time spent
  const sortedSites = useMemo(() => {
    return Object.entries(sites)
      .sort(([, a], [, b]) => b.totalTime - a.totalTime);
  }, [sites]);

  const SiteIcon = ({ domain, favicon }) => {
    if (favicon) {
      return <img src={favicon} alt={`${domain} icon`} />;
    }
    return <span>{domain.charAt(0).toUpperCase()}</span>;
  };

  return (
    <section className="tab-content active">
      <div className="summary-card">
        <h2>Today's Screen Time</h2>
        <div className="total-time">{formatTime(totalTime)}</div>
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        {weeklyAverage > 0 && (
          <div className="weekly-average">
            Weekly average: {formatTime(weeklyAverage)}
          </div>
        )}
      </div>

      <div className="sites-container">
        <h3>Most Visited Sites</h3>
        <div className="sites-list">
          {sortedSites.length === 0 ? (
            <div className="no-data">No data available yet</div>
          ) : (
            sortedSites.map(([domain, siteData]) => (
              <div key={domain} className="site-item">
                <div className="site-icon">
                  <SiteIcon domain={domain} favicon={siteData.favicon} />
                </div>
                <div className="site-info">
                  <div className="site-domain">{domain}</div>
                  <div className="site-time">{formatTime(siteData.totalTime)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default TodayTab; 
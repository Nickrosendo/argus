import React, { useMemo } from 'react';
import { formatTime } from '../../utils/timeUtils';
import { getPastDays, getPeakHour, getSessionStats, getTopSite } from '../../utils/metrics';
import { getCategoryBreakdown } from '../../utils/categories';
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '../../lib/plans';
import { StorageData } from '../../types/storage';
import { Clock, MousePointer, Sunrise, Star } from 'lucide-react';

interface HistoryTabProps {
  data: StorageData;
  isFreeMode?: boolean;
  onUpgrade?: () => void;
}

interface AnalyticsCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ title, value, subtitle, icon, iconColor }) => (
  <div className="analytics-card">
    <div className="analytics-card-header">
      <div className="analytics-card-info">
        <h3 className="analytics-card-title">{title}</h3>
        <div className="analytics-card-value">{value}</div>
        <p className="analytics-card-subtitle">{subtitle}</p>
      </div>
      <div className={`analytics-card-icon ${iconColor}`}>
        {icon}
      </div>
    </div>
  </div>
);

const HistoryTab: React.FC<HistoryTabProps> = ({ data, isFreeMode = false, onUpgrade }) => {
  const { sites = {}, totalTime = 0, hourly, history = {} } = data;

  // Every figure here comes from recorded data: time and visits per site,
  // time per hour, and the stored past days
  const sessions = useMemo(() => getSessionStats(sites, totalTime), [sites, totalTime]);
  const peakHour = useMemo(() => getPeakHour(hourly), [hourly]);
  const topSite = useMemo(() => getTopSite(sites), [sites]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(sites), [sites]);
  const historyDays = isFreeMode ? FREE_HISTORY_DAYS : PREMIUM_HISTORY_DAYS;
  const pastDays = useMemo(() => getPastDays(history, historyDays), [history, historyDays]);
  const longestDay = pastDays.reduce((max, day) => Math.max(max, day.totalTime), 0);

  return (
    <section className="tab-content">
      <div className="analytics-container">
        {/* Past days */}
        <div className="productivity-section">
          <h3 className="section-title">Past Days</h3>
          <p className="section-subtitle">Total browsing time on each day, for the last {historyDays} days</p>

          {pastDays.length === 0 ? (
            <div className="no-sites-data">
              <p>Finished days appear here, starting tomorrow.</p>
            </div>
          ) : (
            <div className="productivity-hours">
              {pastDays.map((day) => (
                <div key={day.date} className="productivity-slot" title={day.topSite ? `Most time on ${day.topSite}` : undefined}>
                  <div className="productivity-time-info">
                    <span className="productivity-time">{day.label}</span>
                    <span className="productivity-percentage">
                      {formatTime(day.totalTime)} · {day.sitesCount} site{day.sitesCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="productivity-bar">
                    <div
                      className="productivity-fill active"
                      style={{ width: `${longestDay > 0 ? Math.round((day.totalTime / longestDay) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isFreeMode && onUpgrade && (
            <button className="history-edge" onClick={onUpgrade}>
              Free keeps {FREE_HISTORY_DAYS} days. Keep {PREMIUM_HISTORY_DAYS} days with Premium
            </button>
          )}
        </div>

        {/* Today at a glance */}
        <div className="analytics-grid">
          <AnalyticsCard
            title="Visits"
            value={sessions.sessions.toLocaleString()}
            subtitle="Times you opened a site today"
            icon={<MousePointer className="w-6 h-6" />}
            iconColor="text-orange-400"
          />

          <AnalyticsCard
            title="Time per Visit"
            value={sessions.sessions > 0 ? formatTime(sessions.averageLength) : '—'}
            subtitle="Average length of a visit"
            icon={<Clock className="w-6 h-6" />}
            iconColor="text-red-400"
          />

          <AnalyticsCard
            title="Busiest Hour"
            value={peakHour ? peakHour.label : '—'}
            subtitle={peakHour ? `${formatTime(peakHour.time)} of browsing` : 'Appears as you browse'}
            icon={<Sunrise className="w-6 h-6" />}
            iconColor="text-blue-400"
          />

          <AnalyticsCard
            title="Top Site"
            value={topSite ? topSite.domain : '—'}
            subtitle={topSite ? `${formatTime(topSite.time)} today` : 'Appears as you browse'}
            icon={<Star className="w-6 h-6" />}
            iconColor="text-yellow-400"
          />
        </div>

        {/* Category Breakdown */}
        <div className="category-section">
          <h3 className="section-title">Category Breakdown</h3>
          <p className="section-subtitle">Today's time by type of site</p>
          
          {categoryBreakdown.length === 0 ? (
            <div className="no-sites-data">
              <p>No browsing data available for today</p>
            </div>
          ) : (
            <div className="category-breakdown">
              {categoryBreakdown.map((category) => (
                <div key={category.name} className="category-item">
                  <div className="category-info">
                    <div className="category-name">
                      <div 
                        className="category-dot" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </div>
                    <div className="category-stats">
                      <span className="category-time">{formatTime(category.time)}</span>
                      <span className="category-percentage">{category.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HistoryTab;

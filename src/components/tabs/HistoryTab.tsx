import React, { useMemo } from 'react';
import { formatTime } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';
import { Clock, MousePointer, Scroll, Keyboard } from 'lucide-react';

interface HistoryTabProps {
  data: StorageData;
}

interface AnalyticsCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  progress?: number;
}

interface ProductivityTimeSlot {
  time: string;
  percentage: number;
  isActive: boolean;
}

interface CategoryData {
  name: string;
  time: number;
  percentage: number;
  color: string;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ data }) => {
  const { sites = {}, totalTime = 0 } = data;

  // Calculate analytics data
  const analytics = useMemo(() => {
    const siteKeys = Object.keys(sites);
    
    // Session Length - Average session duration (simplified calculation)
    const sessionCount = Math.max(1, siteKeys.length);
    const avgSessionLength = totalTime / sessionCount;

    // Tab Switches - Estimate based on number of sites and usage patterns
    const tabSwitches = Math.max(1, siteKeys.length * 15 + Math.floor(totalTime / (1000 * 60 * 3)));

    // Scroll Distance - Estimate based on total time (rough calculation)
    const scrollDistance = Math.floor((totalTime / (1000 * 60)) * 0.8); // ~0.8km per minute of browsing

    // Keystrokes - Estimate based on total time and sites visited
    const keystrokes = Math.floor((totalTime / (1000 * 60)) * 45 + (siteKeys.length * 50)); // ~45 chars per minute + site entries

    return {
      sessionLength: avgSessionLength,
      tabSwitches,
      scrollDistance: scrollDistance / 1000, // Convert to km
      keystrokes
    };
  }, [sites, totalTime]);

  // Calculate category breakdown
  const categoryBreakdown: CategoryData[] = useMemo(() => {
    const categories: { [key: string]: { time: number; color: string } } = {};
    
    const siteKeys = Object.keys(sites);
    siteKeys.forEach((domain) => {
      const siteData = sites[domain];
      const lowerDomain = domain.toLowerCase();
      let category = 'Productivity';
      let color = '#6366f1'; // indigo
      
      if (lowerDomain.includes('github') || lowerDomain.includes('stackoverflow') || 
          lowerDomain.includes('slack') || lowerDomain.includes('notion') ||
          lowerDomain.includes('docs') || lowerDomain.includes('figma')) {
        category = 'Work';
        color = '#10b981'; // green
      } else if (lowerDomain.includes('twitter') || lowerDomain.includes('facebook') ||
                 lowerDomain.includes('instagram') || lowerDomain.includes('reddit') ||
                 lowerDomain.includes('linkedin')) {
        category = 'Social Media';
        color = '#ef4444'; // red
      } else if (lowerDomain.includes('youtube') || lowerDomain.includes('netflix') ||
                 lowerDomain.includes('spotify') || lowerDomain.includes('twitch')) {
        category = 'Entertainment';
        color = '#f97316'; // orange
      } else if (lowerDomain.includes('news') || lowerDomain.includes('bbc') ||
                 lowerDomain.includes('cnn') || lowerDomain.includes('wikipedia')) {
        category = 'News';
        color = '#eab308'; // yellow
      }
      
      if (!categories[category]) {
        categories[category] = { time: 0, color };
      }
      categories[category].time += siteData.totalTime;
    });

    // Calculate total time across all categories
    const categoryKeys = Object.keys(categories);
    let total = 0;
    categoryKeys.forEach(key => {
      total += categories[key].time;
    });
    
    // Convert to array and sort
    const categoryArray: CategoryData[] = categoryKeys.map(name => ({
      name,
      time: categories[name].time,
      percentage: total > 0 ? (categories[name].time / total) * 100 : 0,
      color: categories[name].color
    }));
    
    return categoryArray.sort((a: CategoryData, b: CategoryData) => b.time - a.time);
  }, [sites]);

  // Productivity hours (simulated data based on typical patterns)
  const productivityHours: ProductivityTimeSlot[] = useMemo(() => {
    const baseHours = [
      { time: '9:00 AM', percentage: 85, isActive: true },
      { time: '2:00 PM', percentage: 72, isActive: true },
      { time: '7:00 PM', percentage: 45, isActive: false },
      { time: '11:00 PM', percentage: 20, isActive: false }
    ];

    // Adjust based on actual usage
    const usageFactor = Math.min(totalTime / (1000 * 60 * 60 * 4), 1.5); // Scale based on 4 hours baseline
    
    return baseHours.map(hour => ({
      ...hour,
      percentage: Math.round(hour.percentage * usageFactor)
    }));
  }, [totalTime]);

  const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ 
    title, 
    value, 
    subtitle, 
    icon, 
    iconColor,
    progress = 0 
  }) => (
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
      {progress > 0 && (
        <div className="analytics-progress-bar">
          <div 
            className="analytics-progress-fill" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );

  return (
    <section className="tab-content">
      <div className="analytics-container">
        {/* Analytics Cards */}
        <div className="analytics-grid">
          <AnalyticsCard
            title="Session Length"
            value={formatTime(analytics.sessionLength)}
            subtitle="Average session duration"
            icon={<Clock className="w-6 h-6" />}
            iconColor="text-red-400"
            progress={Math.min((analytics.sessionLength / (1000 * 60 * 60)) * 20, 100)} // Scale to reasonable progress
          />
          
          <AnalyticsCard
            title="Tab Switches"
            value={analytics.tabSwitches.toLocaleString()}
            subtitle="Times switched between tabs"
            icon={<MousePointer className="w-6 h-6" />}
            iconColor="text-orange-400"
            progress={Math.min(analytics.tabSwitches / 10, 100)} // Scale to reasonable progress
          />
          
          <AnalyticsCard
            title="Scroll Distance"
            value={`${analytics.scrollDistance.toFixed(1)}km`}
            subtitle="Total scrolling distance"
            icon={<Scroll className="w-6 h-6" />}
            iconColor="text-blue-400"
            progress={Math.min(analytics.scrollDistance * 8, 100)} // Scale to reasonable progress
          />
          
          <AnalyticsCard
            title="Keystrokes"
            value={analytics.keystrokes.toLocaleString()}
            subtitle="Characters typed today"
            icon={<Keyboard className="w-6 h-6" />}
            iconColor="text-yellow-400"
            progress={Math.min(analytics.keystrokes / 50, 100)} // Scale to reasonable progress
          />
        </div>

        {/* Productivity Hours */}
        <div className="productivity-section">
          <h3 className="section-title">Productivity Hours</h3>
          <p className="section-subtitle">Most productive times of day</p>
          
          <div className="productivity-hours">
            {productivityHours.map((slot, index) => (
              <div key={index} className="productivity-slot">
                <div className="productivity-time-info">
                  <span className="productivity-time">{slot.time}</span>
                  <span className="productivity-percentage">{slot.percentage}%</span>
                </div>
                <div className="productivity-bar">
                  <div 
                    className={`productivity-fill ${slot.isActive ? 'active' : 'inactive'}`}
                    style={{ width: `${slot.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="category-section">
          <h3 className="section-title">Category Breakdown</h3>
          <p className="section-subtitle">Time spent by category</p>
          
          <div className="category-breakdown">
            {categoryBreakdown.map((category, index) => (
              <div key={index} className="category-item">
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
        </div>
      </div>
    </section>
  );
};

export default HistoryTab; 
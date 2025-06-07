import React, { useMemo } from 'react';
import { formatTime } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';
import { ExternalLink } from 'lucide-react';

interface SitesTabProps {
  data: StorageData;
}

interface SiteIconProps {
  domain: string;
  favicon?: string;
}

interface EnhancedSiteData extends SiteInfo {
  domain: string;
  visits: number;
  category: string;
  categoryColor: string;
  changePercent: string;
  changeColor: string;
}

const SitesTab: React.FC<SitesTabProps> = ({ data }) => {
  const { sites = {}, history = {} } = data;

  // Get yesterday's data for comparison
  const yesterdayData = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();
    return history[yesterdayString] || { sites: {}, totalTime: 0 };
  }, [history]);

  // Site categorization function
  const categorizeWebsite = (domain: string): { category: string; color: string } => {
    const lowerDomain = domain.toLowerCase();
    
    // Work/Development sites
    if (lowerDomain.includes('github') || lowerDomain.includes('stackoverflow') || 
        lowerDomain.includes('gitlab') || lowerDomain.includes('notion') ||
        lowerDomain.includes('slack') || lowerDomain.includes('discord') ||
        lowerDomain.includes('zoom') || lowerDomain.includes('teams') ||
        lowerDomain.includes('atlassian') || lowerDomain.includes('jira') ||
        lowerDomain.includes('trello') || lowerDomain.includes('figma') ||
        lowerDomain.includes('docs.google') || lowerDomain.includes('drive.google')) {
      return { category: 'Work', color: 'bg-purple-500' };
    }
    
    // Social Media
    if (lowerDomain.includes('twitter') || lowerDomain.includes('facebook') ||
        lowerDomain.includes('instagram') || lowerDomain.includes('linkedin') ||
        lowerDomain.includes('reddit') || lowerDomain.includes('tiktok') ||
        lowerDomain.includes('snapchat') || lowerDomain.includes('whatsapp')) {
      return { category: 'Social', color: 'bg-pink-500' };
    }
    
    // Entertainment
    if (lowerDomain.includes('youtube') || lowerDomain.includes('netflix') ||
        lowerDomain.includes('twitch') || lowerDomain.includes('spotify') ||
        lowerDomain.includes('amazon') || lowerDomain.includes('hulu') ||
        lowerDomain.includes('disney') || lowerDomain.includes('prime')) {
      return { category: 'Entertainment', color: 'bg-orange-500' };
    }
    
    // News/Information
    if (lowerDomain.includes('news') || lowerDomain.includes('cnn') ||
        lowerDomain.includes('bbc') || lowerDomain.includes('wikipedia') ||
        lowerDomain.includes('medium') || lowerDomain.includes('blog')) {
      return { category: 'News', color: 'bg-blue-500' };
    }
    
    // Shopping
    if (lowerDomain.includes('shop') || lowerDomain.includes('store') ||
        lowerDomain.includes('buy') || lowerDomain.includes('ebay') ||
        lowerDomain.includes('etsy') || lowerDomain.includes('cart')) {
      return { category: 'Shopping', color: 'bg-green-500' };
    }
    
    // Default to productivity
    return { category: 'Productivity', color: 'bg-indigo-500' };
  };

  // Calculate visit count estimation (simplified)
  const estimateVisits = (timeSpent: number): number => {
    // Rough estimation: average 2-5 minutes per visit
    const avgVisitTime = 3 * 60 * 1000; // 3 minutes in ms
    return Math.max(1, Math.round(timeSpent / avgVisitTime));
  };

  // Calculate percentage change from yesterday
  const calculateChange = (todayTime: number, domain: string): { percent: string; color: string } => {
    const yesterdaySites = yesterdayData.sites || {};
    const yesterdayTime = (yesterdaySites as { [key: string]: SiteInfo })[domain]?.totalTime || 0;
    
    if (yesterdayTime === 0) {
      return { percent: 'New', color: 'text-blue-400' };
    }
    
    const change = ((todayTime - yesterdayTime) / yesterdayTime) * 100;
    const isPositive = change > 0;
    
    return {
      percent: `${isPositive ? '+' : ''}${change.toFixed(0)}%`,
      color: isPositive ? 'text-red-400' : 'text-green-400'
    };
  };

  // Process and sort sites data
  const enhancedSites: EnhancedSiteData[] = useMemo(() => {
    const siteKeys = Object.keys(sites);
    
    const processed = siteKeys.map(domain => {
      const siteData = sites[domain];
      const { category, color } = categorizeWebsite(domain);
      const visits = estimateVisits(siteData.totalTime);
      const change = calculateChange(siteData.totalTime, domain);
      
      return {
        ...siteData,
        domain,
        visits,
        category,
        categoryColor: color,
        changePercent: change.percent,
        changeColor: change.color
      };
    });
    
    // Sort by total time descending
    return processed.sort((a, b) => b.totalTime - a.totalTime);
  }, [sites, yesterdayData]);

  const SiteIcon: React.FC<SiteIconProps> = ({ domain, favicon }) => {
    if (favicon) {
      return <img src={favicon} alt={`${domain} icon`} className="w-8 h-8 rounded" />;
    }
    
    // Generate a color based on domain for consistency
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const colorIndex = domain.length % colors.length;
    
    return (
      <div className={`w-8 h-8 rounded ${colors[colorIndex]} flex items-center justify-center text-white text-sm font-bold`}>
        {domain.charAt(0).toUpperCase()}
      </div>
    );
  };

  const openSite = (domain: string) => {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    window.open(url, '_blank');
  };

  return (
    <section className="tab-content">
      <div className="sites-table-container">
        <div className="sites-table-header">
          <h2 className="sites-table-title">Top Visited Sites</h2>
          <p className="sites-table-subtitle">Your most visited websites today</p>
        </div>
        
        {enhancedSites.length === 0 ? (
          <div className="no-sites-data">
            <p>No browsing data available for today</p>
          </div>
        ) : (
          <div className="sites-table">
            {enhancedSites.map((site) => (
              <div key={site.domain} className="site-row">
                <div className="site-main-info">
                  <div className="site-icon-wrapper">
                    <SiteIcon domain={site.domain} favicon={site.favicon} />
                  </div>
                  
                  <div className="site-details">
                    <div className="site-name-row">
                      <span className="site-name">{site.domain}</span>
                      <button 
                        className="external-link-btn"
                        onClick={() => openSite(site.domain)}
                        title={`Open ${site.domain}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="site-meta">
                      <span className={`category-badge ${site.categoryColor}`}>
                        {site.category}
                      </span>
                      <span className="visit-count">{site.visits} visits</span>
                    </div>
                  </div>
                </div>
                
                <div className="site-stats">
                  <div className="time-spent">
                    {formatTime(site.totalTime)}
                  </div>
                  <div className={`change-percent ${site.changeColor}`}>
                    {site.changePercent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SitesTab; 
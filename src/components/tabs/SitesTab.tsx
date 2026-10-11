import React, { useMemo } from 'react';
import { formatTime } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';
import { ExternalLink } from 'lucide-react';
import { categorize } from '../../utils/categories';

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

  // Process and sort sites data
  const enhancedSites: EnhancedSiteData[] = useMemo(() => {
    const yesterdaySites = (yesterdayData.sites || {}) as { [key: string]: SiteInfo };

    const processed = Object.keys(sites).map(domain => {
      const siteData = sites[domain];
      const category = categorize(domain);
      const yesterdayTime = yesterdaySites[domain]?.totalTime || 0;

      return {
        ...siteData,
        domain,
        // Recorded by the tracker: one visit per continuous stay on the site
        visits: siteData.visits || 1,
        category: category.name,
        categoryColor: category.badgeClass,
        // Yesterday's full-day time, stated plainly: a percentage against a
        // finished day would be misleading while today is still in progress
        changePercent: yesterdayTime > 0 ? `yest. ${formatTime(yesterdayTime)}` : 'New today',
        changeColor: yesterdayTime > 0 ? 'text-gray-400' : 'text-blue-400'
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
          <p className="sites-table-subtitle">Where your time went today</p>
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
                      <span className="visit-count">{site.visits} visit{site.visits === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="site-stats">
                  <div className="time-spent">
                    {formatTime(site.totalTime)}
                  </div>
                  <div
                    className={`change-percent ${site.changeColor}`}
                    title={site.changePercent === 'New today' ? 'Not visited yesterday' : 'Time on this site during all of yesterday'}
                  >
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
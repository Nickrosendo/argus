import React, { useMemo } from "react";
import { formatTime, getLastNDays } from "../../utils/timeUtils";
import { StorageData, SiteInfo } from "../../types/storage";

interface TodayTabProps {
  data: StorageData;
  updateStorage: (updates: Partial<StorageData>) => void;
}

interface SiteIconProps {
  domain: string;
  favicon?: string;
}

const TodayTab: React.FC<TodayTabProps> = ({ data, updateStorage }) => {
  const { sites = {}, totalTime = 0, history = {}, settings } = data;

  // Sort sites by time spent
  const sortedSites = useMemo(() => {
    return Object.keys(sites).map((domain: string) => [domain, sites[domain]] as [string, SiteInfo]).sort(
      ([, a], [, b]) => b.totalTime - a.totalTime
    );
  }, [sites]);

  const SiteIcon: React.FC<SiteIconProps> = ({ domain, favicon }) => {
    if (favicon) {
      return <img src={favicon} alt={`${domain} icon`} />;
    }
    return <span>{domain.charAt(0).toUpperCase()}</span>;
  };

  return (
    <section className="tab-content active">
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
                  <div className="site-time">
                    {formatTime(siteData.totalTime)}
                  </div>
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

import React, { useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { formatTime, getLastNDays } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';

interface StatsTabProps {
  data: StorageData;
}

interface WeeklyData {
  labels: string[];
  data: number[];
}

interface CategoriesData {
  labels: string[];
  data: number[];
}

interface Stats {
  mostUsedSite: string;
  mostProductiveDay: string;
}

const StatsTab: React.FC<StatsTabProps> = ({ data }) => {
  const weeklyChartRef = useRef<HTMLCanvasElement>(null);
  const categoriesChartRef = useRef<HTMLCanvasElement>(null);
  const weeklyChartInstance = useRef<Chart | null>(null);
  const categoriesChartInstance = useRef<Chart | null>(null);

  const { sites = {}, history = {}, totalTime = 0 } = data;

  // Prepare weekly data
  const weeklyData: WeeklyData = useMemo(() => {
    const last7Days = getLastNDays(7);
    const labels: string[] = [];
    const data: number[] = [];

    last7Days.reverse().forEach(date => {
      const dateString = date.toDateString();
      const dayData = history[dateString];
      
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      data.push(dayData ? dayData.totalTime / (1000 * 60 * 60) : 0); // Convert to hours
    });

    return { labels, data };
  }, [history]);

  // Prepare categories data
  const categoriesData: CategoriesData = useMemo(() => {
    const categories: { [key: string]: string[] } = {
      'Social Media': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'tiktok.com'],
      'Entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
      'News': ['reddit.com', 'news.ycombinator.com', 'bbc.com', 'cnn.com'],
      'Work': ['github.com', 'stackoverflow.com', 'docs.google.com', 'slack.com'],
      'Other': []
    };

    const categoryTimes: { [key: string]: number } = {
      'Social Media': 0,
      'Entertainment': 0,
      'News': 0,
      'Work': 0,
      'Other': 0
    };

    Object.entries(sites).forEach(([domain, siteData]) => {
      let categorized = false;
      
      for (const [category, domains] of Object.entries(categories)) {
        if (category !== 'Other' && domains.some(d => domain.includes(d))) {
          categoryTimes[category] += siteData.totalTime;
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        categoryTimes['Other'] += siteData.totalTime;
      }
    });

    return {
      labels: Object.keys(categoryTimes),
      data: Object.values(categoryTimes).map(time => time / (1000 * 60 * 60)) // Convert to hours
    };
  }, [sites]);

  // Calculate stats
  const stats: Stats = useMemo(() => {
    const sortedSites = Object.entries(sites)
      .sort(([, a], [, b]) => b.totalTime - a.totalTime);
    
    const mostUsedSite = sortedSites.length > 0 ? sortedSites[0][0] : '-';
    
    // Find most productive day (least screen time)
    const dailyTimes = Object.entries(history).map(([date, data]) => ({
      date,
      time: data.totalTime || 0
    }));
    
    const mostProductiveDay = dailyTimes.length > 0 
      ? dailyTimes.sort((a, b) => a.time - b.time)[0]?.date || '-'
      : '-';

    return {
      mostUsedSite,
      mostProductiveDay: mostProductiveDay !== '-' 
        ? new Date(mostProductiveDay).toLocaleDateString('en-US', { weekday: 'long' })
        : '-'
    };
  }, [sites, history]);

  // Create weekly chart
  useEffect(() => {
    if (weeklyChartRef.current && weeklyData.labels.length > 0) {
      // Destroy existing chart
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
      }

      const ctx = weeklyChartRef.current.getContext('2d');
      if (ctx) {
        weeklyChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: weeklyData.labels,
            datasets: [{
              label: 'Hours',
              data: weeklyData.data,
              borderColor: '#4CAF50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Weekly Screen Time'
              },
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Hours'
                }
              }
            }
          }
        });
      }
    }

    return () => {
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
      }
    };
  }, [weeklyData]);

  // Create categories chart
  useEffect(() => {
    if (categoriesChartRef.current && categoriesData.data.some(d => d > 0)) {
      // Destroy existing chart
      if (categoriesChartInstance.current) {
        categoriesChartInstance.current.destroy();
      }

      const ctx = categoriesChartRef.current.getContext('2d');
      if (ctx) {
        categoriesChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: categoriesData.labels,
            datasets: [{
              data: categoriesData.data,
              backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Time by Category'
              },
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      }
    }

    return () => {
      if (categoriesChartInstance.current) {
        categoriesChartInstance.current.destroy();
      }
    };
  }, [categoriesData]);

  return (
    <section className="tab-content">
      <div className="chart-container">
        <canvas ref={weeklyChartRef}></canvas>
      </div>

      <div className="chart-container">
        <canvas ref={categoriesChartRef}></canvas>
      </div>

      <div className="stats-summary">
        <h3>Quick Stats</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Today's Total</div>
            <div className="stat-value">{formatTime(totalTime)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Most Used Site</div>
            <div className="stat-value">{stats.mostUsedSite}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Most Productive Day</div>
            <div className="stat-value">{stats.mostProductiveDay}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsTab; 
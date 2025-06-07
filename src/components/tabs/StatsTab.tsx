import React, { useMemo } from 'react';
import { formatTime, getLastNDays } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Clock, Globe, TrendingUp, Timer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

interface StatsTabProps {
  data: StorageData;
}

const StatsTab: React.FC<StatsTabProps> = ({ data }) => {
  const { sites = {}, history = {}, totalTime = 0, settings } = data;

  // Calculate today's date string for history lookup
  const todayDateString = useMemo(() => new Date().toDateString(), []);
  
  // Get yesterday's date string for comparison
  const yesterdayDateString = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toDateString();
  }, []);

  // Calculate yesterday's data for comparisons
  const yesterdayData = useMemo(() => {
    const yesterday = history[yesterdayDateString];
    return {
      totalTime: yesterday?.totalTime || 0,
      sitesCount: yesterday ? Object.keys(yesterday).filter(key => key !== 'totalTime').length : 0
    };
  }, [history, yesterdayDateString]);

  // Calculate today's usage percentage change from yesterday
  const todayUsageChange = useMemo(() => {
    if (yesterdayData.totalTime === 0) return totalTime > 0 ? '+100%' : '0%';
    const change = ((totalTime - yesterdayData.totalTime) / yesterdayData.totalTime) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }, [totalTime, yesterdayData.totalTime]);

  // Calculate sites visited change from yesterday
  const sitesVisitedChange = useMemo(() => {
    const todaySitesCount = Object.keys(sites).length;
    if (yesterdayData.sitesCount === 0) return todaySitesCount > 0 ? '+100%' : '0%';
    const change = ((todaySitesCount - yesterdayData.sitesCount) / yesterdayData.sitesCount) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }, [sites, yesterdayData.sitesCount]);

  // Calculate weekly average for total time
  const weeklyAverage = useMemo(() => {
    const last7Days = getLastNDays(7);
    let totalWeekTime = totalTime; // Include today's time
    let daysWithData = totalTime > 0 ? 1 : 0;

    // Sum up time from previous 6 days
    last7Days.slice(1).forEach((date) => {
      const dateString = date.toDateString();
      const dayData = history[dateString];

      if (dayData && dayData.totalTime > 0) {
        totalWeekTime += dayData.totalTime;
        daysWithData++;
      }
    });

    return daysWithData > 0 ? totalWeekTime / daysWithData : 0;
  }, [totalTime, history]);

  // Calculate active hours (estimate based on site activity patterns)
  const activeHours = useMemo(() => {
    // If we have site data, estimate active hours based on distribution
    // This is a simplified calculation - in reality you'd track actual active periods
    const totalSites = Object.keys(sites).length;
    if (totalSites === 0) return '0h';
    
    // Estimate: if user visited multiple sites, they were likely active for longer periods
    // Base calculation on total time and site diversity
    const estimatedActiveMs = Math.min(totalTime, totalTime * (0.6 + (totalSites * 0.05)));
    const hours = estimatedActiveMs / (1000 * 60 * 60);
    
    return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(hours * 60)}m`;
  }, [sites, totalTime]);

  // Calculate active hours change from weekly average
  const activeHoursChange = useMemo(() => {
    const todayActiveMs = Math.min(totalTime, totalTime * (0.6 + (Object.keys(sites).length * 0.05)));
    const avgActiveMs = Math.min(weeklyAverage, weeklyAverage * (0.6 + (Object.keys(sites).length * 0.05)));
    
    if (avgActiveMs === 0) return todayActiveMs > 0 ? '+100%' : 'No data';
    
    const changeMs = todayActiveMs - avgActiveMs;
    const changeHours = changeMs / (1000 * 60 * 60);
    
    return `${changeHours >= 0 ? '+' : ''}${changeHours.toFixed(1)}h from avg`;
  }, [totalTime, sites, weeklyAverage]);

  // Calculate focus score based on site diversity and time distribution
  const focusScore = useMemo(() => {
    if (totalTime === 0) return 0;
    
    const siteKeys = Object.keys(sites);
    if (siteKeys.length === 0) return 0;
    
    // Calculate focus based on:
    // 1. Time concentration (less scattered = better focus)
    // 2. Number of sites (fewer sites = better focus)
    // 3. Productive vs non-productive site ratio
    
    // Create array of [domain, siteInfo] pairs and sort by time spent
    const siteEntries: [string, SiteInfo][] = siteKeys.map(domain => [domain, sites[domain]]);
    const sortedSites = siteEntries.sort((a: [string, SiteInfo], b: [string, SiteInfo]) => b[1].totalTime - a[1].totalTime);
    
    // Calculate concentration: how much time is spent on top sites
    const top3SitesTime = sortedSites.slice(0, 3).reduce((sum: number, [_, info]: [string, SiteInfo]) => sum + info.totalTime, 0);
    const concentration = top3SitesTime / totalTime;
    
    // Site diversity penalty (more sites = lower focus)
    const diversityPenalty = Math.min(siteKeys.length / 10, 1); // Max penalty at 10+ sites
    
    // Productivity categorization based on domains
    let productiveTime = 0;
    let distractingTime = 0;
    
    siteKeys.forEach(domain => {
      const lowerDomain = domain.toLowerCase();
      const siteTime = sites[domain].totalTime;
      
      // Categorize sites as productive or distracting
      if (lowerDomain.includes('github') || lowerDomain.includes('stackoverflow') || 
          lowerDomain.includes('docs') || lowerDomain.includes('dev') ||
          lowerDomain.includes('learn') || lowerDomain.includes('course') ||
          lowerDomain.includes('work') || lowerDomain.includes('office') ||
          lowerDomain.includes('notion') || lowerDomain.includes('slack')) {
        productiveTime += siteTime;
      } else if (lowerDomain.includes('youtube') || lowerDomain.includes('netflix') ||
                 lowerDomain.includes('facebook') || lowerDomain.includes('twitter') ||
                 lowerDomain.includes('instagram') || lowerDomain.includes('reddit') ||
                 lowerDomain.includes('tiktok') || lowerDomain.includes('game')) {
        distractingTime += siteTime;
      }
    });
    
    // Calculate productivity bonus (0-30 points)
    const productivityRatio = productiveTime / Math.max(productiveTime + distractingTime, totalTime * 0.8);
    const productivityBonus = productivityRatio * 30;
    
    // Final score calculation
    const concentrationScore = concentration * 50; // 0-50 points
    const diversityScore = (1 - diversityPenalty) * 20; // 0-20 points
    const finalScore = concentrationScore + diversityScore + productivityBonus;
    
    return Math.min(100, Math.max(0, Math.round(finalScore)));
  }, [sites, totalTime]);

  // Get focus score label
  const focusScoreLabel = useMemo(() => {
    if (focusScore >= 80) return 'Excellent focus';
    if (focusScore >= 60) return 'Good productivity';
    if (focusScore >= 40) return 'Moderate focus';
    if (focusScore >= 20) return 'Easily distracted';
    return 'Very scattered';
  }, [focusScore]);

  // Prepare chart data based on actual historical usage patterns
  const chartData = useMemo(() => {
    const hourlyData: { time: string; usage: number; focus: number }[] = [];
    
    // Get today's data and recent history for pattern analysis
    const recentDays = getLastNDays(7);
    const hourlyPatterns: { [hour: number]: { totalTime: number; avgFocus: number; dataPoints: number } } = {};
    
    // Initialize hourly patterns
    for (let hour = 0; hour < 24; hour++) {
      hourlyPatterns[hour] = { totalTime: 0, avgFocus: 0, dataPoints: 0 };
    }
    
    // Analyze patterns from historical data
    recentDays.forEach(date => {
      const dateString = date.toDateString();
      const dayData = history[dateString];
      
      if (dayData && dayData.totalTime > 0) {
        // Distribute daily time across hours based on typical usage patterns
        // This is a simplified estimation - in a real app you'd track hourly data
        const dailyTotalMs = dayData.totalTime;
        const sitesCount = Object.keys(dayData).filter(key => key !== 'totalTime').length;
        
        // Model typical usage patterns: work hours peak, evening moderate, night/early morning low
        const hourlyWeights = [
          0.01, 0.01, 0.01, 0.01, 0.01, 0.02, // 0-5 AM (very low)
          0.03, 0.05, 0.08, 0.12, 0.15, 0.18, // 6-11 AM (rising)
          0.16, 0.14, 0.12, 0.10, 0.08, 0.06, // 12-5 PM (peak then declining)
          0.05, 0.04, 0.03, 0.02, 0.01, 0.01  // 6-11 PM (evening decline)
        ];
        
        hourlyWeights.forEach((weight, hour) => {
          const estimatedHourTime = dailyTotalMs * weight;
          hourlyPatterns[hour].totalTime += estimatedHourTime;
          
          // Estimate focus based on concentration and time distribution
          const hourlyFocus = Math.max(20, Math.min(95, 
            70 - (sitesCount * 2) + (weight * 100) + (Math.random() * 10 - 5)
          ));
          hourlyPatterns[hour].avgFocus += hourlyFocus;
          hourlyPatterns[hour].dataPoints++;
        });
      }
    });
    
    // Generate chart data for display hours (6 AM to 11 PM)
    for (let hour = 6; hour <= 23; hour++) {
      const timeLabel = hour === 0 ? '12 AM' : 
                      hour <= 12 ? (hour === 12 ? '12 PM' : `${hour} AM`) : 
                      `${hour - 12} PM`;
      
      const pattern = hourlyPatterns[hour];
      const avgMinutes = pattern.dataPoints > 0 ? 
        Math.round((pattern.totalTime / pattern.dataPoints) / (1000 * 60)) : 0;
      const avgFocus = pattern.dataPoints > 0 ? 
        Math.round(pattern.avgFocus / pattern.dataPoints) : 50;
      
      hourlyData.push({ 
        time: timeLabel, 
        usage: Math.max(0, avgMinutes),
        focus: Math.max(20, Math.min(100, avgFocus))
      });
    }
    
    // If no historical data, show minimal pattern based on current session
    if (hourlyData.every(d => d.usage === 0) && totalTime > 0) {
      const currentHour = new Date().getHours();
      const currentUsageMinutes = Math.round(totalTime / (1000 * 60));
      
      hourlyData.forEach((data, index) => {
        const hour = index + 6;
        if (hour === currentHour) {
          data.usage = currentUsageMinutes;
          data.focus = focusScore;
        } else {
          // Distribute some usage to nearby hours
          const distance = Math.abs(hour - currentHour);
          if (distance <= 2) {
            data.usage = Math.round(currentUsageMinutes * (0.3 / (distance + 1)));
            data.focus = Math.max(20, focusScore + (Math.random() * 20 - 10));
          }
        }
      });
    }
    
    return hourlyData;
  }, [totalTime, history, focusScore]);

  return (
    <section className="tab-content">
      {/* Statistics Cards - 2x2 Grid */}
      <div className="stats-grid">
        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Today's Usage
            </CardTitle>
            <Clock className="card-icon text-red-400" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">
              {formatTime(totalTime)}
            </div>
            <p className={`stat-change ${todayUsageChange.startsWith('+') ? 'text-red-400' : 'text-green-400'}`}>
              {todayUsageChange} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Sites Visited
            </CardTitle>
            <Globe className="card-icon text-orange-400" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">{Object.keys(sites).length}</div>
            <p className={`stat-change ${sitesVisitedChange.startsWith('+') ? 'text-red-400' : 'text-green-400'}`}>
              {sitesVisitedChange} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Active Hours
            </CardTitle>
            <Timer className="card-icon text-blue-400" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">{activeHours}</div>
            <p className={`stat-change ${activeHoursChange.startsWith('+') ? 'text-red-400' : 'text-green-400'}`}>
              {activeHoursChange}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Focus Score
            </CardTitle>
            <TrendingUp className="card-icon text-emerald-400" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">{focusScore}%</div>
            <p className={`stat-change ${focusScore >= 60 ? 'text-emerald-400' : focusScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {focusScoreLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <h3 className="chart-title">Daily Usage Pattern</h3>
        <p className="chart-subtitle">Browser activity and focus throughout the day</p>
        
        <div className="chart-container-new">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                domain={[0, 'dataMax']}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '12px',
                  color: '#e5e7eb'
                }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="usage" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, fill: '#8b5cf6' }}
                name="Usage (minutes)"
              />
              <Line 
                type="monotone" 
                dataKey="focus" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
                name="Focus Score (%)"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default StatsTab; 
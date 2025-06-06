import React, { useMemo } from 'react';
import { formatTime, getLastNDays } from '../../utils/timeUtils';
import { StorageData, SiteInfo } from '../../types/storage';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Clock, Globe, TrendingUp, Timer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface StatsTabProps {
  data: StorageData;
}

const StatsTab: React.FC<StatsTabProps> = ({ data }) => {
  const { sites = {}, history = {}, totalTime = 0, settings } = data;

  // Calculate weekly average
  const weeklyAverage = useMemo(() => {
    const last7Days = getLastNDays(7);
    let totalWeekTime = totalTime; // Include today's time
    let daysWithData = totalTime > 0 ? 1 : 0;

    // Sum up time from previous 6 days
    last7Days.slice(0, 6).forEach((date) => {
      const dateString = date.toDateString();
      const dayData = history[dateString];

      if (dayData && dayData.totalTime > 0) {
        totalWeekTime += dayData.totalTime;
        daysWithData++;
      }
    });

    return daysWithData > 0 ? totalWeekTime / daysWithData : 0;
  }, [totalTime, history]);

  // Calculate sites visited count
  const sitesVisitedCount = useMemo(() => {
    return Object.keys(sites).length;
  }, [sites]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const last7Days = getLastNDays(7);
    const data: { time: string; value: number }[] = [];

    // Generate hourly data for today (simplified example)
    for (let hour = 6; hour <= 23; hour++) {
      const timeLabel = hour <= 12 ? `${hour} AM` : `${hour - 12} PM`;
      if (hour === 12) {
        data.push({ time: '12 PM', value: Math.random() * 140 + 10 });
      } else {
        data.push({ 
          time: timeLabel, 
          value: Math.random() * 140 + 10 
        });
      }
    }

    return data;
  }, [history]);

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
            <p className="stat-change text-red-400">+12% from yesterday</p>
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
            <div className="stat-value">{sitesVisitedCount}</div>
            <p className="stat-change text-green-400">-5% from yesterday</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Active Hours
            </CardTitle>
            <Timer className="card-icon text-red-400" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">8.5h</div>
            <p className="stat-change text-red-400">+2.1h from avg</p>
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
            <div className="stat-value">73%</div>
            <p className="stat-change text-emerald-400">Good productivity</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <h3 className="chart-title">Daily Usage Pattern</h3>
        <p className="chart-subtitle">Browser activity throughout the day</p>
        
        <div className="chart-container-new">
          <ResponsiveContainer width="100%" height={200}>
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
                domain={[0, 140]}
                ticks={[0, 35, 70, 105, 140]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, fill: '#8b5cf6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default StatsTab; 
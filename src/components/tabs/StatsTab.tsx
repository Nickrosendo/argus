import React, { useMemo, useState } from 'react';
import { formatTime } from '../../utils/timeUtils';
import {
  compareWithYesterday,
  countSites,
  getDailyAverage,
  getDay,
  getGoalProgress,
  getHourlyChart,
  getPeakHour,
  getSessionStats,
} from '../../utils/metrics';
import { StorageData } from '../../types/storage';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Clock, Globe, TrendingUp, Timer, BarChart3, Target, MousePointer } from "lucide-react";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  CartesianGrid
} from 'recharts';

interface StatsTabProps {
  data: StorageData;
}

const NEUTRAL = 'text-gray-400';

const StatsTab: React.FC<StatsTabProps> = ({ data }) => {
  const { sites = {}, history = {}, totalTime = 0, hourly, settings } = data;
  const [chartType, setChartType] = useState<'line' | 'area'>('area');
  const colors = useThemeColors();

  // The current hour drives the comparisons; recomputing when totals change
  // keeps it current while the popup stays open
  const now = useMemo(() => new Date(), [totalTime]);
  const yesterday = useMemo(() => {
    const date = new Date(now.getTime());
    date.setDate(date.getDate() - 1);
    return getDay(history, date);
  }, [history, now]);

  const usageComparison = useMemo(
    () => compareWithYesterday(totalTime, yesterday, now),
    [totalTime, yesterday, now]
  );
  const sitesCount = countSites(sites);
  const dailyAverage = useMemo(() => getDailyAverage(history, now), [history, now]);
  const goal = useMemo(() => getGoalProgress(totalTime, settings?.dailyLimit), [totalTime, settings?.dailyLimit]);
  const chartData = useMemo(() => getHourlyChart(hourly, history, now), [hourly, history, now]);
  const peakHour = useMemo(() => getPeakHour(hourly), [hourly]);
  const sessions = useMemo(() => getSessionStats(sites, totalTime), [sites, totalTime]);

  const hasAverage = chartData.some((point) => point.average !== null);
  const hasHourlyData = !!peakHour;

  // More time than yesterday is shown in red, less in green
  const comparisonColor =
    usageComparison.direction === 'up' ? 'text-red-400' :
    usageComparison.direction === 'down' ? 'text-green-400' : NEUTRAL;

  // Custom tooltip component for better interactivity
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {entry.value} min
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom tick component for better time label formatting
  const CustomTick = ({ x, y, payload }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={16} 
          textAnchor="middle" 
          fill={colors.muted} 
          fontSize="11"
          transform="rotate(-30)"
        >
          {payload.value}
        </text>
      </g>
    );
  };

  const xAxis = (
    <XAxis 
      dataKey="time" 
      axisLine={false}
      tickLine={false}
      tick={<CustomTick />}
      interval={2}
      height={50}
    />
  );
  const yAxis = (
    <YAxis 
      axisLine={false}
      tickLine={false}
      tick={{ fill: colors.muted, fontSize: 11 }}
      domain={[0, 60]}
      allowDecimals={false}
    />
  );
  const legend = (
    <Legend 
      wrapperStyle={{ 
        paddingTop: '15px',
        fontSize: '12px',
        color: colors.muted
      }}
      iconType="rect"
    />
  );

  return (
    <section className="tab-content">
      {/* Statistics Cards - 2x2 Grid */}
      <div className="stats-grid">
        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Today's Usage
            </CardTitle>
            <Clock className="card-icon" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">
              {formatTime(totalTime)}
            </div>
            <p className={`stat-change ${comparisonColor}`}>
              {usageComparison.label}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Sites Visited
            </CardTitle>
            <Globe className="card-icon" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">{sitesCount}</div>
            <p className={`stat-change ${NEUTRAL}`}>
              {yesterday ? `${countSites(yesterday.sites)} all of yesterday` : 'No data for yesterday'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Daily Average
            </CardTitle>
            <Timer className="card-icon" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">
              {dailyAverage.daysCounted > 0 ? formatTime(dailyAverage.average) : '—'}
            </div>
            <p className={`stat-change ${NEUTRAL}`}>
              {dailyAverage.daysCounted > 0
                ? `Over the last ${dailyAverage.daysCounted} day${dailyAverage.daysCounted === 1 ? '' : 's'} with activity`
                : 'Available from tomorrow'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">
              Daily Goal
            </CardTitle>
            <Target className="card-icon" />
          </CardHeader>
          <CardContent className="card-content">
            <div className="stat-value">{goal ? `${goal.percent}%` : '—'}</div>
            <p className={`stat-change ${!goal ? NEUTRAL : goal.over ? 'text-red-400' : 'text-emerald-400'}`}>
              {!goal
                ? 'Set a goal in Settings'
                : goal.over
                  ? `${formatTime(goal.remaining)} over your ${formatTime(goal.goal)} goal`
                  : `${formatTime(goal.remaining)} left of ${formatTime(goal.goal)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <div className="chart-header">
          <div className="chart-title-section">
            <h3 className="chart-title">Today by Hour</h3>
            <p className="chart-subtitle">
              {hasAverage
                ? 'Minutes of browsing in each hour, next to your recent average'
                : 'Minutes of browsing in each hour'}
            </p>
          </div>
          
          <div className="chart-controls">
            <div className="chart-type-toggle">
              <button 
                className={`chart-btn ${chartType === 'area' ? 'active' : ''}`}
                onClick={() => setChartType('area')}
                title="Area Chart"
              >
                <BarChart3 size={16} />
              </button>
              <button 
                className={`chart-btn ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                title="Line Chart"
              >
                <TrendingUp size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Chart Summary */}
        <div className="chart-analytics">
          <div className="analytics-item">
            <Clock size={14} />
            <span>Busiest hour: {peakHour ? `${peakHour.label} (${formatTime(peakHour.time)})` : '—'}</span>
          </div>
          <div className="analytics-item">
            <MousePointer size={14} />
            <span>Visits: {sessions.sessions}</span>
          </div>
        </div>
        
        {!hasHourlyData && !hasAverage ? (
          <div className="no-sites-data">
            <p>Your day by hour appears here as you browse.</p>
          </div>
        ) : (
          <div className="chart-container-enhanced">
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 50 }}>
                  <defs>
                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.accent} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={colors.accent} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
                  {xAxis}
                  {yAxis}
                  <Tooltip content={<CustomTooltip />} />
                  {legend}
                  {hasAverage && (
                    <Area
                      type="monotone"
                      dataKey="average"
                      stroke={colors.muted}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      fill="none"
                      name="Recent average"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="today"
                    stroke={colors.accent}
                    strokeWidth={2}
                    fill="url(#usageGradient)"
                    name="Today"
                    dot={false}
                    activeDot={{ r: 4, fill: colors.accent, strokeWidth: 2, stroke: colors.surface }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.line} />
                  {xAxis}
                  {yAxis}
                  <Tooltip content={<CustomTooltip />} />
                  {legend}
                  {hasAverage && (
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke={colors.muted}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      name="Recent average"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="today"
                    stroke={colors.accent}
                    strokeWidth={2}
                    name="Today"
                    dot={false}
                    activeDot={{ r: 4, fill: colors.accent, strokeWidth: 2, stroke: colors.surface }}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
};

export default StatsTab;

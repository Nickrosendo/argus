import React from 'react';
import { render, screen } from '@testing-library/react';
import TodayTab from '../../../src/components/tabs/TodayTab';
import { StorageData } from '../../../src/types/storage';

// Mock the utility functions
jest.mock('../../../src/utils/timeUtils', () => ({
  formatTime: jest.fn((milliseconds: number) => {
    if (!milliseconds) return '0m';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }),
  getLastNDays: jest.fn((n: number): Date[] => {
    const result: Date[] = [];
    for (let i = 0; i < n; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      result.push(date);
    }
    return result;
  }),
}));

describe('TodayTab Component', () => {
  const mockUpdateStorage = jest.fn();

  const defaultData: StorageData = {
    sites: {},
    totalTime: 0,
    history: {},
    settings: {
      idleTime: 5,
      dailyLimit: 8,
      showNotifications: true,
      enableBlocking: false,
    },
    blockedSites: [],
    authToken: null,
    userInfo: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with no data', () => {
    it('should display no data message when no sites are tracked', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText("Today's Screen Time")).toBeInTheDocument();
      expect(screen.getByText('0m')).toBeInTheDocument();
      expect(screen.getByText('Most Visited Sites')).toBeInTheDocument();
      expect(screen.getByText('No data available yet')).toBeInTheDocument();
    });

    it('should not show weekly average when no history', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.queryByText(/Weekly average:/)).not.toBeInTheDocument();
    });
  });

  describe('Rendering with site data', () => {
    it('should display sites sorted by time spent', () => {
      const dataWithSites: StorageData = {
        ...defaultData,
        sites: {
          'example.com': {
            totalTime: 3600000, // 1 hour
            favicon: 'https://example.com/favicon.ico',
          },
          'google.com': {
            totalTime: 7200000, // 2 hours
            favicon: 'https://google.com/favicon.ico',
          },
          'github.com': {
            totalTime: 1800000, // 30 minutes
            favicon: undefined,
          },
        },
        totalTime: 10800000, // 3 hours total
      };

      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('3h 0m')).toBeInTheDocument(); // Total time
      expect(screen.getByText('google.com')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('github.com')).toBeInTheDocument();
      
      // Check that sites are in correct order (highest time first)
      const siteItems = screen.getAllByText(/\.(com|org|net)/);
      expect(siteItems[0]).toHaveTextContent('google.com');
      expect(siteItems[1]).toHaveTextContent('example.com');
      expect(siteItems[2]).toHaveTextContent('github.com');
    });

    it('should display site favicons when available', () => {
      const dataWithSites: StorageData = {
        ...defaultData,
        sites: {
          'example.com': {
            totalTime: 3600000,
            favicon: 'https://example.com/favicon.ico',
          },
        },
        totalTime: 3600000,
      };

      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      const favicon = screen.getByAltText('example.com icon');
      expect(favicon).toBeInTheDocument();
      expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
    });

    it('should display first letter when no favicon available', () => {
      const dataWithSites: StorageData = {
        ...defaultData,
        sites: {
          'github.com': {
            totalTime: 1800000,
            favicon: undefined,
          },
        },
        totalTime: 1800000,
      };

      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('G')).toBeInTheDocument(); // First letter of github.com
    });
  });

  describe('Progress bar calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const dataWithProgress: StorageData = {
        ...defaultData,
        totalTime: 14400000, // 4 hours
        settings: {
          ...defaultData.settings,
          dailyLimit: 8, // 8 hour limit
        },
      };

      render(<TodayTab data={dataWithProgress} updateStorage={mockUpdateStorage} />);
      
      // Should show 50% progress (4 hours out of 8 hour limit)
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 50%');
    });

    it('should cap progress at 100%', () => {
      const dataOverLimit: StorageData = {
        ...defaultData,
        totalTime: 36000000, // 10 hours
        settings: {
          ...defaultData.settings,
          dailyLimit: 8, // 8 hour limit
        },
      };

      render(<TodayTab data={dataOverLimit} updateStorage={mockUpdateStorage} />);
      
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 100%');
    });

    it('should handle default daily limit when settings not available', () => {
      const dataNoSettings: StorageData = {
        ...defaultData,
        totalTime: 14400000, // 4 hours
        settings: undefined as any,
      };

      render(<TodayTab data={dataNoSettings} updateStorage={mockUpdateStorage} />);
      
      // Should use default 8 hour limit
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 50%');
    });
  });

  describe('Weekly average calculation', () => {
    it('should display weekly average when history is available', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const dataWithHistory: StorageData = {
        ...defaultData,
        totalTime: 7200000, // 2 hours today
        history: {
          [yesterday.toDateString()]: { totalTime: 10800000 }, // 3 hours yesterday
          [twoDaysAgo.toDateString()]: { totalTime: 3600000 }, // 1 hour two days ago
        },
      };

      render(<TodayTab data={dataWithHistory} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText(/Weekly average:/)).toBeInTheDocument();
    });

    it('should not display weekly average when no history and no current time', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.queryByText(/Weekly average:/)).not.toBeInTheDocument();
    });

    it('should calculate weekly average excluding days with zero time', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dataWithZeroDay: StorageData = {
        ...defaultData,
        totalTime: 3600000, // 1 hour today
        history: {
          [yesterday.toDateString()]: { totalTime: 0 }, // No time yesterday
        },
      };

      render(<TodayTab data={dataWithZeroDay} updateStorage={mockUpdateStorage} />);
      
      // Should show weekly average based only on today (1 hour)
      expect(screen.getByText(/Weekly average:/)).toBeInTheDocument();
    });
  });

  describe('Data handling edge cases', () => {
    it('should handle undefined sites gracefully', () => {
      const dataUndefinedSites: StorageData = {
        ...defaultData,
        sites: undefined as any,
      };

      render(<TodayTab data={dataUndefinedSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('No data available yet')).toBeInTheDocument();
    });

    it('should handle null totalTime gracefully', () => {
      const dataNullTime: StorageData = {
        ...defaultData,
        totalTime: null as any,
      };

      render(<TodayTab data={dataNullTime} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('0m')).toBeInTheDocument();
    });

    it('should handle undefined history gracefully', () => {
      const dataUndefinedHistory: StorageData = {
        ...defaultData,
        history: undefined as any,
      };

      render(<TodayTab data={dataUndefinedHistory} updateStorage={mockUpdateStorage} />);
      
      expect(screen.queryByText(/Weekly average:/)).not.toBeInTheDocument();
    });

    it('should handle sites with missing data gracefully', () => {
      const dataIncompleteSites: StorageData = {
        ...defaultData,
        sites: {
          'example.com': {
            totalTime: 3600000,
            // Missing favicon property
          } as any,
          'broken.com': {
            // Missing totalTime property
            favicon: 'icon.ico',
          } as any,
        },
        totalTime: 3600000,
      };

      render(<TodayTab data={dataIncompleteSites} updateStorage={mockUpdateStorage} />);
      
      // Should render without crashing
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('Memoization and performance', () => {
    it('should recalculate weekly average when history changes', () => {
      const initialData: StorageData = {
        ...defaultData,
        totalTime: 3600000,
        history: {},
      };

      const { rerender } = render(<TodayTab data={initialData} updateStorage={mockUpdateStorage} />);
      
      // Should show weekly average since we have current day data (totalTime > 0)
      expect(screen.getByText(/Weekly average:/)).toBeInTheDocument();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const updatedData: StorageData = {
        ...initialData,
        history: {
          [yesterday.toDateString()]: { totalTime: 7200000 },
        },
      };

      rerender(<TodayTab data={updatedData} updateStorage={mockUpdateStorage} />);
      
      // Should still show weekly average, but now calculated with history data
      expect(screen.getByText(/Weekly average:/)).toBeInTheDocument();
    });

    it('should recalculate progress when totalTime changes', () => {
      const initialData: StorageData = {
        ...defaultData,
        totalTime: 3600000, // 1 hour
      };

      const { rerender } = render(<TodayTab data={initialData} updateStorage={mockUpdateStorage} />);
      
      let progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 12.5%'); // 1 hour out of 8

      const updatedData: StorageData = {
        ...initialData,
        totalTime: 14400000, // 4 hours
      };

      rerender(<TodayTab data={updatedData} updateStorage={mockUpdateStorage} />);
      
      progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 50%'); // 4 hours out of 8
    });

    it('should recalculate sorted sites when sites data changes', () => {
      const initialData: StorageData = {
        ...defaultData,
        sites: {
          'example.com': { totalTime: 1000, favicon: undefined },
        },
        totalTime: 1000,
      };

      const { rerender } = render(<TodayTab data={initialData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.queryByText('google.com')).not.toBeInTheDocument();

      const updatedData: StorageData = {
        ...initialData,
        sites: {
          'example.com': { totalTime: 1000, favicon: undefined },
          'google.com': { totalTime: 2000, favicon: undefined },
        },
        totalTime: 3000,
      };

      rerender(<TodayTab data={updatedData} updateStorage={mockUpdateStorage} />);
      
      const siteItems = screen.getAllByText(/\.(com|org|net)/);
      expect(siteItems[0]).toHaveTextContent('google.com'); // Should be first due to higher time
      expect(siteItems[1]).toHaveTextContent('example.com');
    });
  });
}); 
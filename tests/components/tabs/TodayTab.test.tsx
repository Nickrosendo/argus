import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TodayTab from '../../../src/components/tabs/TodayTab';
import { StorageData } from '../../../src/types/storage';

// Mock the timeUtils module
jest.mock('../../../src/utils/timeUtils', () => ({
  formatTime: jest.fn((time: number) => {
    const hours = Math.floor(time / 3600000);
    const minutes = Math.floor((time % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }),
  getLastNDays: jest.fn(),
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
      enableBlocking: false,
    },
    blockedSites: [],
    authToken: null,
    userInfo: null,
    freeMode: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering with no data', () => {
    it('should display no data message when no sites are tracked', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('Most Visited Sites')).toBeInTheDocument();
      expect(screen.getByText('No data available yet')).toBeInTheDocument();
    });

    it('should render sites container with correct structure', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const section = document.querySelector('section.tab-content.active');
      expect(section).toBeInTheDocument();
      expect(screen.getByText('Most Visited Sites')).toBeInTheDocument();
    });
  });

  describe('Rendering with site data', () => {
    const dataWithSites: StorageData = {
      ...defaultData,
      sites: {
        'google.com': {
          totalTime: 7200000, // 2 hours
          favicon: 'https://google.com/favicon.ico',
        },
        'example.com': {
          totalTime: 3600000, // 1 hour
          favicon: 'https://example.com/favicon.ico',
        },
        'github.com': {
          totalTime: 1800000, // 30 minutes
          favicon: undefined,
        },
      },
      totalTime: 10800000, // 3 hours total
    };

    it('should display sites sorted by time spent', () => {
      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('google.com')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('github.com')).toBeInTheDocument();
      
      // Check that time is displayed for each site
      expect(screen.getByText('2h 0m')).toBeInTheDocument(); // google.com time
      expect(screen.getByText('1h 0m')).toBeInTheDocument(); // example.com time
      expect(screen.getByText('30m')).toBeInTheDocument(); // github.com time
    });

    it('should display site icons correctly', () => {
      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      // Check for favicon images
      const googleIcon = screen.getByAltText('google.com icon');
      expect(googleIcon).toBeInTheDocument();
      expect(googleIcon).toHaveAttribute('src', 'https://google.com/favicon.ico');
      
      const exampleIcon = screen.getByAltText('example.com icon');
      expect(exampleIcon).toBeInTheDocument();
      expect(exampleIcon).toHaveAttribute('src', 'https://example.com/favicon.ico');
      
      // Check for fallback text icon
      expect(screen.getByText('G')).toBeInTheDocument(); // github.com fallback
    });

    it('should render sites in correct order (highest time first)', () => {
      render(<TodayTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      const siteItems = screen.getAllByText(/\d+[hm]/); // Find time elements
      expect(siteItems[0]).toHaveTextContent('2h 0m'); // google.com (highest)
      expect(siteItems[1]).toHaveTextContent('1h 0m'); // example.com (middle)
      expect(siteItems[2]).toHaveTextContent('30m'); // github.com (lowest)
    });
  });

  describe('Site icon rendering', () => {
    it('should show favicon when available', () => {
      const dataWithFavicon: StorageData = {
        ...defaultData,
        sites: {
          'test.com': {
            totalTime: 1000,
            favicon: 'https://test.com/favicon.ico',
          },
        },
      };

      render(<TodayTab data={dataWithFavicon} updateStorage={mockUpdateStorage} />);
      
      const icon = screen.getByAltText('test.com icon');
      expect(icon).toHaveAttribute('src', 'https://test.com/favicon.ico');
    });

    it('should show fallback letter when no favicon', () => {
      const dataWithoutFavicon: StorageData = {
        ...defaultData,
        sites: {
          'example.com': {
            totalTime: 1000,
            favicon: undefined,
          },
        },
      };

      render(<TodayTab data={dataWithoutFavicon} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('E')).toBeInTheDocument(); // First letter of domain
    });
  });

  describe('Data handling edge cases', () => {
    it('should handle empty sites object', () => {
      const emptyData: StorageData = {
        ...defaultData,
        sites: {},
      };

      render(<TodayTab data={emptyData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('No data available yet')).toBeInTheDocument();
    });

    it('should handle undefined sites gracefully', () => {
      const dataWithUndefinedSites: StorageData = {
        ...defaultData,
        sites: undefined as any,
      };

      render(<TodayTab data={dataWithUndefinedSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('No data available yet')).toBeInTheDocument();
    });

    it('should handle sites with zero time', () => {
      const dataWithZeroTime: StorageData = {
        ...defaultData,
        sites: {
          'test.com': {
            totalTime: 0,
            favicon: undefined,
          },
        },
      };

      render(<TodayTab data={dataWithZeroTime} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('test.com')).toBeInTheDocument();
      expect(screen.getByText('0m')).toBeInTheDocument();
    });
  });

  describe('Component structure', () => {
    it('should have correct CSS classes', () => {
      render(<TodayTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const section = document.querySelector('section.tab-content.active');
      expect(section).toBeInTheDocument();
      expect(section).toHaveClass('tab-content', 'active');
      
      const container = section?.querySelector('.sites-container');
      expect(container).toBeInTheDocument();
      
      const sitesList = container?.querySelector('.sites-list');
      expect(sitesList).toBeInTheDocument();
    });

    it('should render site items with correct structure when data exists', () => {
      const dataWithOneSite: StorageData = {
        ...defaultData,
        sites: {
          'test.com': {
            totalTime: 1000,
            favicon: 'test-favicon.ico',
          },
        },
      };

      render(<TodayTab data={dataWithOneSite} updateStorage={mockUpdateStorage} />);
      
      const siteItem = screen.getByText('test.com').closest('.site-item');
      expect(siteItem).toBeInTheDocument();
      
      const siteIcon = siteItem?.querySelector('.site-icon');
      expect(siteIcon).toBeInTheDocument();
      
      const siteInfo = siteItem?.querySelector('.site-info');
      expect(siteInfo).toBeInTheDocument();
      
      const siteDomain = siteInfo?.querySelector('.site-domain');
      expect(siteDomain).toBeInTheDocument();
      
      const siteTime = siteInfo?.querySelector('.site-time');
      expect(siteTime).toBeInTheDocument();
    });
  });
}); 
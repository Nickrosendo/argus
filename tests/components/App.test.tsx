import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/components/App';

// Mock all the components
jest.mock('../../src/components/Header', () => {
  return function MockHeader() {
    return <div data-testid="mock-header">Mock Header</div>;
  };
});

jest.mock('../../src/components/Footer', () => {
  return function MockFooter() {
    return <div data-testid="mock-footer">Mock Footer</div>;
  };
});

jest.mock('../../src/components/tabs/StatsTab', () => {
  return function MockStatsTab() {
    return <div data-testid="mock-stats-tab">Mock Stats Tab</div>;
  };
});

jest.mock('../../src/components/tabs/HistoryTab', () => {
  return function MockHistoryTab() {
    return <div data-testid="mock-history-tab">Mock History Tab</div>;
  };
});

jest.mock('../../src/components/tabs/SitesTab', () => {
  return function MockSitesTab() {
    return <div data-testid="mock-sites-tab">Mock Sites Tab</div>;
  };
});

jest.mock('../../src/components/tabs/FocusTab', () => {
  return function MockFocusTab() {
    return <div data-testid="mock-focus-tab">Mock Focus Tab</div>;
  };
});

jest.mock('../../src/components/tabs/SettingsTab', () => {
  return function MockSettingsTab() {
    return <div data-testid="mock-settings-tab">Mock Settings Tab</div>;
  };
});

jest.mock('../../src/components/tabs/AccountTab', () => {
  return function MockAccountTab() {
    return <div data-testid="mock-account-tab">Mock Account Tab</div>;
  };
});

jest.mock('../../src/components/AuthPage', () => {
  return function MockAuthPage({ onAuth, onFreeMode }: any) {
    return (
      <div data-testid="mock-auth-page">
        Mock Auth Page
        <button onClick={() => onAuth(true, { token: 'test', user: { id: '1', email: 'test@test.com', name: 'Test' } })}>
          Mock Login
        </button>
        <button onClick={() => onFreeMode()}>
          Mock Free Mode
        </button>
      </div>
    );
  };
});

// Mock the hooks
jest.mock('../../src/hooks/useBrowserStorage', () => ({
  useBrowserStorage: jest.fn(),
}));

jest.mock('../../src/hooks/useBrowserMessaging', () => ({
  useBrowserMessaging: jest.fn(),
}));

// Import the mocked hooks
import { useBrowserStorage } from '../../src/hooks/useBrowserStorage';
import { useBrowserMessaging } from '../../src/hooks/useBrowserMessaging';

const mockUseBrowserStorage = useBrowserStorage as jest.MockedFunction<typeof useBrowserStorage>;
const mockUseBrowserMessaging = useBrowserMessaging as jest.MockedFunction<typeof useBrowserMessaging>;

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock return values
    mockUseBrowserStorage.mockReturnValue({
      data: {
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
        freeMode: true,
        lastUpdated: new Date().toISOString(),
      },
      loading: false,
      updateStorage: jest.fn(),
    });
    
    mockUseBrowserMessaging.mockReturnValue({
      sendMessage: jest.fn(),
      signin: jest.fn(),
      signup: jest.fn(),
      socialAuth: jest.fn(),
      signout: jest.fn(),
      checkAuthentication: jest.fn(),
    });
  });

  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-stats-tab')).toBeInTheDocument();
  });

  it('should show loading state when data is loading', () => {
    mockUseBrowserStorage.mockReturnValue({
      data: {
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
        freeMode: true,
        lastUpdated: new Date().toISOString(),
      },
      loading: true,
      updateStorage: jest.fn(),
    });

    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render stats tab by default', () => {
    render(<App />);
    expect(screen.getByTestId('mock-stats-tab')).toBeInTheDocument();
  });
}); 

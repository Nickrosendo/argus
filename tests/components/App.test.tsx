import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../../src/components/App';

// Mock all the components
jest.mock('../../src/components/Header', () => {
  return function MockHeader({ onTabChange, onToggleSettings }: any) {
    return (
      <div data-testid="mock-header">
        <button onClick={() => onTabChange('focus')}>Go Focus</button>
        <button onClick={() => onTabChange('history')}>Go History</button>
        <button aria-label="Settings" onClick={onToggleSettings}>Gear</button>
      </div>
    );
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
    return <div data-testid="mock-focus-tab">Start 25-minute session</div>;
  };
});

jest.mock('../../src/components/tabs/SettingsTab', () => {
  return function MockSettingsTab() {
    return <div data-testid="mock-settings-tab">Mock Settings Tab</div>;
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

// tests/setup.js replaces window.addEventListener and dispatchEvent with stubs;
// the openSettingsTab tests need the real ones
const realAddEventListener = EventTarget.prototype.addEventListener;
const realRemoveEventListener = EventTarget.prototype.removeEventListener;
const realDispatchEvent = EventTarget.prototype.dispatchEvent;

describe('App Component', () => {
  beforeEach(() => {
    window.addEventListener = realAddEventListener.bind(window) as typeof window.addEventListener;
    window.removeEventListener = realRemoveEventListener.bind(window) as typeof window.removeEventListener;
    window.dispatchEvent = realDispatchEvent.bind(window);

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

  it('never renders a sign-in screen or any premium, upgrade or sign in text', () => {
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(/premium|upgrade|sign in/i);
  });

  it('renders the Focus timer for everyone', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go Focus'));
    expect(screen.getByText(/Start 25-minute session/)).toBeInTheDocument();
  });

  it('opens Settings from the gear and returns to the previous tab when pressed again', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go History'));
    expect(screen.getByTestId('mock-history-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('mock-settings-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('mock-history-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-settings-tab')).not.toBeInTheDocument();
  });

  it('shows Settings when it receives the openSettingsTab event', () => {
    render(<App />);
    act(() => {
      window.dispatchEvent(new CustomEvent('openSettingsTab'));
    });
    expect(screen.getByTestId('mock-settings-tab')).toBeInTheDocument();
  });

  it('opens Settings on load when the page address ends in #settings', () => {
    window.location.hash = '#settings';
    try {
      render(<App />);
      expect(screen.getByTestId('mock-settings-tab')).toBeInTheDocument();
    } finally {
      window.location.hash = '';
    }
  });
});

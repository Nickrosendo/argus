import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsTab from '../../../src/components/tabs/SettingsTab';
import { StorageData } from '../../../src/types/storage';

// Simple mock browser APIs
const mockBrowserAPI = {
  declarativeNetRequest: {
    getDynamicRules: jest.fn(),
    updateDynamicRules: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    },
  },
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    sendMessage: jest.fn(),
  },
};

// The component binds to the browser object from tests/setup.js when it is imported,
// so keep a handle on it before the globals below are replaced
const setupBrowser = (global as any).browser;

// Set up global browser/chrome
(global as any).chrome = mockBrowserAPI;
(global as any).browser = mockBrowserAPI;

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: mockConfirm,
});

describe('SettingsTab Component', () => {
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(false);
    
    mockBrowserAPI.declarativeNetRequest.getDynamicRules.mockImplementation((callback) => {
      callback([]);
    });
  });

  describe('Basic Rendering', () => {
    it('renders all main components', () => {
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      // Check for main elements
      expect(screen.getByLabelText(/Consider idle after/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Daily screen time goal/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Enable website blocking/)).toBeInTheDocument();
      expect(screen.getByText('Website Blocking')).toBeInTheDocument();
      expect(screen.getByText('Your data')).toBeInTheDocument();
      expect(screen.getByText('Support Argus')).toBeInTheDocument();
      expect(screen.getByText('Clear all data')).toBeInTheDocument();
    });

    it('displays current settings values', () => {
      const customData: StorageData = {
        ...defaultData,
        settings: {
          idleTime: 10,
          dailyLimit: 6,
          enableBlocking: true,
        },
      };

      render(<SettingsTab data={customData} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('6')).toBeInTheDocument();
      expect(screen.getByLabelText(/Enable website blocking/)).toBeChecked();
    });

    it('shows blocked sites when they exist', () => {
      const dataWithSites: StorageData = {
        ...defaultData,
        blockedSites: ['facebook.com', 'twitter.com'],
      };

      render(<SettingsTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      expect(screen.getByText('facebook.com')).toBeInTheDocument();
      expect(screen.getByText('twitter.com')).toBeInTheDocument();
    });
  });

  describe('Settings Updates', () => {
    it('updates idle time setting', () => {
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);

      const idleTimeInput = screen.getByLabelText(/Consider idle after/);
      fireEvent.change(idleTimeInput, { target: { value: '15' } });
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        settings: expect.objectContaining({ idleTime: 15 })
      });
    });

    it('updates daily limit setting', () => {
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);

      const dailyLimitInput = screen.getByLabelText(/Daily screen time goal/);
      fireEvent.change(dailyLimitInput, { target: { value: '4.5' } });
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        settings: expect.objectContaining({ dailyLimit: 4.5 })
      });
    });

    it('toggles blocking setting', async () => {
      const user = userEvent.setup();
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const blockingCheckbox = screen.getByLabelText(/Enable website blocking/);
      await user.click(blockingCheckbox);
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        settings: expect.objectContaining({ enableBlocking: true })
      });
    });
  });

  describe('Blocked Sites Management', () => {
    it('adds a new blocked site', async () => {
      const user = userEvent.setup();
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const input = screen.getByPlaceholderText('example.com');
      const addButton = screen.getByText('Add Site');
      
      await user.type(input, 'example.com');
      await user.click(addButton);
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        blockedSites: ['example.com']
      });
    });

    it('removes a blocked site', async () => {
      const user = userEvent.setup();
      const dataWithSites: StorageData = {
        ...defaultData,
        blockedSites: ['facebook.com', 'twitter.com'],
      };
      
      render(<SettingsTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      const removeButtons = screen.getAllByTitle('Remove site');
      await user.click(removeButtons[0]);
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        blockedSites: ['twitter.com']
      });
    });

    it('does not add empty or duplicate sites', async () => {
      const user = userEvent.setup();
      const dataWithSites: StorageData = {
        ...defaultData,
        blockedSites: ['example.com'],
      };
      
      render(<SettingsTab data={dataWithSites} updateStorage={mockUpdateStorage} />);
      
      const input = screen.getByPlaceholderText('example.com');
      const addButton = screen.getByText('Add Site');
      
      // Try to add empty site
      await user.click(addButton);
      expect(mockUpdateStorage).not.toHaveBeenCalled();
      
      // Try to add duplicate site
      await user.type(input, 'example.com');
      await user.click(addButton);
      expect(mockUpdateStorage).not.toHaveBeenCalled();
    });
  });

  describe('Data Management', () => {
    it('has export and clear buttons', () => {
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      // Check that the buttons exist and are clickable
      const exportButton = screen.getByText('Export backup');
      const clearButton = screen.getByText('Clear all data');
      
      expect(exportButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();
      expect(exportButton.tagName).toBe('BUTTON');
      expect(clearButton.tagName).toBe('BUTTON');
    });

    it('shows confirmation dialog for clear data', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);
      
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const clearButton = screen.getByText('Clear all data');
      await user.click(clearButton);
      
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to clear all data? This action cannot be undone.'
      );
    });

    it('Clear all data asks the background to clear, without writing anything from the popup', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      const local = setupBrowser.storage.local;
      local.clear.mockClear();
      local.set.mockClear();
      setupBrowser.runtime.sendMessage.mockClear();
      setupBrowser.runtime.sendMessage.mockResolvedValue({ success: true });

      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      await user.click(screen.getByText('Clear all data'));

      await waitFor(() =>
        expect(setupBrowser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'clearAllData' })
      );
      expect(local.clear).not.toHaveBeenCalled();
      expect(local.set).not.toHaveBeenCalled();
      expect(mockUpdateStorage).not.toHaveBeenCalled();
    });

    it('empties the block list on screen after a confirmed clear', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      setupBrowser.runtime.sendMessage.mockResolvedValue({ success: true });

      render(
        <SettingsTab data={{ ...defaultData, blockedSites: ['a.com', 'b.com'] }} updateStorage={mockUpdateStorage} />
      );
      expect(screen.getByText('a.com')).toBeInTheDocument();
      await user.click(screen.getByText('Clear all data'));

      expect(await screen.findByText('No blocked sites')).toBeInTheDocument();
      expect(screen.queryByText('a.com')).not.toBeInTheDocument();
    });

    it('does not clear data when user cancels confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);
      
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const clearButton = screen.getByText('Clear all data');
      await user.click(clearButton);
      
      expect(window.confirm).toHaveBeenCalled();
      // When user cancels, updateStorage should not be called for clearing data
      expect(mockUpdateStorage).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    it('has proper input constraints', () => {
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const idleTimeInput = screen.getByLabelText(/Consider idle after/);
      const dailyLimitInput = screen.getByLabelText(/Daily screen time goal/);
      
      expect(idleTimeInput).toHaveAttribute('min', '1');
      expect(idleTimeInput).toHaveAttribute('max', '60');
      expect(dailyLimitInput).toHaveAttribute('min', '0');
      expect(dailyLimitInput).toHaveAttribute('max', '24');
      expect(dailyLimitInput).toHaveAttribute('step', '0.5');
    });
  });

  describe('User Experience', () => {
    it('allows adding sites with Enter key', async () => {
      const user = userEvent.setup();
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const input = screen.getByPlaceholderText('example.com');
      
      await user.type(input, 'example.com');
      await user.keyboard('{Enter}');
      
      expect(mockUpdateStorage).toHaveBeenCalledWith({
        blockedSites: ['example.com']
      });
    });

    it('clears input after adding a site', async () => {
      const user = userEvent.setup();
      render(<SettingsTab data={defaultData} updateStorage={mockUpdateStorage} />);
      
      const input = screen.getByPlaceholderText('example.com');
      const addButton = screen.getByText('Add Site');
      
      await user.type(input, 'example.com');
      await user.click(addButton);
      
      expect(input).toHaveValue('');
    });
  });

  describe('Unlimited blocking', () => {
    it('adds a fourth and fifth blocked site with no limit message', async () => {
      const user = userEvent.setup();
      let data: StorageData = { ...defaultData, blockedSites: [] };
      const updateStorage = jest.fn((updates: Partial<StorageData>) => {
        data = { ...data, ...updates };
      });
      const { rerender } = render(<SettingsTab data={data} updateStorage={updateStorage} />);

      for (const site of ['a.com', 'b.com', 'c.com', 'd.com', 'e.com']) {
        const input = screen.getByPlaceholderText('example.com');
        expect(input).toBeEnabled();
        await user.type(input, site);
        await user.click(screen.getByText('Add Site'));
        rerender(<SettingsTab data={data} updateStorage={updateStorage} />);
      }

      ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'].forEach(site => {
        expect(screen.getByText(site)).toBeInTheDocument();
      });
      expect(screen.getByPlaceholderText('example.com')).toBeEnabled();
      expect(screen.getByText('Add Site')).toBeEnabled();
      expect(screen.queryByText(/of 3|Premium/)).not.toBeInTheDocument();
    });
  });
});

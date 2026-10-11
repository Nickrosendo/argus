import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryTab from '../../src/components/tabs/HistoryTab';
import FocusTab from '../../src/components/tabs/FocusTab';
import UpgradePrompt from '../../src/components/ui/UpgradePrompt';
import WelcomeCard from '../../src/components/ui/WelcomeCard';
import { PLANS, PREMIUM_FEATURES, PRICE_SUMMARY } from '../../src/lib/plans';
import { StorageData } from '../../src/types/storage';

// The components capture the browser API from tests/setup.js at import time
const browserMock = (global as any).browser;

const dayString = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toDateString();
};

const baseData = (overrides: Partial<StorageData> = {}): StorageData =>
  ({
    sites: {},
    totalTime: 0,
    history: {},
    settings: { idleTime: 5, dailyLimit: 8, showNotifications: true, enableBlocking: false },
    blockedSites: [],
    freeMode: true,
    ...overrides,
  }) as StorageData;

const historyOf = (days: number) => {
  const history: any = {};
  for (let i = 1; i <= days; i++) {
    history[dayString(i)] = { totalTime: 3600000, sites: { 'a.com': { totalTime: 3600000 } }, date: dayString(i) };
  }
  return history;
};

describe('plans', () => {
  it('should quote one price everywhere', () => {
    expect(PRICE_SUMMARY).toBe('$4.99/month or $49.99/year');
    expect(PLANS.map((plan) => plan.price)).toEqual(['$4.99', '$49.99']);
  });

  it('should only promise features that exist', () => {
    const claims = PLANS.reduce((all: string[], plan) => all.concat(plan.features), PREMIUM_FEATURES).join(' ');

    expect(claims).not.toMatch(/advertis|priority support|export|custom dashboard/i);
  });

  it('should describe the yearly saving accurately', () => {
    // Twelve months at the monthly price against the yearly price
    const monthsPaidFor = 49.99 / 4.99;

    expect(Math.round(12 - monthsPaidFor)).toBe(2);
    expect(PLANS[1].features).toContain('2 months free compared with paying monthly');
  });
});

describe('UpgradePrompt', () => {
  it('should explain the feature, list real benefits and state the price', () => {
    const onUpgrade = jest.fn();
    render(<UpgradePrompt featureName="Focus" description="Blocks your list for a set time." onUpgrade={onUpgrade} />);

    expect(screen.getByText('Focus is part of Premium')).toBeInTheDocument();
    PREMIUM_FEATURES.forEach((feature) => expect(screen.getByText(feature)).toBeInTheDocument());
    expect(screen.getByText(/\$4\.99\/month or \$49\.99\/year/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Upgrade to Premium/ }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});

describe('WelcomeCard', () => {
  it('should say where the data is kept and offer the two actions', () => {
    const onDismiss = jest.fn();
    const onOpenSettings = jest.fn();
    render(<WelcomeCard onDismiss={onDismiss} onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/Your data stays on this device/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Got it'));
    fireEvent.click(screen.getByText('Open Settings'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryTab for a free account', () => {
  it('should show past days and where the free history ends', () => {
    const onUpgrade = jest.fn();
    render(<HistoryTab data={baseData({ history: historyOf(3) })} isFreeMode={true} onUpgrade={onUpgrade} />);

    expect(screen.getByText(/for the last 7 days/)).toBeInTheDocument();
    expect(screen.getAllByText(/1h 0m · 1 site/)).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Keep 30 days with Premium/ }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('should show at most 7 days', () => {
    render(<HistoryTab data={baseData({ history: historyOf(12) })} isFreeMode={true} onUpgrade={jest.fn()} />);

    expect(screen.getAllByText(/1h 0m · 1 site/)).toHaveLength(7);
  });

  it('should not show the upgrade row to a premium account', () => {
    render(<HistoryTab data={baseData({ history: historyOf(12), freeMode: false })} isFreeMode={false} onUpgrade={jest.fn()} />);

    expect(screen.getAllByText(/1h 0m · 1 site/)).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /Premium/ })).not.toBeInTheDocument();
  });
});

describe('FocusTab', () => {
  beforeEach(() => {
    browserMock.runtime.sendMessage.mockReset();
    browserMock.runtime.sendMessage.mockResolvedValue({ success: true });
  });

  it('should say what will be blocked and start a session of the chosen length', async () => {
    render(<FocusTab data={baseData({ blockedSites: ['a.com', 'b.com'] })} />);

    expect(screen.getByText(/blocks the 2 sites on your block list/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('50m'));
    fireEvent.click(screen.getByRole('button', { name: /Start 50-minute session/ }));

    await waitFor(() => {
      expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ action: 'startFocusSession', minutes: 50 });
    });
  });

  it('should warn when the block list is empty and link to Settings', () => {
    const onOpenSettings = jest.fn();
    render(<FocusTab data={baseData()} onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/Your block list is empty, so nothing would be blocked/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add sites to block in Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('should show a running session from storage and let the user end it', async () => {
    const focusSession = { startedAt: Date.now() - 5 * 60000, endsAt: Date.now() + 20 * 60000, minutes: 25 };
    render(<FocusTab data={baseData({ blockedSites: ['a.com'], focusSession })} />);

    expect(screen.getByText('Session in progress')).toBeInTheDocument();
    expect(screen.getByText(/You can close this popup/)).toBeInTheDocument();
    expect(screen.queryByText(/Start .* session/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /End session early/ }));

    await waitFor(() => {
      expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ action: 'stopFocusSession' });
    });
  });

  it('should show the reason when the background refuses to start', async () => {
    browserMock.runtime.sendMessage.mockResolvedValue({ success: false, error: 'Focus sessions are part of Premium' });
    render(<FocusTab data={baseData({ blockedSites: ['a.com'] })} />);

    fireEvent.click(screen.getByRole('button', { name: /Start 25-minute session/ }));

    expect(await screen.findByText('Focus sessions are part of Premium')).toBeInTheDocument();
  });

  it('should show recorded numbers for today and no percentage before any session finished', () => {
    const today = new Date().toDateString();
    const { rerender } = render(<FocusTab data={baseData()} />);
    expect(screen.getByText('—')).toBeInTheDocument();

    rerender(
      <FocusTab data={baseData({ focusStats: { date: today, started: 4, completed: 3, focusTime: 90 * 60000, blocked: 6 } })} />
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});

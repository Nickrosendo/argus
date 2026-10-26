import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataSection from '../../../src/components/settings/DataSection';
import { backupFileName } from '../../../services/backupUtils.js';

// The component binds to the setup browser object at import time
const browserAPI = (global as any).browser;

const backupFile = (body: unknown, name = 'backup.json') => {
  const file = new File([typeof body === 'string' ? body : JSON.stringify(body)], name, { type: 'application/json' });
  // jsdom may not implement File.text()
  if (typeof (file as any).text !== 'function') {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    (file as any).text = () => Promise.resolve(text);
  }
  return file;
};

const validBackup = {
  argusBackup: 1,
  exportedAt: '2026-10-12T10:00:00.000Z',
  data: {
    history: {
      '2026-10-10': { totalTime: 1000, sites: {}, hourly: [] },
      '2026-10-11': { totalTime: 2000, sites: {}, hourly: [] },
    },
    blockedSites: ['a.com'],
  },
};

describe('DataSection', () => {
  let createdBlobs: any[];
  let clickedLinks: HTMLAnchorElement[];

  beforeEach(() => {
    jest.clearAllMocks();
    createdBlobs = [];
    clickedLinks = [];
    (URL as any).createObjectURL = jest.fn(() => 'blob:mock');
    (URL as any).revokeObjectURL = jest.fn();
    jest.spyOn(global, 'Blob').mockImplementation(((parts: any[]) => {
      createdBlobs.push(parts.join(''));
      return {} as Blob;
    }) as any);
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedLinks.push(this);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the heading, line and buttons', () => {
    render(<DataSection />);
    expect(screen.getByText('Your data')).toBeInTheDocument();
    expect(screen.getByText(/Everything Argus records stays in this browser\. Export a backup now and then/)).toBeInTheDocument();
    ['Export backup', 'Restore from backup', 'Clear all data'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
  });

  it('exports a backup file without the auth token', async () => {
    browserAPI.storage.local.get.mockImplementation((_keys: any, cb: (d: any) => void) =>
      cb({ history: {}, sites: {}, blockedSites: ['a.com'], authToken: 'secret' })
    );
    render(<DataSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));

    expect(browserAPI.storage.local.get).toHaveBeenCalledWith(null, expect.any(Function));
    expect(clickedLinks).toHaveLength(1);
    expect(clickedLinks[0].download).toBe(backupFileName());
    const json = JSON.parse(createdBlobs[0]);
    expect(json.argusBackup).toBe(1);
    expect(json.data.blockedSites).toEqual(['a.com']);
    expect(createdBlobs[0]).not.toContain('authToken');
  });

  it('asks for confirmation before restoring and sends nothing until Restore', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByLabelText('Backup file'), backupFile(validBackup));

    const date = new Date(validBackup.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    expect(await screen.findByText(`Backup from ${date}, 2 days of history, 1 blocked site`)).toBeInTheDocument();
    expect(screen.getByText('Days in both places keep whichever has more time recorded. Settings and the block list are replaced.')).toBeInTheDocument();
    expect(browserAPI.runtime.sendMessage).not.toHaveBeenCalled();

    browserAPI.runtime.sendMessage.mockResolvedValueOnce({ success: true });
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(screen.getByText('Backup restored.')).toBeInTheDocument());
    expect(browserAPI.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'restoreBackup',
      data: validBackup.data,
    });
  });

  it('describes a raw dump without an export date', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(
      screen.getByLabelText('Backup file'),
      backupFile({ history: { '2026-10-10': { totalTime: 5, sites: {} } }, blockedSites: ['a.com', 'b.com'] })
    );
    expect(await screen.findByText('Backup with 1 day of history, 2 blocked sites')).toBeInTheDocument();
  });

  it('shows the reason for a failed restore', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByLabelText('Backup file'), backupFile(validBackup));
    browserAPI.runtime.sendMessage.mockResolvedValueOnce({ success: false, error: 'boom' });
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Could not restore the backup: boom')).toBeInTheDocument();
  });

  it('rejects a file that is not a backup and sends nothing', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByLabelText('Backup file'), backupFile('not json'));
    expect(await screen.findByText("This file isn't an Argus backup.")).toBeInTheDocument();
    expect(browserAPI.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('hides the confirmation on Cancel without sending', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByLabelText('Backup file'), backupFile(validBackup));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(browserAPI.runtime.sendMessage).not.toHaveBeenCalled();
  });

  describe('Restore from backup button', () => {
    const originalBrowser = (global as any).browser;
    let clickedInputs: number;

    beforeEach(() => {
      clickedInputs = 0;
      jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
        clickedInputs += 1;
      });
      browserAPI.tabs.create = jest.fn();
      browserAPI.runtime.getURL = jest.fn((path: string) => `moz-extension://test/${path}`);
      window.history.replaceState({}, '', '/');
    });

    afterEach(() => {
      (global as any).browser = originalBrowser;
      window.history.replaceState({}, '', '/');
    });

    it('in the Firefox popup opens the settings in a tab, because the popup closes with the file dialog', async () => {
      render(<DataSection />);
      await userEvent.click(screen.getByRole('button', { name: 'Restore from backup' }));

      expect(browserAPI.tabs.create).toHaveBeenCalledWith({ url: 'moz-extension://test/popup.html?tab=1#settings' });
      expect(clickedInputs).toBe(0);
    });

    it('in a full Firefox tab opens the file picker', async () => {
      window.history.replaceState({}, '', '/popup.html?tab=1');
      render(<DataSection />);
      await userEvent.click(screen.getByRole('button', { name: 'Restore from backup' }));

      expect(browserAPI.tabs.create).not.toHaveBeenCalled();
      expect(clickedInputs).toBe(1);
    });

    it('in Chrome opens the file picker', async () => {
      render(<DataSection />);
      delete (global as any).browser;
      await userEvent.click(screen.getByRole('button', { name: 'Restore from backup' }));

      expect(browserAPI.tabs.create).not.toHaveBeenCalled();
      expect(clickedInputs).toBe(1);
    });
  });
});

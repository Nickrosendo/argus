import React, { useRef, useState } from 'react';
import {
  createBackup,
  backupFileName,
  parseBackup,
  summarizeBackup,
} from '../../../services/backupUtils.js';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

interface DataSectionProps {
  // Called after everything has been cleared, so the tab can reset what it shows
  onCleared?: () => void;
}

interface PendingRestore {
  data: any;
  exportedAt: string | null;
  days: number;
  blockedSites: number;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const describeBackup = (pending: PendingRestore): string => {
  const counts = `${plural(pending.days, 'day', 'days')} of history, ${plural(pending.blockedSites, 'blocked site', 'blocked sites')}`;
  const exported = pending.exportedAt ? new Date(pending.exportedAt) : null;
  if (exported && !Number.isNaN(exported.getTime())) {
    const date = exported.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `Backup from ${date}, ${counts}`;
  }
  return `Backup with ${counts}`;
};

const DataSection: React.FC<DataSectionProps> = ({ onCleared }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleExportData = (): void => {
    browserAPI.storage.local.get(null, (allData: any) => {
      const backup = createBackup(allData || {});
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      link.click();

      URL.revokeObjectURL(url);
    });
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    setMessage('');
    setPending(null);
    try {
      const result = parseBackup(await file.text());
      if (result.ok) {
        setPending({
          data: result.data,
          exportedAt: result.exportedAt,
          ...summarizeBackup(result.data),
        });
      } else {
        setMessage(result.reason);
      }
    } catch (error) {
      setMessage("This file isn't an Argus backup.");
    }
    // Allow picking the same file again
    input.value = '';
  };

  const handleRestore = async (): Promise<void> => {
    if (!pending) return;
    const { data } = pending;
    setPending(null);
    try {
      const response = await browserAPI.runtime.sendMessage({ action: 'restoreBackup', data });
      if (response && response.success) {
        setMessage('Backup restored.');
      } else {
        setMessage(`Could not restore the backup: ${response?.error || 'unknown error'}`);
      }
    } catch (error: any) {
      setMessage(`Could not restore the backup: ${error?.message || 'unknown error'}`);
    }
  };

  // Firefox closes the toolbar popup when a file dialog opens, so the file
  // would never be read. There, pick the file from a full tab instead.
  const handleRestoreClick = (): void => {
    const isFirefox = typeof browser !== 'undefined';
    const inFullTab = new URLSearchParams(window.location.search).get('tab') === '1';
    if (isFirefox && !inFullTab) {
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL('popup.html?tab=1#settings') });
      return;
    }
    fileInput.current?.click();
  };

  const handleClearData = (): void => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      browserAPI.storage.local.clear(() => {
        setPending(null);
        setMessage('');
        if (onCleared) onCleared();
      });
    }
  };

  return (
    <div className="setting-section">
      <h3>Your data</h3>
      <p className="setting-note">
        Everything Argus records stays in this browser. Export a backup now and then, so you can restore it if you reinstall or switch computers.
      </p>
      <div className="data-actions">
        <button onClick={handleExportData} className="secondary-btn">Export backup</button>
        <button onClick={handleRestoreClick} className="secondary-btn">Restore from backup</button>
        <button onClick={handleClearData} className="warning-btn">Clear all data</button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Backup file"
        className="visually-hidden"
        onChange={handleFilePicked}
      />

      {pending && (
        <div className="restore-confirm" role="group" aria-label="Confirm restore">
          <p>{describeBackup(pending)}</p>
          <div className="data-actions">
            <button onClick={handleRestore} className="primary-btn">Restore</button>
            <button onClick={() => setPending(null)} className="secondary-btn">Cancel</button>
          </div>
          <p className="setting-note">
            Days in both places keep whichever has more time recorded. Settings and the block list are replaced.
          </p>
        </div>
      )}

      {message && <p className="restore-message" role="status">{message}</p>}
    </div>
  );
};

export default DataSection;

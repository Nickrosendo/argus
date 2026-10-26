import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryTab from '../../../src/components/tabs/HistoryTab';

const daysOfHistory = (count: number) => {
  const history: Record<string, any> = {};
  for (let i = 1; i <= count; i++) {
    const date = new Date(2026, 8, 1);
    date.setDate(date.getDate() + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    history[key] = { totalTime: 60000 * i, sites: { 'a.com': { time: 1, visits: 1 } }, hourly: [] };
  }
  return history;
};

describe('HistoryTab past days', () => {
  it('shows the latest 14 days, then all of them with Show all', async () => {
    const { container } = render(<HistoryTab data={{ history: daysOfHistory(30) } as any} />);
    const rows = () => container.querySelectorAll('.productivity-slot').length;

    expect(rows()).toBe(14);
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(rows()).toBe(30);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(rows()).toBe(14);
  });

  it('has no Show all button for 14 days or fewer', () => {
    render(<HistoryTab data={{ history: daysOfHistory(10) } as any} />);
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });
});

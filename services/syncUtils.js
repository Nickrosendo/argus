/**
 * Pure helpers for cloud sync, kept free of browser APIs so they can be unit tested.
 *
 * Locally, days are keyed by Date#toDateString() ("Mon Jul 21 2025"). The API
 * uses ISO local dates ("2025-07-21"), which sort chronologically.
 */

const pad = (value) => String(value).padStart(2, '0');

/**
 * @param {string|Date} date A Date or a Date#toDateString() value
 * @returns {string} The local calendar date as YYYY-MM-DD
 */
export function toIsoDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/**
 * @param {string} isoDate A local calendar date as YYYY-MM-DD
 * @returns {string} The same day as a Date#toDateString() value
 */
export function fromIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toDateString();
}

// The fields of a day that are uploaded; time per hour only when recorded
function toUploadDay(day) {
  // Page titles can be revealing (a document name, an email subject) and no
  // other device needs them, so they stay on this device
  const sites = {};
  Object.keys(day.sites || {}).forEach((domain) => {
    const { title, ...site } = day.sites[domain] || {};
    sites[domain] = site;
  });

  const upload = { sites, totalTime: day.totalTime || 0 };
  if (Array.isArray(day.hourly) && day.hourly.length > 0) {
    upload.hourly = day.hourly;
  }
  return upload;
}

/**
 * Choose the days to upload in one sync: always the current day, plus the most
 * recent finished days that have not been uploaded yet.
 *
 * @param {Object} input
 * @param {Object} input.sites Today's sites
 * @param {number} input.totalTime Today's total time
 * @param {number[]} [input.hourly] Today's time per hour of day
 * @param {string} input.currentDate Date#toDateString() of the day `sites` belongs to
 * @param {Object} input.history Finished days keyed by Date#toDateString()
 * @param {string[]} input.syncedDays ISO dates of finished days already uploaded
 * @param {number} [input.maxHistoryDays] Most finished days to include per sync
 * @returns {{days: Object, historyDates: string[]}} Days keyed by ISO date, and
 *   the ISO dates of the finished days included
 */
export function buildUploadDays({
  sites,
  totalTime,
  hourly,
  currentDate,
  history,
  syncedDays,
  maxHistoryDays = 6,
}) {
  const alreadySynced = new Set(syncedDays || []);
  const today = toIsoDate(currentDate);
  const days = {
    [today]: toUploadDay({ sites, totalTime, hourly }),
  };

  const historyDates = Object.keys(history || {})
    .map((dateString) => ({ dateString, iso: toIsoDate(dateString) }))
    .filter(({ iso }) => iso !== today && !alreadySynced.has(iso))
    .sort((a, b) => (a.iso < b.iso ? 1 : -1))
    .slice(0, maxHistoryDays);

  historyDates.forEach(({ dateString, iso }) => {
    days[iso] = toUploadDay(history[dateString] || {});
  });

  return { days, historyDates: historyDates.map(({ iso }) => iso) };
}

/**
 * The list of finished days known to be uploaded, limited to days that still
 * exist locally so it cannot grow without bound.
 *
 * @param {string[]} syncedDays Previously uploaded ISO dates
 * @param {string[]} uploaded ISO dates uploaded just now
 * @param {Object} history Finished days keyed by Date#toDateString()
 * @returns {string[]}
 */
export function updateSyncedDays(syncedDays, uploaded, history) {
  const existing = new Set(Object.keys(history || {}).map(toIsoDate));
  return [...new Set([...(syncedDays || []), ...uploaded])]
    .filter((iso) => existing.has(iso))
    .sort();
}

/**
 * Convert days received from the API to the local key format.
 *
 * @param {Object} days Days keyed by ISO date
 * @returns {Object} The same days keyed by Date#toDateString()
 */
export function toLocalDays(days) {
  const local = {};
  Object.entries(days || {}).forEach(([isoDate, day]) => {
    const dateString = fromIsoDate(isoDate);
    local[dateString] = { ...day, date: dateString };
  });
  return local;
}

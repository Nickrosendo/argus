import { SiteData } from '../types/storage';

export type CategoryName = 'Work' | 'Social' | 'Entertainment' | 'News' | 'Shopping' | 'Other';

export interface Category {
  name: CategoryName;
  color: string; // hex, for charts and dots
  badgeClass: string; // background class for badges
}

export interface CategoryTotal extends Category {
  time: number;
  percentage: number;
}

const CATEGORIES: { [name in CategoryName]: Category } = {
  Work: { name: 'Work', color: '#10b981', badgeClass: 'bg-purple-500' },
  Social: { name: 'Social', color: '#ef4444', badgeClass: 'bg-pink-500' },
  Entertainment: { name: 'Entertainment', color: '#f97316', badgeClass: 'bg-orange-500' },
  News: { name: 'News', color: '#eab308', badgeClass: 'bg-blue-500' },
  Shopping: { name: 'Shopping', color: '#14b8a6', badgeClass: 'bg-teal-500' },
  Other: { name: 'Other', color: '#6366f1', badgeClass: 'bg-indigo-500' },
};

// Sites are matched on the whole domain or a parent domain, never on a
// substring: "networkworld.com" is not "work" and "gamestop.com" is not a game.
const CATEGORY_DOMAINS: { [name in Exclude<CategoryName, 'Other'>]: string[] } = {
  Work: [
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
    'notion.so', 'slack.com', 'zoom.us', 'teams.microsoft.com', 'office.com', 'outlook.com',
    'atlassian.net', 'atlassian.com', 'trello.com', 'asana.com', 'linear.app', 'figma.com', 'miro.com',
    'docs.google.com', 'drive.google.com', 'mail.google.com', 'calendar.google.com', 'meet.google.com',
    'developer.mozilla.org', 'npmjs.com', 'vercel.com', 'aws.amazon.com', 'console.cloud.google.com',
    'claude.ai', 'chatgpt.com',
  ],
  Social: [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'reddit.com',
    'tiktok.com', 'snapchat.com', 'whatsapp.com', 'telegram.org', 'discord.com', 'threads.net',
    'pinterest.com', 'tumblr.com', 'mastodon.social', 'bsky.app',
  ],
  Entertainment: [
    'youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'hulu.com', 'disneyplus.com',
    'primevideo.com', 'max.com', 'hbomax.com', 'crunchyroll.com', 'soundcloud.com', 'vimeo.com',
    'imdb.com', 'steampowered.com', 'epicgames.com', '9gag.com',
  ],
  News: [
    'cnn.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com', 'reuters.com',
    'washingtonpost.com', 'bloomberg.com', 'wsj.com', 'apnews.com', 'news.google.com',
    'news.ycombinator.com', 'wikipedia.org', 'medium.com', 'substack.com', 'techcrunch.com',
    'theverge.com', 'g1.globo.com', 'uol.com.br', 'folha.uol.com.br',
  ],
  Shopping: [
    'amazon.com', 'amazon.com.br', 'amazon.co.uk', 'ebay.com', 'etsy.com', 'aliexpress.com',
    'walmart.com', 'target.com', 'bestbuy.com', 'shopee.com.br', 'mercadolivre.com.br',
    'magazineluiza.com.br', 'shein.com', 'temu.com',
  ],
};

// Checked in this order, so a specific entry such as "aws.amazon.com" (Work)
// wins over its parent "amazon.com" (Shopping)
const CATEGORY_ORDER: Exclude<CategoryName, 'Other'>[] = ['Work', 'Social', 'Entertainment', 'News', 'Shopping'];

function matches(domain: string, entry: string): boolean {
  return domain === entry || domain.slice(-(entry.length + 1)) === `.${entry}`;
}

/**
 * The category of a site. Unknown sites are "Other": the app does not guess.
 */
export function categorize(domain: string): Category {
  const normalized = String(domain || '').toLowerCase().replace(/^www\./, '');

  // Prefer the longest matching entry across all categories
  let best: { name: CategoryName; length: number } | null = null;
  for (let c = 0; c < CATEGORY_ORDER.length; c++) {
    const name = CATEGORY_ORDER[c];
    const entries = CATEGORY_DOMAINS[name];
    for (let i = 0; i < entries.length; i++) {
      if (matches(normalized, entries[i]) && (!best || entries[i].length > best.length)) {
        best = { name, length: entries[i].length };
      }
    }
  }

  return CATEGORIES[best ? best.name : 'Other'];
}

/**
 * Time per category for a set of sites, largest first.
 */
export function getCategoryBreakdown(sites: SiteData = {}): CategoryTotal[] {
  const totals: { [name: string]: number } = {};
  let total = 0;

  Object.keys(sites).forEach((domain) => {
    const time = (sites[domain] && sites[domain].totalTime) || 0;
    const name = categorize(domain).name;
    totals[name] = (totals[name] || 0) + time;
    total += time;
  });

  return Object.keys(totals)
    .map((name) => ({
      ...CATEGORIES[name as CategoryName],
      time: totals[name],
      percentage: total > 0 ? (totals[name] / total) * 100 : 0,
    }))
    .sort((a, b) => b.time - a.time);
}

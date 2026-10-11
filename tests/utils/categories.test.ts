import { categorize, getCategoryBreakdown } from '../../src/utils/categories';

describe('categories', () => {
  describe('categorize', () => {
    it('should match a known site and its subdomains', () => {
      expect(categorize('github.com').name).toBe('Work');
      expect(categorize('gist.github.com').name).toBe('Work');
      expect(categorize('www.youtube.com').name).toBe('Entertainment');
      expect(categorize('x.com').name).toBe('Social');
      expect(categorize('old.reddit.com').name).toBe('Social');
    });

    it('should not match on substrings of unrelated domains', () => {
      expect(categorize('networkworld.com').name).toBe('Other');
      expect(categorize('devtools-news.io').name).toBe('Other');
      expect(categorize('gamestop.com').name).toBe('Other');
      expect(categorize('notgithub.com').name).toBe('Other');
      expect(categorize('ax.com').name).toBe('Other');
    });

    it('should prefer the most specific entry', () => {
      expect(categorize('amazon.com').name).toBe('Shopping');
      expect(categorize('aws.amazon.com').name).toBe('Work');
      expect(categorize('google.com').name).toBe('Other');
      expect(categorize('docs.google.com').name).toBe('Work');
      expect(categorize('news.google.com').name).toBe('News');
    });

    it('should call unknown sites Other rather than guess', () => {
      expect(categorize('my-company-intranet.example').name).toBe('Other');
      expect(categorize('').name).toBe('Other');
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should total time per category, largest first, with percentages', () => {
      const sites: any = {
        'github.com': { totalTime: 6000 },
        'docs.google.com': { totalTime: 1500 },
        'youtube.com': { totalTime: 2500 },
      };

      const breakdown = getCategoryBreakdown(sites);

      expect(breakdown.map((c) => [c.name, c.time, c.percentage])).toEqual([
        ['Work', 7500, 75],
        ['Entertainment', 2500, 25],
      ]);
    });

    it('should return an empty list for no sites', () => {
      expect(getCategoryBreakdown({})).toEqual([]);
    });
  });
});

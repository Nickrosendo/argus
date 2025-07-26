import { cn } from '../../src/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toBe('text-red-500 bg-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('text-red-500', true && 'bg-blue-500', false && 'hidden');
      expect(result).toBe('text-red-500 bg-blue-500');
    });

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle undefined and null values', () => {
      const result = cn('text-red-500', undefined, null, 'bg-blue-500');
      expect(result).toBe('text-red-500 bg-blue-500');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['text-red-500', 'bg-blue-500'], 'p-4');
      expect(result).toBe('text-red-500 bg-blue-500 p-4');
    });

    it('should handle object notation', () => {
      const result = cn({
        'text-red-500': true,
        'bg-blue-500': false,
        'p-4': true
      });
      expect(result).toBe('text-red-500 p-4');
    });

    it('should merge complex conflicting classes', () => {
      const result = cn('p-2 m-2', 'p-4 text-center');
      expect(result).toBe('m-2 p-4 text-center');
    });
  });
});
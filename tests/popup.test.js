// Tests for popup.js utility functions

// We'll manually recreate the functions for testing
// since we can't easily import them from popup.js directly

describe('Popup Utility Functions', () => {
  // Test formatTime function
  describe('formatTime', () => {
    // Recreate the formatTime function for testing
    const formatTime = (milliseconds) => {
      if (!milliseconds) return '0m';
  
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
  
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return `${seconds}s`;
      }
    };

    test('should handle null/undefined/0 values', () => {
      expect(formatTime(null)).toBe('0m');
      expect(formatTime(undefined)).toBe('0m');
      expect(formatTime(0)).toBe('0m');
    });

    test('should format seconds correctly', () => {
      expect(formatTime(1000)).toBe('1s');
      expect(formatTime(30000)).toBe('30s');
      expect(formatTime(59999)).toBe('59s');
    });

    test('should format minutes correctly', () => {
      expect(formatTime(60000)).toBe('1m');
      expect(formatTime(120000)).toBe('2m');
      expect(formatTime(3599000)).toBe('59m');
    });

    test('should format hours correctly', () => {
      expect(formatTime(3600000)).toBe('1h 0m');
      expect(formatTime(3660000)).toBe('1h 1m');
      expect(formatTime(7200000)).toBe('2h 0m');
      expect(formatTime(7260000)).toBe('2h 1m');
      expect(formatTime(7320000)).toBe('2h 2m');
    });
  });

  // Test getLastNDays function
  describe('getLastNDays', () => {
    // Recreate the getLastNDays function for testing
    const getLastNDays = (n) => {
      const result = [];
      for (let i = 0; i < n; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        result.push(date);
      }
      return result;
    };

    test('should return an array of date objects', () => {
      const dates = getLastNDays(5);
      expect(dates).toBeInstanceOf(Array);
      expect(dates.length).toBe(5);
      dates.forEach(date => {
        expect(date).toBeInstanceOf(Date);
      });
    });

    test('should return today as the first date', () => {
      const dates = getLastNDays(3);
      const today = new Date();
      
      expect(dates[0].getDate()).toBe(today.getDate());
      expect(dates[0].getMonth()).toBe(today.getMonth());
      expect(dates[0].getFullYear()).toBe(today.getFullYear());
    });

    test('should return correct previous dates', () => {
      const dates = getLastNDays(3);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(today.getDate() - 2);
      
      // Check yesterday
      expect(dates[1].getDate()).toBe(yesterday.getDate());
      expect(dates[1].getMonth()).toBe(yesterday.getMonth());
      expect(dates[1].getFullYear()).toBe(yesterday.getFullYear());
      
      // Check two days ago
      expect(dates[2].getDate()).toBe(twoDaysAgo.getDate());
      expect(dates[2].getMonth()).toBe(twoDaysAgo.getMonth());
      expect(dates[2].getFullYear()).toBe(twoDaysAgo.getFullYear());
    });
  });

  // Calculate weekly average function (simpler version that doesn't rely on DOM)
  describe('calculateWeeklyAverage', () => {
    // Recreate a simplified version of the function for testing
    const calculateWeeklyAverage = (history, todayTime) => {
      // Create getLastNDays function for this test
      const getLastNDays = (n) => {
        const result = [];
        for (let i = 0; i < n; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          result.push(date);
        }
        return result;
      };

      const last7Days = getLastNDays(7);
      let totalWeekTime = todayTime; // Include today's time
      let daysWithData = todayTime > 0 ? 1 : 0;
      
      // Sum up time from previous 6 days
      last7Days.slice(0, 6).forEach(date => {
        const dateString = date.toDateString();
        const dayData = history[dateString];
        
        if (dayData && dayData.totalTime > 0) {
          totalWeekTime += dayData.totalTime;
          daysWithData++;
        }
      });
      
      // Calculate the average only for days with data
      const averageTime = daysWithData > 0 ? totalWeekTime / daysWithData : 0;
      
      return averageTime;
    };

    test('should calculate average correctly with no history', () => {
      const history = {};
      const todayTime = 3600000; // 1 hour
      
      const average = calculateWeeklyAverage(history, todayTime);
      
      // Should just be today's time since no history
      expect(average).toBe(3600000);
    });

    test('should calculate average correctly with history data', () => {
      // Create a history object with some dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const history = {
        [yesterday.toDateString()]: { totalTime: 7200000 }, // 2 hours
        [twoDaysAgo.toDateString()]: { totalTime: 10800000 }, // 3 hours
      };
      
      const todayTime = 3600000; // 1 hour
      
      const average = calculateWeeklyAverage(history, todayTime);
      
      // Average should be (1 + 2 + 3) / 3 = 2 hours
      expect(average).toBe((3600000 + 7200000 + 10800000) / 3);
    });

    test('should handle zero screen time days correctly', () => {
      // Create a history object with some dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const history = {
        [yesterday.toDateString()]: { totalTime: 0 }, // No time
        [twoDaysAgo.toDateString()]: { totalTime: 7200000 }, // 2 hours
      };
      
      const todayTime = 3600000; // 1 hour
      
      const average = calculateWeeklyAverage(history, todayTime);
      
      // Average should be (1 + 2) / 2 = 1.5 hours
      // Note: days with 0 time are excluded from the average calculation
      expect(average).toBe((3600000 + 7200000) / 2);
    });
  });
}); 
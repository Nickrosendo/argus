// Simple test to verify Jest setup
describe('Basic Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to browser mocks', () => {
    expect(global.chrome).toBeDefined();
    expect(global.chrome.storage).toBeDefined();
    expect(global.chrome.storage.local).toBeDefined();
  });

  it('should have localStorage mock', () => {
    expect(global.localStorage).toBeDefined();
    global.localStorage.setItem('test', 'value');
    expect(global.localStorage.getItem('test')).toBe('value');
  });
}); 
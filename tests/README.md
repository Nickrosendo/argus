# Argus Extension Testing

This directory contains unit tests for the Argus browser extension.

## Test Structure

The tests are organized as follows:

- `setup.js`: Contains mocks for browser APIs, storage, and DOM functions
- `background.test.js`: Tests for the background script functionality
- `popup.test.js`: Tests for popup UI utility functions
- `storage.test.js`: Tests for browser storage interactions

## Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode (automatically re-runs when files change):

```bash
npm run test:watch
```

To generate a coverage report:

```bash
npm run test:coverage
```

## Test Coverage

The tests cover several key areas of functionality:

1. **Background script functions**:
   - Tab tracking and handling
   - Time calculation
   - Storage updates

2. **Popup utility functions**:
   - Time formatting
   - Date handling
   - Weekly average calculations

3. **Browser storage**:
   - Storing and retrieving data
   - Browser API compatibility

## Testing Approach

Since browser extensions operate in a specialized environment that's difficult to replicate in a test environment, we've adopted a pragmatic approach:

1. **Function Recreation**: Rather than trying to import functions from the extension files directly (which can be problematic due to browser APIs), we recreate key functions in the test files.

2. **API Mocking**: We mock all browser APIs to simulate the browser environment.

3. **Behavioral Testing**: We focus on testing the behavior of functions rather than implementation details.

## Adding New Tests

To add new tests:

1. Identify the functionality you want to test
2. Create a test file or add to an existing one
3. Recreate the function if necessary (or improve our import approach)
4. Write test cases that cover normal usage and edge cases

### Testing Tips

- Use `beforeEach()` to reset mocks and state between tests
- Test both success and failure paths
- For UI functions, try to minimize DOM dependencies or mock them properly 
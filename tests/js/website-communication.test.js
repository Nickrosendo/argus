/**
 * Loads the real website bridge content script and checks which pages it
 * listens to and what it passes on to the background worker.
 */
const fs = require('fs');
const path = require('path');

const WEBSITE = 'https://argustime.com';
const source = fs
  .readFileSync(path.join(__dirname, '../../js/website-communication.js'), 'utf8')
  // The build fills this in from WEBSITE_URL
  .replace(/__WEBSITE_URL__/g, WEBSITE);

describe('website bridge content script', () => {
  let sendMessage;
  let posted;
  let listener;
  let fakeWindow;

  const dispatch = async (event) => {
    await listener({ source: fakeWindow, origin: WEBSITE, ...event });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const fromWebsite = (data) => ({ data: { source: 'argus-website', timestamp: Date.now(), ...data } });

  beforeEach(() => {
    sendMessage = jest.fn((message, callback) => callback({ success: true }));
    posted = [];
    listener = null;

    fakeWindow = {
      addEventListener: (type, handler) => {
        if (type === 'message') listener = handler;
      },
      postMessage: (message, targetOrigin) => posted.push({ message, targetOrigin }),
      location: { href: `${WEBSITE}/payment/success` },
    };
    const fakeChrome = { runtime: { sendMessage, lastError: null } };

    // Run the script with its own window and extension API. `browser` is
    // passed as undefined so the script picks the Chrome API, as in Chrome.
    new Function('window', 'chrome', 'browser', 'document', 'console', source)(
      fakeWindow,
      fakeChrome,
      undefined,
      document,
      { log: () => {}, error: () => {} }
    );
  });

  it('should answer a detection request from the website', async () => {
    await dispatch(fromWebsite({ type: 'ARGUS_EXTENSION_DETECTION' }));

    expect(posted).toHaveLength(1);
    expect(posted[0].message).toMatchObject({ type: 'ARGUS_EXTENSION_DETECTED', source: 'argus-extension' });
    // Replies go to the website only, not to any origin
    expect(posted[0].targetOrigin).toBe(WEBSITE);
  });

  it('should pass a successful payment on to the background worker', async () => {
    await dispatch(fromWebsite({ type: 'ARGUS_EXTENSION_MESSAGE', action: 'paymentSuccess', data: { sessionId: 'cs_test_1' } }));

    expect(sendMessage).toHaveBeenCalledWith({ action: 'verifyPayment', sessionId: 'cs_test_1' }, expect.any(Function));
    expect(posted[0].message).toMatchObject({ type: 'ARGUS_EXTENSION_RESPONSE', action: 'paymentSuccess', success: true });
  });

  it('should report failure to the website when the background cannot confirm the payment', async () => {
    sendMessage.mockImplementation((message, callback) => callback({ success: false, error: 'Subscription not found' }));

    await dispatch(fromWebsite({ type: 'ARGUS_EXTENSION_MESSAGE', action: 'paymentSuccess', data: { sessionId: 'cs_test_1' } }));

    expect(posted[0].message).toMatchObject({ success: false, message: 'Subscription not found' });
  });

  it.each([
    ['another website', { origin: 'https://evil.example' }],
    ['a look-alike of a local address', { origin: 'http://localhost.evil.example' }],
    ['a local address when the build targets the real site', { origin: 'http://localhost:3000' }],
    ['a different window, such as an embedding page', { source: {} }],
  ])('should ignore messages from %s', async (_name, override) => {
    await dispatch({ ...fromWebsite({ type: 'ARGUS_EXTENSION_MESSAGE', action: 'initiatePayment' }), ...override });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);
  });

  it('should ignore messages that do not claim to come from the website script', async () => {
    await dispatch({ data: { type: 'ARGUS_EXTENSION_MESSAGE', action: 'initiatePayment', source: 'something-else' } });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

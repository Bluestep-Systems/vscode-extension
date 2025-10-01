import * as assert from 'assert';
import { HttpClient } from '../../main/app/util/network/HttpClient';

suite('HttpClient Mock Test Suite', () => {
  let mockHttp: ReturnType<typeof HttpClient.enableTestMode>;

  setup(() => {
    // Enable test mode and get the mock HTTP client
    mockHttp = HttpClient.enableTestMode();
  });

  teardown(() => {
    // Reset to production mode after each test
    HttpClient.reset();
  });

  test('Mock HTTP client basic functionality', async () => {
    // Set up a mock response
    mockHttp.setMockTextResponse('https://example.com/csrf-token', 'test-csrf-token-123');

    // Make a request
    const response = await HttpClient.getInstance().fetch('https://example.com/csrf-token');
    const text = await response.text();

    // Verify the response
    assert.strictEqual(text, 'test-csrf-token-123');
    assert.strictEqual(mockHttp.wasRequested('https://example.com/csrf-token'), true);
    assert.strictEqual(mockHttp.getRequestCount('https://example.com/csrf-token'), 1);
  });

  test('Mock HTTP client with JSON response', async () => {
    // Set up a mock JSON response
    const mockData = { id: 1, name: 'Test User' };
    mockHttp.setMockJsonResponse('https://api.example.com/user', mockData);

    // Make a request
    const response = await HttpClient.getInstance().fetch('https://api.example.com/user');
    const data = await response.json();

    // Verify the response
    assert.deepStrictEqual(data, mockData);
    assert.strictEqual(response.headers.get('Content-Type'), 'application/json');
  });

  test('Mock HTTP client with custom headers', async () => {
    // Set up a mock response with custom headers
    mockHttp.setMockTextResponse(
      'https://api.example.com/csrf-token',
      'csrf-token-value',
      200,
      { 'b6p-csrf-token': 'new-token-123' }
    );

    // Make a request
    const response = await HttpClient.getInstance().fetch('https://api.example.com/csrf-token');

    // Verify headers
    assert.strictEqual(response.headers.get('b6p-csrf-token'), 'new-token-123');
  });

  test('Mock HTTP client with error response', async () => {
    // Set up a mock error
    mockHttp.setMockError(
      'https://api.example.com/error',
      new Error('Network timeout')
    );

    // Verify the error is thrown
    await assert.rejects(
      async () => {
        await HttpClient.getInstance().fetch('https://api.example.com/error');
      },
      (error: Error) => {
        assert.strictEqual(error.message, 'Network timeout');
        return true;
      }
    );
  });

  test('Mock HTTP client request logging', async () => {
    // Set up multiple mock responses
    mockHttp.setMockTextResponse('https://api.example.com/endpoint1', 'response1');
    mockHttp.setMockTextResponse('https://api.example.com/endpoint2', 'response2');

    // Make requests
    await HttpClient.getInstance().fetch('https://api.example.com/endpoint1');
    await HttpClient.getInstance().fetch('https://api.example.com/endpoint2');
    await HttpClient.getInstance().fetch('https://api.example.com/endpoint1');

    // Verify request log
    const requestLog = mockHttp.getRequestLog();
    assert.strictEqual(requestLog.length, 3);
    assert.strictEqual(requestLog[0].url, 'https://api.example.com/endpoint1');
    assert.strictEqual(requestLog[1].url, 'https://api.example.com/endpoint2');
    assert.strictEqual(requestLog[2].url, 'https://api.example.com/endpoint1');

    // Verify request counts
    assert.strictEqual(mockHttp.getRequestCount('https://api.example.com/endpoint1'), 2);
    assert.strictEqual(mockHttp.getRequestCount('https://api.example.com/endpoint2'), 1);

    // Verify last request
    const lastRequest = mockHttp.getLastRequest();
    assert.strictEqual(lastRequest?.url, 'https://api.example.com/endpoint1');
  });

  test('Mock HTTP client with POST request', async () => {
    // Set up a mock response
    mockHttp.setMockJsonResponse(
      'https://api.example.com/login',
      { success: true, token: 'session-token' }
    );

    // Make a POST request
    const response = await HttpClient.getInstance().fetch(
      'https://api.example.com/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'pass' })
      }
    );

    const data = await response.json();

    // Verify response
    assert.deepStrictEqual(data, { success: true, token: 'session-token' });

    // Verify request details
    const lastRequest = mockHttp.getLastRequest();
    assert.strictEqual(lastRequest?.options?.method, 'POST');
    assert.strictEqual(
      (lastRequest?.options?.headers as Record<string, string>)?.['Content-Type'],
      'application/json'
    );
  });

  test('Mock HTTP client throws error for unconfigured URL', async () => {
    // Don't set up any mock response

    // Verify error is thrown for unconfigured URL
    await assert.rejects(
      async () => {
        await HttpClient.getInstance().fetch('https://api.example.com/unconfigured');
      },
      (error: Error) => {
        assert.strictEqual(
          error.message,
          'No mock response configured for URL: https://api.example.com/unconfigured'
        );
        return true;
      }
    );
  });

  test('Mock HTTP client clearMocks resets state', async () => {
    // Set up mock responses
    mockHttp.setMockTextResponse('https://api.example.com/test', 'response');

    // Make a request
    await HttpClient.getInstance().fetch('https://api.example.com/test');

    // Verify state
    assert.strictEqual(mockHttp.wasRequested('https://api.example.com/test'), true);
    assert.strictEqual(mockHttp.getRequestLog().length, 1);

    // Clear mocks
    mockHttp.clearMocks();

    // Verify state is cleared
    assert.strictEqual(mockHttp.wasRequested('https://api.example.com/test'), false);
    assert.strictEqual(mockHttp.getRequestLog().length, 0);

    // Verify unconfigured URL now throws error
    await assert.rejects(
      async () => {
        await HttpClient.getInstance().fetch('https://api.example.com/test');
      },
      /No mock response configured for URL/
    );
  });
});

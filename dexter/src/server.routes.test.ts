import { describe, expect, test } from 'bun:test';
import { createHttpHandler } from './server.js';

describe('server routes', () => {
  test('returns 404 for removed advisory endpoint', async () => {
    const handler = createHttpHandler();
    const response = await handler(
      new Request('http://localhost/v1/stock/advisory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'allocation' }),
      })
    );
    expect(response.status).toBe(404);
  });
});


/**
 * tests/dashboard/support/fakeAiProvider.js
 * Lightweight mock server simulating 9Router and native AI endpoints for reliable test isolation.
 * Supports configurable latency, 429 rate limit, 404 missing model, schema retry, and abort tracking.
 */
const http = require('http');

class FakeAiProvider {
  constructor(options = {}) {
    this.options = options;
    this.server = null;
    this.port = 0;
    this.requests = [];
    this.abortedRequests = [];
    this.handlers = [];
  }

  async start(port = 0) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const bodyChunks = [];
        const startTs = Date.now();
        let wasAborted = false;

        req.on('close', () => {
          if (!res.writableEnded) {
            wasAborted = true;
            this.abortedRequests.push({
              url: req.url,
              method: req.method,
              headers: req.headers,
              durationMs: Date.now() - startTs,
              timestamp: Date.now()
            });
          }
        });

        req.on('data', (chunk) => bodyChunks.push(chunk));
        req.on('end', async () => {
          const rawBody = Buffer.concat(bodyChunks).toString('utf8');
          let parsedBody = null;
          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            parsedBody = rawBody;
          }

          const reqRecord = {
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: parsedBody,
            rawBody,
            timestamp: Date.now()
          };
          this.requests.push(reqRecord);

        // Check custom handlers first
        for (const handler of this.handlers) {
          const matched = handler(req, res, reqRecord);
          if (matched) return;
        }

        // Default routing
        if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            object: 'list',
            data: [
              { id: 'qaFast', object: 'model' },
              { id: 'qaDeep', object: 'model' },
              { id: 'gemini-2.5-flash', object: 'model' },
              { id: 'gpt-4o-mini', object: 'model' }
            ]
          }));
          return;
        }

        // Chat completions (OpenAI format)
        if (req.method === 'POST' && req.url.includes('/chat/completions')) {
          const requestedModel = parsedBody?.model || 'default';

          if (this.options.simulateRateLimit) {
            res.writeHead(429, {
              'Content-Type': 'application/json',
              'retry-after': String(this.options.retryAfterSeconds || 2)
            });
            res.end(JSON.stringify({
              error: { message: 'Rate limit exceeded at provider', type: 'rate_limit_error', code: 429 }
            }));
            return;
          }

          if (this.options.simulateAuthError) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: { message: 'Invalid API key', type: 'authentication_error', code: 401 }
            }));
            return;
          }

          if (this.options.simulate404Models?.includes(requestedModel)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: { message: `Model ${requestedModel} not found`, type: 'invalid_request_error', code: 'model_not_found' }
            }));
            return;
          }

          if (this.options.delayMs) {
            await new Promise((r) => setTimeout(r, this.options.delayMs));
          }

          if (wasAborted) return;

          const responseText = typeof this.options.responseGenerator === 'function'
            ? this.options.responseGenerator(reqRecord)
            : (this.options.responseText || '{"status":"ok"}');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-fake-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: requestedModel,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: responseText },
                finish_reason: 'stop'
              }
            ],
            usage: this.options.omitUsage ? undefined : {
              prompt_tokens: 120,
              completion_tokens: 45,
              total_tokens: 165
            }
          }));
          return;
        }

        // Gemini native endpoint
        if (req.method === 'POST' && req.url.includes(':generateContent')) {
          if (this.options.delayMs) {
            await new Promise((r) => setTimeout(r, this.options.delayMs));
          }

          const responseText = typeof this.options.responseGenerator === 'function'
            ? this.options.responseGenerator(reqRecord)
            : (this.options.responseText || '{"status":"ok"}');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: responseText }],
                  role: 'model'
                },
                finishReason: 'STOP'
              }
            ],
            usageMetadata: this.options.omitUsage ? undefined : {
              promptTokenCount: 110,
              candidatesTokenCount: 40,
              totalTokenCount: 150
            }
          }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not mocked' }));
      });
    });

      this.server.listen(port, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve(this);
      });
      this.server.on('error', reject);
    });
  }

  addHandler(fn) {
    this.handlers.unshift(fn);
  }

  getBaseUrl() {
    return `http://127.0.0.1:${this.port}/v1`;
  }

  clear() {
    this.requests = [];
    this.abortedRequests = [];
    this.handlers = [];
  }

  async stop() {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }
}

module.exports = FakeAiProvider;

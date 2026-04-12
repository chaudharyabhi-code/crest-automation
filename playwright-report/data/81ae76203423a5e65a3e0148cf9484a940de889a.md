# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/historical-performance-chart.spec.js >> Historical Performance Chart Verification Tests >> Historical Performance Chart for 2020-01-01
- Location: tests/dashboard/historical-performance-chart.spec.js:28:5

# Error details

```
Error: API Error 429: {"detail":"Too many requests. Please slow down."}
```

# Test source

```ts
  1  | import { request } from '@playwright/test';
  2  | 
  3  | const BASE_URL = process.env.BASE_URL;
  4  | 
  5  | export class APIClient {
  6  |   constructor(accessToken) {
  7  |     this.context = null;
  8  |     this.accessToken = accessToken;
  9  |   }
  10 | 
  11 |   async init() {
  12 |     const headers = {
  13 |       'Content-Type': 'application/json',
  14 |     };
  15 | 
  16 |     if (this.accessToken) {
  17 |       headers['Authorization'] = `Bearer ${this.accessToken}`;
  18 |     }
  19 | 
  20 |     this.context = await request.newContext({
  21 |       baseURL: BASE_URL,
  22 |       timeout: parseInt(process.env.API_TIMEOUT_MS || '30000'),
  23 |       extraHTTPHeaders: headers,
  24 |     });
  25 |   }
  26 | 
  27 |   async dispose() {
  28 |     if (this.context) {
  29 |       await this.context.dispose();
  30 |     }
  31 |   }
  32 | 
  33 |   async get(endpoint, params = {}) {
  34 |     const queryString = new URLSearchParams(params).toString();
  35 |     const url = queryString ? `${endpoint}?${queryString}` : endpoint;
  36 | 
  37 |     const response = await this.context.get(url);
  38 |     return this.handleResponse(response);
  39 |   }
  40 | 
  41 |   async post(endpoint, data) {
  42 |     const response = await this.context.post(endpoint, { data });
  43 |     return this.handleResponse(response);
  44 |   }
  45 | 
  46 |   async put(endpoint, data) {
  47 |     const response = await this.context.put(endpoint, { data });
  48 |     return this.handleResponse(response);
  49 |   }
  50 | 
  51 |   async delete(endpoint) {
  52 |     const response = await this.context.delete(endpoint);
  53 |     return this.handleResponse(response);
  54 |   }
  55 | 
  56 |   async handleResponse(response) {
  57 |     const status = response.status();
  58 |     const body = await response.json().catch(() => null);
  59 | 
  60 |     if (!response.ok()) {
> 61 |       throw new Error(`API Error ${status}: ${JSON.stringify(body)}`);
     |             ^ Error: API Error 429: {"detail":"Too many requests. Please slow down."}
  62 |     }
  63 | 
  64 |     return { status, body };
  65 |   }
  66 | }
  67 | 
```
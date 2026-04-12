import { request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;

export class APIClient {
  constructor(accessToken) {
    this.context = null;
    this.accessToken = accessToken;
  }

  async init() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    this.context = await request.newContext({
      baseURL: BASE_URL,
      timeout: parseInt(process.env.API_TIMEOUT_MS || '30000'),
      extraHTTPHeaders: headers,
    });
  }

  async dispose() {
    if (this.context) {
      await this.context.dispose();
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    const response = await this.context.get(url);
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const response = await this.context.post(endpoint, { data });
    return this.handleResponse(response);
  }

  async put(endpoint, data) {
    const response = await this.context.put(endpoint, { data });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    const response = await this.context.delete(endpoint);
    return this.handleResponse(response);
  }

  async handleResponse(response) {
    const status = response.status();
    const body = await response.json().catch(() => null);

    if (!response.ok()) {
      throw new Error(`API Error ${status}: ${JSON.stringify(body)}`);
    }

    return { status, body };
  }
}

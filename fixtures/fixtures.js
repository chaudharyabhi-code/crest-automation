import { test as base, expect } from '@playwright/test';
import { APIClient } from '../auth/apiClient.js';
import fs from 'fs';
import path from 'path';

export const test = base.extend({
  // Provide authenticated API client to all tests
  apiClient: async ({}, use) => {
    // Read token from auth file saved during global setup
    const authFile = path.join(process.cwd(), '.auth', 'token.json');
    let accessToken = process.env.ACCESS_TOKEN;

    if (!accessToken && fs.existsSync(authFile)) {
      const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      accessToken = authData.accessToken;
    }

    if (!accessToken) {
      throw new Error('No access token available. Global setup may have failed.');
    }

    const client = new APIClient(accessToken);
    await client.init();

    await use(client);

    await client.dispose();
  },
});

export { expect };

import { authenticateUser } from './auth.js';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), '.auth', 'token.json');


async function globalSetup() {
  console.log('Running global setup: Authenticating user...');

 

  const accessToken = await authenticateUser();

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save token to file for tests to use
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ accessToken }, null, 2));

  console.log('Global setup complete: Token saved to', AUTH_FILE);

  // Also set as env var for immediate use
  process.env.ACCESS_TOKEN = accessToken;
}

export default globalSetup;

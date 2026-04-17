import { authenticateUser } from './auth.js';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), '.auth', 'token.json');

function isTokenValid(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    // Check if token expires in more than 5 minutes
    return payload.exp && (payload.exp * 1000) > (Date.now() + 5 * 60 * 1000);
  } catch {
    return false;
  }
}

async function globalSetup() {
  console.log('Running global setup: Authenticating user...');

  // Check for existing valid token
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      if (cached.accessToken && isTokenValid(cached.accessToken)) {
        console.log('Using cached authentication token');
        process.env.ACCESS_TOKEN = cached.accessToken;
        return;
      }
    } catch {
      // Invalid cache, continue to re-authenticate
    }
  }

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

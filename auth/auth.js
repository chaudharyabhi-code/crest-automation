import { request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;

export class AuthAPI {
  constructor() {
    this.context = null;
    this.accessToken = null;
  }

  async init() {
    this.context = await request.newContext({
      baseURL: BASE_URL,
      timeout: parseInt(process.env.API_TIMEOUT_MS || '30000'),
    });
  }

  async dispose() {
    if (this.context) {
      await this.context.dispose();
    }
  }

  async signup(phoneNumber, fullName) {
    const response = await this.context.post('/api/v1/auth/signup', {
      data: {
        phone_number: phoneNumber,
        full_name: fullName,
        recaptcha_token: process.env.RECAPTCHA_TOKEN || 'random-token',
      },
    });

    if (!response.ok()) {
      throw new Error(`Signup failed: ${response.status()} ${await response.text()}`);
    }

    return response.json();
  }

  async verifyOtp(phoneNumber, otp) {
    const response = await this.context.post('/api/v1/auth/verify-otp', {
      data: {
        phone_number: phoneNumber,
        verification_code: otp,
      },
    });

    if (!response.ok()) {
      throw new Error(`Verify OTP failed: ${response.status()} ${await response.text()}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token || data.token || data.data?.access_token;
    return data;
  }

  getAccessToken() {
    return this.accessToken;
  }
}

export async function authenticateUser() {
  const auth = new AuthAPI();
  await auth.init();

  const phoneNumber = process.env.PHONE_NUMBER;
  const fullName = process.env.FULL_NAME || 'Test User';
  const otp = process.env.OTP || '1111';

  console.log(`Authenticating user: ${phoneNumber}`);

  await auth.signup(phoneNumber, fullName);
  await auth.verifyOtp(phoneNumber, otp);

  const token = auth.getAccessToken();
  console.log('Authentication successful, token received');

  await auth.dispose();
  return token;
}

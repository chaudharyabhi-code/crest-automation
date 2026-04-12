import pg from 'pg';

const { Pool } = pg;

class DatabaseClient {
  constructor() {
    this.pool = null;
  }

  async init() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000'),
    });

    // Test connection
    const client = await this.pool.connect();
    console.log('Database connected successfully');
    client.release();
  }

  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not initialized. Call init() first.');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }
}

// Singleton instance
export const dbClient = new DatabaseClient();

import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { Contact, ContactResponse } from './types';

export class DatabaseUtils {
    private static pool: Pool;
    private static redis: Redis;

    static initialize() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: 5432,
        });

        this.redis = new Redis({
            host: process.env.REDIS_ENDPOINT,
            port: 6379,
        });
    }

    static async getClient(): Promise<PoolClient> {
        return this.pool.connect();
    }

    static async getCachedResult(key: string): Promise<ContactResponse | null> {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    static async setCachedResult(key: string, value: ContactResponse, expiry: number = 3600) {
        await this.redis.set(key, JSON.stringify(value), 'EX', expiry);
    }

    static async deleteCachedResult(key: string) {
        await this.redis.del(key);
    }

    static async findPrimaryContacts(client: PoolClient, email: string, phoneNumber: string): Promise<Contact[]> {
        const query = `
      SELECT * FROM contacts 
      WHERE (email = $1 OR phoneNumber = $2) 
      AND linkPrecedence = 'primary'
      ORDER BY createdAt
    `;
        const result = await client.query(query, [email, phoneNumber]);
        return result.rows;
    }

    static async findSecondaryContacts(client: PoolClient, linkedId: number): Promise<Contact[]> {
        const query = `
      SELECT id, email, phoneNumber 
      FROM contacts 
      WHERE linkedId = $1
    `;
        const result = await client.query(query, [linkedId]);
        return result.rows;
    }

    static async createContact(
        client: PoolClient,
        email: string,
        phoneNumber: string,
        linkPrecedence: 'primary' | 'secondary',
        linkedId: number | null,
        idempotencyKey: string,
    ): Promise<number> {
        const query = `
      INSERT INTO contacts (email, phoneNumber, linkedId, linkPrecedence, idempotency_key)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
        const result = await client.query(query, [email, phoneNumber, linkedId, linkPrecedence, idempotencyKey]);
        return result.rows[0].id;
    }

    static async updateContactToSecondary(client: PoolClient, contactId: number, linkedId: number) {
        const query = `
      UPDATE contacts 
      SET linkPrecedence = 'secondary', 
          linkedId = $1, 
          updatedAt = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
        await client.query(query, [linkedId, contactId]);
    }

    static async updateLinkedContacts(client: PoolClient, oldLinkedId: number, newLinkedId: number) {
        const query = `
      UPDATE contacts 
      SET linkedId = $1, 
          updatedAt = CURRENT_TIMESTAMP 
      WHERE linkedId = $2
    `;
        await client.query(query, [newLinkedId, oldLinkedId]);
    }

    static async checkIdempotency(client: PoolClient, idempotencyKey: string): Promise<boolean> {
        const query = `
      SELECT id FROM contacts 
      WHERE idempotency_key = $1
    `;
        const result = await client.query(query, [idempotencyKey]);
        return result.rows.length > 0;
    }
}

DatabaseUtils.initialize();

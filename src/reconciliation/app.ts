import { SQSEvent } from 'aws-lambda';
import { DatabaseUtils } from '../utils/db-utils';
import { errorHandler } from '../utils/error-handling';
import { ContactUtils } from '../utils/contact-utils';

export const handler = async (event: SQSEvent) => {
    try {
        const client = await DatabaseUtils.getClient();
        try {
            await client.query('BEGIN');

            for (const record of event.Records) {
                const { email, phoneNumber, primaryContactId, idempotencyKey } = JSON.parse(record.body);
                await ContactUtils.reconcileContacts(client, email, phoneNumber, primaryContactId, idempotencyKey);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        return { statusCode: 200, body: JSON.stringify({ status: 'processed' }) };
    } catch (error) {
        return errorHandler(error);
    }
};

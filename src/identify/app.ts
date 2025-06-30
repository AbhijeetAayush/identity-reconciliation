import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseUtils } from '../utils/db-utils';
import { Validators } from '../utils/validators';
import { errorHandler, ApiError } from '../utils/error-handling';
import { ContactUtils } from '../utils/contact-utils';
import { SQSUtils } from '../utils/sqs-utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) throw new ApiError(400, 'Request body is required');

        const body = JSON.parse(event.body);
        const { email, phoneNumber } = Validators.validateIdentifyInput(body);
        const idempotencyKey = uuidv4();
        const cacheKey = `${email}:${phoneNumber}`;

        const cachedResult = await DatabaseUtils.getCachedResult(cacheKey);
        if (cachedResult) {
            return { statusCode: 200, body: JSON.stringify(cachedResult) };
        }

        const client = await DatabaseUtils.getClient();
        try {
            await client.query('BEGIN');

            const response = await ContactUtils.processIdentify(client, email, phoneNumber, idempotencyKey);

            await client.query('COMMIT');

            await DatabaseUtils.setCachedResult(cacheKey, response);

            await SQSUtils.sendMessage({
                email,
                phoneNumber,
                primaryContactId: response.contact.primaryContactId,
                idempotencyKey,
            });

            return { statusCode: 200, body: JSON.stringify(response) };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        return errorHandler(error);
    }
};

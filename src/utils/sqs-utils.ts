import AWS from 'aws-sdk';
import { SQSMessage } from './types';

export class SQSUtils {
    private static sqs = new AWS.SQS();

    static async sendMessage(message: SQSMessage) {
        await this.sqs
            .sendMessage({
                QueueUrl: process.env.SQS_QUEUE_URL!,
                MessageBody: JSON.stringify(message),
            })
            .promise();
    }
}

export interface Contact {
    id: number;
    email: string;
    phoneNumber: string;
    linkedId: number | null;
    linkPrecedence: 'primary' | 'secondary';
    createdAt: Date;
    updatedAt: Date;
    idempotency_key: string;
}

export interface ContactResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

export interface SQSMessage {
    email: string;
    phoneNumber: string;
    primaryContactId: number;
    idempotencyKey: string;
}

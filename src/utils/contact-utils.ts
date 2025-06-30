import { PoolClient } from 'pg';
import { DatabaseUtils } from './db-utils';
import { Contact, ContactResponse } from './types';

export class ContactUtils {
    static async processIdentify(
        client: PoolClient,
        email: string,
        phoneNumber: string,
        idempotencyKey: string,
    ): Promise<ContactResponse> {
        const primaryContacts = await DatabaseUtils.findPrimaryContacts(client, email, phoneNumber);
        const response: ContactResponse = {
            contact: { primaryContactId: 0, emails: [], phoneNumbers: [], secondaryContactIds: [] },
        };

        if (primaryContacts.length > 0) {
            const primaryContact = primaryContacts[0];
            response.contact.primaryContactId = primaryContact.id;
            response.contact.emails = primaryContact.email ? [primaryContact.email] : [];
            response.contact.phoneNumbers = primaryContact.phoneNumber ? [primaryContact.phoneNumber] : [];

            const secondaryContacts = await DatabaseUtils.findSecondaryContacts(client, primaryContact.id);
            secondaryContacts.forEach((contact) => {
                if (contact.email && !response.contact.emails.includes(contact.email)) {
                    response.contact.emails.push(contact.email);
                }
                if (contact.phoneNumber && !response.contact.phoneNumbers.includes(contact.phoneNumber)) {
                    response.contact.phoneNumbers.push(contact.phoneNumber);
                }
                response.contact.secondaryContactIds.push(contact.id);
            });

            if (
                (email && !response.contact.emails.includes(email)) ||
                (phoneNumber && !response.contact.phoneNumbers.includes(phoneNumber))
            ) {
                const newId = await DatabaseUtils.createContact(
                    client,
                    email,
                    phoneNumber,
                    'secondary',
                    primaryContact.id,
                    idempotencyKey,
                );
                response.contact.secondaryContactIds.push(newId);
                if (email && !response.contact.emails.includes(email)) response.contact.emails.push(email);
                if (phoneNumber && !response.contact.phoneNumbers.includes(phoneNumber))
                    response.contact.phoneNumbers.push(phoneNumber);
            }
        } else {
            const newId = await DatabaseUtils.createContact(
                client,
                email,
                phoneNumber,
                'primary',
                null,
                idempotencyKey,
            );
            response.contact.primaryContactId = newId;
            response.contact.emails = email ? [email] : [];
            response.contact.phoneNumbers = phoneNumber ? [phoneNumber] : [];
        }

        return response;
    }

    static async reconcileContacts(
        client: PoolClient,
        email: string,
        phoneNumber: string,
        primaryContactId: number,
        idempotencyKey: string,
    ) {
        if (await DatabaseUtils.checkIdempotency(client, idempotencyKey)) {
            return;
        }

        const matchingContacts = await DatabaseUtils.findPrimaryContacts(client, email, phoneNumber);
        const otherPrimaryContacts = matchingContacts.filter((contact) => contact.id !== primaryContactId);

        if (otherPrimaryContacts.length > 0) {
            const oldestContact = otherPrimaryContacts.reduce((oldest, contact) =>
                new Date(contact.createdAt) < new Date(oldest.createdAt) ? contact : oldest,
            );

            for (const contact of otherPrimaryContacts) {
                if (contact.id !== oldestContact.id) {
                    await DatabaseUtils.updateContactToSecondary(client, contact.id, oldestContact.id);
                    await DatabaseUtils.updateLinkedContacts(client, contact.id, oldestContact.id);
                }
            }

            await DatabaseUtils.deleteCachedResult(`${email}:${phoneNumber}`);
        }
    }
}

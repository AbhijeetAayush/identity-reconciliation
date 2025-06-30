import { ApiError } from './error-handling';

export class Validators {
    static validateIdentifyInput(body: any): { email: string; phoneNumber: string } {
        if (!body || (!body.email && !body.phoneNumber)) {
            throw new ApiError(400, 'At least one of email or phoneNumber is required');
        }

        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new ApiError(400, 'Invalid email format');
        }

        if (phoneNumber && !/^\+?\d{10,15}$/.test(phoneNumber)) {
            throw new ApiError(400, 'Invalid phone number format');
        }

        return { email, phoneNumber };
    }
}

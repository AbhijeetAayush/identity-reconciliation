export class ApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
    }
}

export function errorHandler(error: any) {
    if (error instanceof ApiError) {
        return {
            statusCode: error.statusCode,
            body: JSON.stringify({ error: error.message }),
        };
    }

    console.error('Unexpected error:', error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
    };
}

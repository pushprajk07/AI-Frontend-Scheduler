import { Prisma } from '../generated/prisma/index.js';
import ApiError from '../utils/ApiError.ts';
import dotenv from 'dotenv';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

dotenv.config();

const formatZodError = (error: ZodError): string => {
    return error.issues
        .map((err: any) => {
            const path = err.path.join('.') || 'root';
            const message = err.message;
            if (err.code === 'invalid_enum_value' && 'options' in err) {
                const options = err.options.join(', ');
                return `Field '${path}': ${message}. Expected one of: ${options}`;
            }
            return `Field '${path}': ${message}`;
        })
        .join('\n');
};

export const errorHandler = (err: Error | HTTPException | ApiError | ZodError, c: Context) => {
    console.error('Error occurred:', err);

    let statusCode: number = 500;
    let message: string = 'Internal Server Error';

    if (err instanceof ZodError) {
        statusCode = 400;
        message = formatZodError(err);
    } else if (err instanceof HTTPException) {
        statusCode = err.status;
        message = err.message;
    } else if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        statusCode = 400;
        message = err.message;
    } else if (err.message) {
        message = err.message;
    }

    if (process.env.NODE_ENV === 'production') {
        if (!(err instanceof ApiError && err.isOperational)) {
            statusCode = 500;
            message = 'Something went wrong. Please try again later.';
        }
    }

    // Ensure status code is valid (200-599)
    if (statusCode < 200 || statusCode > 599) {
        console.error(`Invalid status code ${statusCode}, defaulting to 500`);
        statusCode = 500;
    }

    const response: Record<string, any> = {
        message,
        code: statusCode
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    return c.json(response, statusCode as any);
};

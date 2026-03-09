import app from './app.ts';
import prisma from './client.ts';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';

let server: any;

dotenv.config();

console.log('Starting');
async function main() {
    try {
        await prisma.$connect();
        
        // Fix for "Unique constraint failed on the fields: (id)"
        // This resets the autoincrement sequence to the current max ID + 1
        try {
            await prisma.$executeRawUnsafe(`
                SELECT setval(
                    pg_get_serial_sequence('"Appointment"', 'id'),
                    COALESCE((SELECT MAX(id) FROM "Appointment"), 0) + 1,
                    false
                );
            `);
            console.log('Successfully reset Appointment sequence');
        } catch (seqError) {
            console.error('Failed to reset Appointment sequence:', seqError);
        }
    } catch (error) {
        process.exit(1);
    }

    server = serve({
        fetch: app.fetch,
        port: (process.env.PORT || 3000) as number
    });

    const exitHandler = () => {
        if (server) {
            server.close(() => {
                process.exit(1);
            });
        } else {
            process.exit(1);
        }
    };

    const unexpectedErrorHandler = () => {
        exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);

    process.on('SIGTERM', () => {
        if (server) {
            server.close();
        }
    });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

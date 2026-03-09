import { Context, Next } from 'hono';

const catchAsync = (fn: (c: Context, next: Next) => Promise<Response | void>) => {
    return async (c: Context, next: Next) => {
        try {
            return await fn(c, next);
        } catch (err) {
            throw err;
        }
    };
};

export default catchAsync;

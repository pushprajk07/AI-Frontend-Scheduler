import * as tokenService from '../services/tokenService.ts';
import ApiError from '../utils/ApiError.ts';
import { Context, Next } from 'hono';

/**
 * Auth Middleware - Functional approach for protecting routes by verifying JWT tokens
 *
 * Usage: Apply to routes that require authentication
 * Example: app.get('/protected', authMiddleware, handler)
 */

/**
 * Verify JWT access token and attach user info to context
 */
export async function authMiddleware(c: Context, next: Next) {
    try {
        // Get token from Authorization header
        const authHeader = c.req.header('Authorization');

        if (!authHeader) {
            throw new ApiError(401, 'No authorization token provided');
        }

        // Expected format: "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            throw new ApiError(401, 'Invalid authorization header format');
        }

        const token = parts[1];

        // Verify token
        const payload = tokenService.verifyAccessToken(token);

        // Attach user info to context for use in handlers
        c.set('userId', payload.userId);
        c.set('userEmail', payload.email);

        await next();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        // Handle JWT verification errors
        throw new ApiError(401, 'Invalid or expired token');
    }
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 * Useful for routes that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
    try {
        const authHeader = c.req.header('Authorization');

        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                const token = parts[1];
                const payload = tokenService.verifyAccessToken(token);

                c.set('userId', payload.userId);
                c.set('userEmail', payload.email);
            }
        }
    } catch (error) {
        // Silently ignore token errors for optional auth
        console.warn('Optional auth token verification failed:', error);
    }

    await next();
}

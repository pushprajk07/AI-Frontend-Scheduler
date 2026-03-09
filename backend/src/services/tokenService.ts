import { AuthTokens, TokenPayload } from '../types/token.ts';
import jwt from 'jsonwebtoken';

/**
 * Token Service - Functional approach for JWT token generation and verification
 */

// Default secrets for development (use strong secrets in production via env vars)
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

/**
 * Generate both access and refresh tokens for a user
 */
export function generateTokens(userId: string, email: string): AuthTokens {
    const payload: TokenPayload = { userId, email };

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });

    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY
    });

    return { accessToken, refreshToken };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): TokenPayload {
    try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
    try {
        const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Refresh token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid refresh token');
        }
        throw error;
    }
}

/**
 * Refresh access token using a valid refresh token
 */
export function refreshAccessToken(refreshToken: string): string {
    const payload = verifyRefreshToken(refreshToken);

    // Generate new access token with same user info
    return jwt.sign({ userId: payload.userId, email: payload.email }, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });
}

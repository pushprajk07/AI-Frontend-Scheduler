import * as tokenService from '../services/tokenService.ts';
import * as userService from '../services/userService.ts';
import * as otpService from '../services/otpService.ts';
import ApiError from '../utils/ApiError.ts';
import { validateEmailPassword } from '../utils/emailPassword.ts';
import { OAuth, OAuthProvider } from '@uptiqai/integrations-sdk';
import { Context } from 'hono';

/**
 * Auth Controller - Functional approach for handling auth-related HTTP requests
 *
 * Flow:
 * 1. Use integration layer to get user profile from OAuth provider
 * 2. Use user service to find/create user in database
 * 3. Use token service to generate JWT tokens
 * 4. Return tokens to frontend
 */

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
export async function googleLogin(c: Context) {
    const googleOAuth = new OAuth({ provider: OAuthProvider.Google });

    // Generate OAuth authorization URL
    const { url } = await googleOAuth.getAuthorizationUrl({
        state: crypto.randomUUID() // Generate random state for CSRF protection
    });

    // Redirect user to Google OAuth consent screen
    return c.redirect(url);
}

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
export async function googleCallback(c: Context) {
    try {
        const code = c.req.query('code');
        const state = c.req.query('state');

        if (!code) {
            throw new ApiError(400, 'Authorization code is required');
        }

        // 1. Use integration layer to exchange code for user profile
        const googleOAuth = new OAuth({ provider: OAuthProvider.Google });
        const userProfile = await googleOAuth.handleOAuthCallback({ code, state });

        // 2. Extract metadata to store (profile picture, locale, etc.)
        const metadata = {
            picture: userProfile.picture,
            locale: userProfile.rawProfile?.locale,
            lastLoginAt: new Date().toISOString()
        };

        // 3. Find or create user in database with metadata
        const user = await userService.findOrCreateUser(userProfile, metadata);

        // 4. Generate JWT tokens
        const tokens = tokenService.generateTokens(user.id, user.email);

        // 5. Return tokens to frontend (or redirect with tokens in URL)
        // Option A: JSON response (if frontend is handling this via API)
        // return c.json({ ...tokens, user });

        // Option B: Redirect to frontend with tokens in URL params
        const frontendUrl = process.env.FRONTEND_DOMAIN!;
        const redirectUrl = new URL('/auth/callback', frontendUrl);
        redirectUrl.searchParams.set('accessToken', tokens.accessToken);
        redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);

        return c.redirect(redirectUrl.toString());
    } catch (error) {
        console.error('Google callback error:', error);
        const frontendUrl = process.env.FRONTEND_DOMAIN!;
        return c.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Authentication failed')}`);
    }
}

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Body: { refreshToken: string }
 */
export async function refreshToken(c: Context) {
    const body = await c.req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
    }

    try {
        // Verify refresh token and generate new access token
        const newAccessToken = tokenService.refreshAccessToken(refreshToken);

        return c.json({
            accessToken: newAccessToken
        });
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }
}

/**
 * GET /auth/me
 * Get current user info (requires auth middleware)
 */
export async function getCurrentUser(c: Context) {
    // User is already attached by auth middleware
    const userId = c.get('userId');

    if (!userId) {
        throw new ApiError(401, 'Unauthorized');
    }

    const user = await userService.getUserById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    return c.json({ user });
}

/**
 * GET /auth/identities
 * Get all linked identities for current user
 */
export async function getUserIdentities(c: Context) {
    const userId = c.get('userId');

    if (!userId) {
        throw new ApiError(401, 'Unauthorized');
    }

    const identities = await userService.getUserIdentities(userId);

    return c.json({ identities });
}

/**
 * DELETE /auth/identities/:provider
 * Unlink an identity provider
 */
export async function unlinkIdentity(c: Context) {
    const userId = c.get('userId');
    const provider = c.req.param('provider');

    if (!userId) {
        throw new ApiError(401, 'Unauthorized');
    }

    try {
        await userService.unlinkIdentity(userId, provider);
        return c.json({ message: 'Identity unlinked successfully' });
    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(400, error.message);
        }
        throw error;
    }
}

/**
 * POST /auth/register
 * Register new user with email and password
 * Body: { email: string, password: string, name?: string }
 */
export async function register(c: Context) {
    try {
        const body = await c.req.json();
        const { email, password, name } = body;

        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        validateEmailPassword(email, password);

        // Register user in database with hashed password
        const user = await userService.registerWithEmailPassword(email, password, name);

        // Generate JWT tokens
        const tokens = tokenService.generateTokens(user.id, user.email);

        return c.json(
            {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            },
            201
        );
    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(400, error.message);
        }
        throw error;
    }
}

/**
 * POST /auth/login
 * Login with email and password
 * Body: { email: string, password: string }
 */
export async function login(c: Context) {
    try {
        const body = await c.req.json();
        const { email, password } = body;

        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        validateEmailPassword(email, password);
        // Authenticate user and verify password
        const user = await userService.authenticateWithEmailPassword(email, password);

        // Generate JWT tokens
        const tokens = tokenService.generateTokens(user.id, user.email);

        return c.json({
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(401, error.message);
        }
        throw error;
    }
}



/**
 * POST /auth/phone/send-otp
 * Send OTP to phone number via WhatsApp
 * Body: { phone: string }
 */
export async function sendPhoneOTP(c: Context) {
    try {
        const body = await c.req.json();
        const { phone } = body;

        if (!phone) {
            throw new ApiError(400, 'Phone number is required');
        }
    
        if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
            throw new ApiError(400, 'Invalid phone number format. Use international format: +1234567890');
        }

        await otpService.generateAndSendOTP(phone, 'phone', 'login');

        return c.json({
            message: 'OTP sent successfully to WhatsApp',
            expiresIn: 600 // 10 minutes in seconds
        });

    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(400, error.message);
        }
        throw error;
    }
}

/**
 * POST /auth/phone/verify-otp
 * Verify OTP and login/register user
 * Body: { phone: string, otp: string, name?: string }
 */
export async function verifyPhoneOTP(c: Context) {
    try {
        const body = await c.req.json();
        const { phone, otp, name } = body;

        if (!phone || !otp) {
            throw new ApiError(400, 'Phone number and OTP are required');
        }

        // Verify OTP
        await otpService.verifyOTP(phone, 'phone', otp);

        // Find or create user
        const user = await userService.findOrCreateUserByPhone(phone, name);

        // Generate JWT tokens
        const tokens = tokenService.generateTokens(user.id, user.email);

        return c.json({
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(401, error.message);
        }
        throw error;
    }
}
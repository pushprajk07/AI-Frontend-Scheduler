import * as authController from '../controllers/authController.ts';
import { authMiddleware } from '../middlewares/authMiddleware.ts';
import catchAsync from '../utils/catchAsync.ts';
import { Hono } from 'hono';

/**
 * Auth Routes - Define all authentication-related endpoints
 */

const authRoutes = new Hono();

// ========== Public Routes (No Auth Required) ==========

/**
 * GET /auth/google
 * Initiate Google OAuth login flow
 */
authRoutes.get('/google', catchAsync(authController.googleLogin));

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
authRoutes.get('/google/callback', catchAsync(authController.googleCallback));

/**
 * POST /auth/refresh
 * Refresh access token
 * Body: { refreshToken: string }
 */
authRoutes.post('/refresh', catchAsync(authController.refreshToken));

/**
 * POST /auth/register
 * Register new user with email and password
 * Body: { email: string, password: string, name?: string }
 */
authRoutes.post('/register', catchAsync(authController.register));

/**
 * POST /auth/login
 * Login with email and password
 * Body: { email: string, password: string }
 */
authRoutes.post('/login', catchAsync(authController.login));

/**
 * POST /auth/phone/send-otp
 * Send OTP to phone number via WhatsApp
 * Body: { phone: string }
 */
authRoutes.post('/phone/send-otp', catchAsync(authController.sendPhoneOTP));

/**
 * POST /auth/phone/verify-otp
 * Verify OTP and login/register user
 * Body: { phone: string, otp: string, name?: string }
 */
authRoutes.post('/phone/verify-otp', catchAsync(authController.verifyPhoneOTP));

// ========== Protected Routes (Auth Required) ==========

/**
 * GET /auth/me
 * Get current user information
 * Requires: Authorization header with valid JWT
 */
authRoutes.get('/me', authMiddleware, catchAsync(authController.getCurrentUser));

/**
 * GET /auth/identities
 * Get all linked identity providers for current user
 * Requires: Authorization header with valid JWT
 */
authRoutes.get('/identities', authMiddleware, catchAsync(authController.getUserIdentities));

/**
 * DELETE /auth/identities/:provider
 * Unlink an identity provider (e.g., 'Google', 'GitHub')
 * Requires: Authorization header with valid JWT
 */
authRoutes.delete('/identities/:provider', authMiddleware, catchAsync(authController.unlinkIdentity));

export default authRoutes;

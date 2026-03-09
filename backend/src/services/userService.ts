import prisma from '../client.ts';
import { User } from '../types/user.ts';
import { HandleOAuthCallback200 } from '@uptiqai/integrations-sdk';
import bcrypt from 'bcrypt';

/**
 * User Service - Functional approach for user and identity management
 */

/**
 * Find or create user based on auth provider profile
 * Handles multiple identity providers per user
 */
export async function findOrCreateUser(profile: HandleOAuthCallback200, metadata?: Record<string, any>): Promise<User> {
    // Check if identity already exists
    const existingIdentity = await prisma.userIdentity.findUnique({
        where: {
            provider_providerId: {
                provider: profile.provider,
                providerId: profile.providerId
            }
        },
        include: {
            user: true
        }
    });

    if (existingIdentity) {
        // User already logged in with this provider before
        // Update metadata if provided (e.g., new profile picture, updated tokens)
        if (metadata) {
            await prisma.userIdentity.update({
                where: { id: existingIdentity.id },
                data: { metadata }
            });
        }
        return existingIdentity.user;
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: profile.email }
    });

    if (existingUser) {
        // User exists but logging in with a new provider
        // Link this new identity to existing user
        await prisma.userIdentity.create({
            data: {
                userId: existingUser.id,
                provider: profile.provider,
                providerId: profile.providerId,
                metadata: metadata || profile.rawProfile
            }
        });

        return existingUser;
    }

    // New user - create user and identity
    const newUser = await prisma.user.create({
        data: {
            email: profile.email,
            name: profile.name || null,
            identities: {
                create: {
                    provider: profile.provider,
                    providerId: profile.providerId,
                    metadata: metadata || profile.rawProfile
                }
            }
        }
    });

    return newUser;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
        where: { id: userId }
    });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
        where: { email }
    });
}

/**
 * Get all identities for a user
 */
export async function getUserIdentities(userId: string) {
    return await prisma.userIdentity.findMany({
        where: { userId }
    });
}

/**
 * Unlink an identity from a user
 * Only allowed if user has at least one other identity
 */
export async function unlinkIdentity(userId: string, provider: string): Promise<void> {
    const identities = await getUserIdentities(userId);

    if (identities.length <= 1) {
        throw new Error('Cannot unlink last identity. User must have at least one login method.');
    }

    await prisma.userIdentity.updateMany({
        where: {
            userId,
            provider
        },
        data: {
            isDeleted: true
        }
    });
}

/**
 * Register user with email and password
 */
export async function registerWithEmailPassword(email: string, password: string, name?: string): Promise<User> {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with email/password identity
    const newUser = await prisma.user.create({
        data: {
            email,
            name: name || null,
            identities: {
                create: {
                    provider: 'EmailPassword',
                    providerId: email,
                    metadata: {
                        passwordHash,
                        emailVerified: false,
                        registeredAt: new Date().toISOString()
                    }
                }
            }
        }
    });

    return newUser;
}

/**
 * Authenticate user with email and password
 */
export async function authenticateWithEmailPassword(email: string, password: string): Promise<User> {
    // Find user identity
    const identity = await prisma.userIdentity.findUnique({
        where: {
            provider_providerId: {
                provider: 'EmailPassword',
                providerId: email
            }
        },
        include: {
            user: true
        }
    });

    if (!identity) {
        throw new Error('Invalid email or password');
    }

    // Verify password
    const metadata = identity.metadata as any;
    const isValid = await bcrypt.compare(password, metadata.passwordHash);

    if (!isValid) {
        throw new Error('Invalid email or password');
    }

    // Update last login
    await prisma.userIdentity.update({
        where: { id: identity.id },
        data: {
            metadata: {
                ...metadata,
                lastLoginAt: new Date().toISOString()
            }
        }
    });

    return identity.user;
}

/**
 * Find or create user with phone number
 */
export async function findOrCreateUserByPhone(phone: string, name?: string): Promise<User> {
    // Check if identity exists
    const existingIdentity = await prisma.userIdentity.findUnique({
        where: {
            provider_providerId: {
                provider: 'PhoneOTP',
                providerId: phone
            }
        },
        include: {
            user: true
        }
    });

    if (existingIdentity) {
        // Update last login
        await prisma.userIdentity.update({
            where: { id: existingIdentity.id },
            data: {
                metadata: {
                    ...(existingIdentity.metadata as any),
                    lastLoginAt: new Date().toISOString()
                }
            }
        });
        return existingIdentity.user;
    }

    // Create new user with phone identity
    const newUser = await prisma.user.create({
        data: {
            email: `${phone.replace(/[^0-9]/g, '')}@phone.local`, // Placeholder email
            name: name || null,
            identities: {
                create: {
                    provider: 'PhoneOTP',
                    providerId: phone,
                    metadata: {
                        phone,
                        phoneVerified: true,
                        registeredAt: new Date().toISOString(),
                        lastLoginAt: new Date().toISOString()
                    }
                }
            }
        }
    });

    return newUser;
}
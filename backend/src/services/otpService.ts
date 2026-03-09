import ApiError from '../utils/ApiError.ts';
import prisma from '../client.ts';
import bcrypt from 'bcrypt';
import { Messaging, MessagingProvider } from '@uptiqai/integrations-sdk';
const OTP_EXPIRATION_TIME = 600000; // 10 minutes
const MAX_ATTEMPTS = 5;

type OTPType = 'phone' | 'email';
type OTPPurpose = 'login' | 'registration' | 'password_reset' | '2fa';

/**
 * Generate and send OTP
 */
export async function generateAndSendOTP(
  identifier: string,  // Phone number or email
  type: OTPType,
  purpose: OTPPurpose = 'login'
): Promise<void> {
  // Rate limiting: Check for recent OTP requests
  const recentOTP = await prisma.otp.findFirst({
    where: {
      identifier,
      type,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000) // Within last 1 minute
      }
    }
  });

  if (recentOTP) {
    throw new ApiError(429, 'Please wait before requesting another OTP');
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash OTP before storing
  const hashedOTP = await bcrypt.hash(otp, 10);
  
  // Set expiration
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_TIME * 60 * 1000);
  
  // Invalidate previous unverified OTPs
  await prisma.otp.updateMany({
    where: {
      identifier,
      type,
      verified: false
    },
    data: {
      verified: true // Mark as invalid
    }
  });
  
  // Store new OTP
  await prisma.otp.create({
    data: {
      identifier,
      type,
      otp: hashedOTP,
      expiresAt,
      attempts: 0,
      verified: false,
      purpose
    }
  });
  
  // Send OTP based on type
  if (type === 'phone') {
      const TwilioWhatsApp = new Messaging({ provider: MessagingProvider.TwilioWhatsApp });
      await TwilioWhatsApp.createMessage({
        to: identifier,
        body: `Your verification code is ${otp}. This code will expire in 10 minutes. Please do not share this code with anyone.`,
      });
  }
}


/**
 * Verify OTP
 */
export async function verifyOTP(
    identifier: string,
    type: OTPType,
    otp: string
  ): Promise<boolean> {
    // Find the most recent unverified OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        identifier,
        type,
        verified: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!otpRecord) {
      throw new ApiError(404, `No OTP found for this ${type}`);
    }
    
    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { verified: true }
      });
      throw new ApiError(400, 'OTP has expired');
    }
    
    // Check attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { verified: true }
      });
      throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
    }
    
    // Verify OTP using bcrypt
    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    
    if (!isValid) {
      // Increment attempts
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 }
      });
      throw new ApiError(400, 'Invalid OTP');
    }
    
    // Mark as verified
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verified: true }
    });
    
    return true;
  }
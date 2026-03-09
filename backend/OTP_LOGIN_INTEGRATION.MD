### Send Phone OTP (POST /auth/phone/send-otp)

**Controller implementation:**
1. Validate phone format (international: `+1234567890`)
   ```typescript
   if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
     throw new ApiError(400, 'Invalid phone number format');
   }
   ```
2. Generate and send OTP:
   ```typescript
   await otpService.generateAndSendOTP(phone, 'phone', 'login');
   ```
3. Response:
   ```typescript
   return c.json({
     message: 'OTP sent successfully to WhatsApp',
     expiresIn: 600 // 10 minutes
   });
   ```

**Rate Limiting:** 1 OTP per minute per phone number (429 error if exceeded)

---

### Verify Phone OTP (POST /auth/phone/verify-otp)

**Controller implementation:**
1. Verify OTP:
   ```typescript
   await otpService.verifyOTP(phone, 'phone', otp);
   ```
2. Find or create user:
   ```typescript
   const user = await userService.findOrCreateUserByPhone(phone, name);
   ```
3. Generate JWT tokens:
   ```typescript
   const tokens = tokenService.generateTokens(user.id, user.email);
   ```
4. Return tokens and user info:
   ```typescript
   return c.json({
     ...tokens,
     user: { id: user.id, email: user.email, name: user.name }
   });
   ```

**OTP Service automatically handles:**
- 6-digit OTP generation and bcrypt hashing
- 10-minute expiration
- Maximum 5 verification attempts
- Invalidation of previous unverified OTPs


**important**
- ensure to enable /auth route after this
---

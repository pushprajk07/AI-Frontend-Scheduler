### Google Login (GET /auth/google)


**Controller implementation:**
import {OAuth, OAuthProvider} from '@uptiqai/integrations-sdk'

1. Get Google auth provider:
   ```typescript
    const googleOAuth = new OAuth({ provider: OAuthProvider.Google });

   ```
2. Generate OAuth URL:
   ```typescript
    const {url} = await googleOAuth.getAuthorizationUrl({
        state: crypto.randomUUID() // Generate random state for CSRF protection
    });
   ```
3. Redirect user: `return c.redirect(url);`

---

### Google Callback (GET /auth/google/callback)

**Controller implementation:**
1. Extract code and state from query params
2. Exchange code for user profile (integration layer handles OAuth + ID token verification):
   ```typescript
    const googleOAuth = new OAuth({ provider: OAuthProvider.Google });
   const userProfile = await auth.handleOAuthCallback({ code, state });
   ```
3. Find or create user in database:
   ```typescript
   const metadata = {
       picture: userProfile.picture,
       locale: userProfile.rawProfile?.locale,
       lastLoginAt: new Date().toISOString()
   };
   const user = await userService.findOrCreateUser(userProfile, metadata);
   ```
4. Generate JWT tokens:
   ```typescript
   const tokens = tokenService.generateTokens(user.id, user.email);
   ```
5. Redirect to frontend with tokens:
   ```typescript
   const frontendUrl = process.env.FRONTEND_DOMAIN;
   const redirectUrl = new URL('/auth/callback', frontendUrl);
   redirectUrl.searchParams.set('accessToken', tokens.accessToken);
   redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
   return c.redirect(redirectUrl.toString());
   ```
6. On error: redirect to `${frontendUrl}/auth/error?message=Authentication%20failed`

**Integration layer (GoogleAuth) automatically handles:**
- OAuth code exchange
- ID token verification (signature, audience, issuer, expiration)
- User profile fetching

---

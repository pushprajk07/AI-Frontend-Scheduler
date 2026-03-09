## Prototyping Strategy & Mindset

- Simple Hono.js supported backend.
- Don't create any authentication layer unless asked explicitly.
- Properly check frontend service layer for which api routes are needed.
- Keep things simple and clean. Don't do complex implementations unless absolutely necessary.
- Don't add complex libraries unless asked explicitly by user.
- Follow `../frontend/API_SPECIFICATION.md` as api contract for writing api routes ans preparing/updating db schema if needed.

## Development Workflow

- Don't run dev server.
- Use only pnpm.
- Install dependencies before checking typescript errors or running build.
- Run pnpm build after completion of task at the end only. Don't run build commands in between. Fix any errors and run again.
- Make minimal targeted changes related to requested feature or bug only. Don't make unnecessary changes.
- Don't run git commands.
- Don't change eslint config.
- After doing all the required changes check if you are breaking prisma schema backward compatibility rules mentioned below and fix them if anything is breaking. **THIS is very IMPORTANT** as this can break server starting behaviour.

## Prisma & Database - CRITICAL RULES

### Soft Delete Only (MANDATORY)

**ABSOLUTE PROHIBITION - HARD DELETES ARE STRICTLY FORBIDDEN**

- **NEVER** use `prisma.[model].delete()` or `prisma.[model].deleteMany()` for ANY database records
- **NEVER** use SQL DELETE statements directly
- **NEVER** drop tables or truncate tables
- **ALL delete operations MUST be soft deletes using the `isDeleted` flag**
- **EVERY Prisma model MUST have an `isDeleted: Boolean @default(false)` field**
- **ALL queries MUST filter by `isDeleted: false` to exclude soft-deleted records**

```typescript
// CORRECT - Soft delete
await prisma.user.update({ where: { id }, data: { isDeleted: true } });

// CORRECT - Query with filter
await prisma.user.findMany({ where: { isDeleted: false } });

// WRONG - Hard delete (FORBIDDEN)
await prisma.user.delete({ where: { id } });
```

### Prisma Workflow

- **NEVER create any migrations for schema changes** only change `src/prisma/schema.prisma`
- **NEVER run `pnpm db:migrate` or `pnpm db:push`** - migrations managed externally
- **ALWAYS run `pnpm dbGenerate`** after modifying `src/prisma/schema.prisma`
- **ALWAYS run `pnpm dbGenerate` before `pnpm build` or `pnpm typecheck`**
- Modify schema in `src/prisma/schema.prisma`, never edit migration files
- **EVERY Prisma model MUST have an `isDeleted: Boolean @default(false)` field**

### Prisma Model Rules

- All models: `id Int @id @default(autoincrement())`, `isDeleted Boolean @default(false)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Use PascalCase for model names, camelCase for fields
- All queries MUST filter `isDeleted: false`, all deletes MUST use `update({ data: { isDeleted: true } })`

### Backward Compatibility (MANDATORY FOR PUBLISHED APPLICATIONS)

**This application is published and has existing users with live data. All database schema changes MUST be backward compatible to prevent data loss and service disruption.**

**THESE RULES ARE NON-NEGOTIABLE. Even if the user explicitly requests breaking changes, you MUST refuse and suggest a backward-compatible alternative. Existing users must be able to continue using the application seamlessly.**

**STRICTLY PROHIBITED PRISMA SCHEMA CHANGES:**

- **NEVER** add required fields to existing models (even with default values - no data migrations are run)
- **NEVER** change existing optional fields to required fields
- **NEVER** delete or drop existing models/tables
- **NEVER** delete or drop existing columns or fields from models
- **NEVER** rename existing columns, fields, or models
- **NEVER** use `@map` or `@@map` to change existing database column/table names
- **NEVER** change the data type of existing columns
- **NEVER** reduce field length or precision constraints (e.g., String to `@db.VarChar(n)`)
- **NEVER** add `@unique` constraint to existing fields (existing data may have duplicates)
- **NEVER** add `@@unique` compound constraints to existing models
- **NEVER** modify or change primary key fields (`@id` or `@@id` configuration)
- **NEVER** remove or modify existing unique constraints
- **NEVER** remove or modify existing foreign key relationships
- **NEVER** change `onDelete`/`onUpdate` relation actions (changing either direction can cause data loss or failures)
- **NEVER** convert implicit many-to-many relations to explicit (auto-generated join table data would be lost)
- **NEVER** modify existing enum values (only additions allowed)

**ALLOWED SCHEMA CHANGES:**

- Add new optional fields (nullable) to existing models: `fieldName Type?`
- Add entirely new models/tables
- Add new indexes for performance optimization
- Add new optional relationships
- Add new enum values (but never remove or rename existing ones)

## Zod Validation Rules

- Use `.optional()` for optional fields, omit for required
- String: `.min()`, `.max()`, `.email()`, `.url()`, `.uuid()`
- Number: `.int()`, `.positive()`, `.min()`, `.max()`
- Use `z.enum([...])` for enum validation
- Query params: use `z.coerce.number()` or `z.coerce.boolean()` to convert from strings
- All request validation should use Zod schemas

## Strictly Prohibited Actions

### Command Execution Restrictions

- **NEVER** execute `pnpm db:migrate`, `pnpm db:push`, or any database migration commands
- **NEVER** execute `pnpm db:seed` or any database seeding commands
- **NEVER** execute `pnpm dev` or any server start commands
- **NEVER** execute `kill` or any process termination commands
- **NEVER** execute deployment or production-related commands (except `pnpm build` at the very end)

### Database Migration Restrictions

- **NEVER** manually create migration files in `prisma/migrations/` directory
- **NEVER** write SQL migration files directly
- **NEVER** modify existing migration files
- **NEVER** bypass Prisma's migration system
- **ALL database schema changes MUST be made through Prisma schema models only**
- Database migrations are managed externally by the system - do not interfere

### Package Configuration Restrictions

- **NEVER** manually edit `package.json` directly
- **NEVER** add new scripts to `package.json`
- **NEVER** modify existing scripts in `package.json`
- **NEVER** create new command shortcuts or aliases
- You MAY add or update dependencies ONLY using `pnpm add`, `pnpm remove`, or `pnpm install` commands
- All package management must be done through pnpm commands, not manual file edits

### Allowed Operations Only

You are permitted to:

- Run `pnpm dbGenerate` to generate Prisma client for type safety
- Run `pnpm typecheck` to verify TypeScript compilation (ALWAYS run `pnpm dbGenerate` first)
- Run `pnpm add`, `pnpm remove`, or `pnpm install` to manage dependencies
- Modify Prisma schema models in `prisma/schema.prisma` for database changes
- Modify application source code (controllers, services, routes, etc.)

**Important**: Always run `pnpm dbGenerate` before running `pnpm typecheck` to ensure Prisma client is up-to-date.

### Allowed Shell Commands

You have access to these shell commands:

- `curl` - Make HTTP requests
- `cp` - Copy files
- `cd` - Change directory (required for navigating between frontend/backend)
- `pnpm build` - Build the project (run at the end only, after all changes)
- `pnpm dbGenerate` - Generate Prisma client
- `pnpm typecheck` - Check TypeScript types
- `pnpm eslint` - Run ESLint
- `pnpm prettier` - Format code
- `pnpm install` - Install all dependencies
- `pnpm add` - Add new dependencies
- `pnpm remove` - Remove dependencies
- `cat`, `printf`, `ls`, `echo`, `grep` - Basic shell utilities

## Tech Stack

- **Framework**: Hono v4 - Lightweight web framework
- **Database**: Prisma ORM with PostgreSQL
- **Storage**: Multi-cloud storage (AWS S3, Azure Blob, Google Cloud Storage)
- **Validation**: Zod for schema validation
- **TypeScript**: Strict type checking

## Default API Behavior

- **All APIs are unauthenticated by default** - No login/signup required unless specifically requested
- Don't add login/signup (authentication, JWT, password hashing, and user management) unless user explicitly asks
- Focus on core feature/business logic first
- Keep endpoints open and simple
- Use proper http status codes for responses like 200, 201, 400 and so on for api responses directly don't use any package for this.

## Core Files

- `src/app.ts` - Main Hono application
- `src/index.ts` - Server initialization
- `src/client.ts` - Prisma client singleton
- `src/middlewares/error.ts` - Global error handler
- `src/utils/ApiError.ts` - Custom error class with status codes
- `src/utils/catchAsync.ts` - Async error wrapper
- `src/integrations/*` - Available integrations
- `src/integrations/storage/*` - Multi-cloud storage (S3, Azure, GCS)
- `src/prisma/schema.prisma` - Database schema

## Error Handling

Throw `ApiError` for operational errors: `throw new ApiError(404, 'User not found')`

Wrap async handlers: `const handler = catchAsync(async (c) => { ... })`

Global handler supports: Zod validation (400), ApiError (custom), Prisma errors (400), Unknown (500 in production)

## Feature Implementation Examples

### Creating API Endpoints

`Create /<resource> endpoint with GET (list), POST (create), GET/:id, PATCH/:id, DELETE/:id using Prisma`

### Adding Validation

`Add Zod validation if required for /<resource> - name (string, required), price (number, positive), description (optional)`

### Authentication (Only When User Explicitly Requests)

**When to implement:** ONLY when user explicitly asks for authentication
**Default:** Email/Password authentication
**Google OAuth:** ONLY if user explicitly requests Google authentication
**Integration Layer:** `src/integrations/auth/` - READ-ONLY, never modify

---

## Auth Routes Reference

**File:** `src/routes/auth.routes.ts`

**CRITICAL: These routes are FIXED - use exact same paths. Internal logic can be changed.**

**Public routes:**
```typescript
authRoutes.post('/register', catchAsync(authController.register));
authRoutes.post('/login', catchAsync(authController.login));
authRoutes.post('/refresh', catchAsync(authController.refreshToken));
authRoutes.get('/google', catchAsync(authController.googleLogin));
authRoutes.get('/google/callback', catchAsync(authController.googleCallback));
```

**Protected routes (require authMiddleware):**
```typescript
authRoutes.get('/me', authMiddleware, catchAsync(authController.getCurrentUser));
authRoutes.get('/identities', authMiddleware, catchAsync(authController.getUserIdentities));
authRoutes.delete('/identities/:provider', authMiddleware, catchAsync(authController.unlinkIdentity));
```

---

## Environment Variables

```env
# Required for all auth:
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
FRONTEND_DOMAIN=http://localhost:5173

# Required ONLY for Google OAuth:
GOOGLE_OAUTH_CLIENT_ID=<GOOGLE_OAUTH_CLIENT_ID>
GOOGLE_OAUTH_CLIENT_SECRET=<GOOGLE_OAUTH_CLIENT_SECRET>
GOOGLE_OAUTH_REDIRECT_URI=<GOOGLE_OAUTH_REDIRECT_URI>
```

---

## Email/Password Authentication (Default)

### Register (POST /auth/register)

**Controller implementation:**
1. Extract email, password, name from request body
2. Validate using util:
   ```typescript
      validateEmailPassword(email, password);
   ```
3. Create user with hashed password:
   ```typescript
   const user = await userService.registerWithEmailPassword(email, password, name);
   ```
4. Generate JWT tokens:
   ```typescript
   const tokens = tokenService.generateTokens(user.id, user.email);
   ```
5. Return: `{ accessToken, refreshToken, user }`

**Validation (in controller):**
- Email: valid format, max 255 chars
- Password: min 8-128 chars, must have letter + number

---

### Login (POST /auth/login)

**Controller implementation:**
1. Extract email, password from request body
2. Validate format:
   ```typescript
      validateEmail(email); 
   ```
3. Verify password hash:
   ```typescript
   const user = await userService.authenticateWithEmailPassword(email, password);
   ```
4. Generate JWT tokens:
   ```typescript
   const tokens = tokenService.generateTokens(user.id, user.email);
   ```
5. Return: `{ accessToken, refreshToken, user }`

---

### Refresh Token (POST /auth/refresh)

**Controller implementation:**
1. Extract refreshToken from request body
2. Generate new access token:
   ```typescript
   const newAccessToken = tokenService.refreshAccessToken(refreshToken);
   ```
3. Return: `{ accessToken }`

---

### Protected Routes

**Get current user (GET /auth/me):**
```typescript
const userId = c.get('userId'); // Set by authMiddleware
const user = await userService.getUserById(userId);
return c.json({ user });
```

**Get identities (GET /auth/identities):**
```typescript
const userId = c.get('userId');
const identities = await userService.getUserIdentities(userId);
return c.json({ identities });
```

**Unlink identity (DELETE /auth/identities/:provider):**
```typescript
const userId = c.get('userId');
const provider = c.req.param('provider');
await userService.unlinkIdentity(userId, provider);
return c.json({ message: 'Identity unlinked successfully' });
```

---



## Files Reference

**Validation:**
- `src/utils/emailPassword.ts` - Email/password validation helpers

**Business Layer:**
- `src/services/userService.ts` - User CRUD, password hashing
- `src/services/tokenService.ts` - JWT generation/verification
- `src/controllers/authController.ts` - Request handlers
- `src/middlewares/authMiddleware.ts` - JWT verification
- `src/routes/auth.routes.ts` - Route definitions (FIXED paths)

---

## Important Notes

**Routes:** Use exact paths from `auth.routes.ts` - DO NOT change route paths
**Internal Logic:** Can be modified/implemented as needed
**Integration Layer:** NEVER modify files in `src/integrations/auth/`
**Default:** Email/Password when auth requested
**Google OAuth:** ONLY when explicitly requested by user
**Database:** Run `pnpm dbGenerate` after schema changes
**User Fields:** Add as optional only (`field String?`)

### File Upload with Storage

`Add /upload endpoint that accepts file, stores in S3, and returns URL using existing storage in src/integrations/storage`

Usage: `import { getStorageProvider } from '../integrations/storage/main.ts'`

### Background Jobs (Only When User Asks)

`Add Bull queue with Redis for processing image uploads in background`

Install: `pnpm add bull redis @types/bull`




**For External Integration layer use this strictly**
### Google OAuth Authentication (ONLY If Explicitly Requested)  please refer @./OAUTH_INTEGRATION.md
### LLM Integration please refer @./LLM_INTEGRATION.md
### Email Notification integration please refer @./EMAIL_NOTIFICATION.md
### Image Generation Integration (Only When User Asks)  @./IMAGE_GEN_INTEGRATION.md
### Payment Integration (Only When User Asks)  @./PAYMENT_INTEGRATION.md
### Whatsapp Messaging Integration (Only When User Asks)  @./MESSAGING_INTEGRATION.md
### LOGIN VIA PHONE OTP (ONLY If Explicitly Requested) @./OTP_LOGIN_INTEGRATION.md

## Strict Instructions

1. Start simple - build core feature first without auth/validation
2. Add features incrementally - validation → auth (if explicitly asked) → advanced features
3. Use existing patterns - catchAsync, ApiError, service layer
4. Storage is pre-configured in `src/integrations/storage/`
5. Define Prisma schema first, generate client, then build API
6. Use Zod for validation, TypeScript infers types from Prisma
7. Follow `../frontend/API_SPECIFICATION.md` as api contract for writing apis routes.
# Payment Integration
Strictly use `@uptiqai/integrations-sdk` for Stripe payments. The SDK automatically manages credentials.

## Implementation Steps
### 1. Database Models
Add to `src/prisma/schema.prisma`:
```prisma
model Payment {
  id                 String        @id @default(cuid())
  providerPaymentId  String?
  sessionId          String        @unique
  amount             Int           // Amount in cents
  currency           String
  status             String        // 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'
  customerEmail      String?
  metadata           Json?
  paidAt             DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  isDeleted          Boolean       @default(false)
  @@index([sessionId])
  @@index([status])
}

model WebhookEvent {
  id          String    @id @default(cuid())
  eventId     String    @unique  // Stripe event ID for idempotency
  eventType   String
  data        Json
  processed   Boolean   @default(false)
  processedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  isDeleted   Boolean   @default(false)
  @@index([eventId])
  @@index([processed])
}
```

Run: `pnpm dbGenerate`

### 2. Payment Service
Create `src/services/paymentService.ts`:
```typescript
import prisma from '../client';
interface StripeEvent {
  id: string;
  type: string;
  data: { object: any };
}
export async function handleWebhookEvent(event: StripeEvent): Promise<void> {
  // Check if already processed (idempotency)
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: event.id }
  });
  if (existing?.processed) {
    console.log(`Event ${event.id} already processed`);
    return;
  }
  // Log event
  await prisma.webhookEvent.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      eventType: event.type,
      data: event.data,
      processed: false
    }
  });
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      await prisma.payment.upsert({
        where: { sessionId: session.id },
        update: {
          status: 'SUCCEEDED',
          paidAt: new Date(),
          providerPaymentId: session.payment_intent,
          customerEmail: session.customer_email || session.customer_details?.email,
          metadata: session.metadata
        },
        create: {
          sessionId: session.id,
          providerPaymentId: session.payment_intent,
          amount: session.amount_total,
          currency: session.currency,
          status: 'SUCCEEDED',
          customerEmail: session.customer_email || session.customer_details?.email,
          metadata: session.metadata,
          paidAt: new Date()
        }
      });
      console.log(`Payment succeeded: ${session.id}`);
    }
    // Mark as processed
    await prisma.webhookEvent.update({
      where: { eventId: event.id },
      data: { processed: true, processedAt: new Date() }
    });
  } catch (error) {
    console.error(`Error processing event ${event.id}:`, error);
    throw error; // Return 400 to Stripe for retry
  }
}
```

### 3. Payment Routes
Create `src/routes/payment.routes.ts`:
```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { Payment, PaymentProvider } from '@uptiqai/integrations-sdk';
import { handleWebhookEvent } from '../services/paymentService';
import prisma from '../client';
const app = new Hono();
// Validation schema
const createCheckoutSchema = z.object({
  amount: z.number().positive(),  // Amount in cents (2000 = $20.00)
  currency: z.string().default('usd'),
  productName: z.string(),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional()
});

// ============================================
// Endpoint 1: Create Checkout Session
// ============================================
app.post('/create-checkout-session', async (c) => {
  const body = createCheckoutSchema.parse(await c.req.json());
  const payment = new Payment({ provider: PaymentProvider.Stripe });
  const frontendDomain = process.env.FRONTEND_DOMAIN || 'http://localhost:3000';
  
  const session = await payment.createCheckoutSession({
    amount: body.amount,
    currency: body.currency,
    productName: body.productName,
    customerEmail: body.customerEmail,
    metadata: { ...body.metadata, productName: body.productName },
    successUrl: `${frontendDomain}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${frontendDomain}/payment/cancel`
  });
  // Create pending payment record
  await prisma.payment.create({
    data: {
      sessionId: session.id,
      amount: body.amount,
      currency: body.currency,
      status: 'PENDING',
      customerEmail: body.customerEmail,
      metadata: body.metadata
    }
  });
  return c.json({ sessionUrl: session.url, sessionId: session.id });
});

// ============================================
// Endpoint 2: Stripe Webhook Handler
// ⚠️ CRITICAL: Full path MUST be /payment/stripe/webhook
// ============================================
app.post('/stripe/webhook', async (c) => {
  // STEP 1: Get raw body as TEXT (required for signature verification). DO NOT use c.req.json() - signature verification requires raw body
  const rawBody = await c.req.text();
  // STEP 2: Get signature header
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }
  // STEP 3: Initialize SDK and verify signature
  const payment = new Payment({ provider: PaymentProvider.Stripe });
  const verification = await payment.verifyWebhook({
    payload: rawBody,
    signature: signature
  });
  // STEP 4: Reject if invalid signature
  if (!verification.valid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  // STEP 5: Parse raw body to get actual Stripe event. IMPORTANT: verifyWebhook() only returns { valid: boolean, eventType?: string }. You MUST parse the payload separately to get the full event object
  const stripeEvent = JSON.parse(rawBody);
  // STEP 6: Process the event (handles idempotency)
  await handleWebhookEvent(stripeEvent);
  // STEP 7: Return success to Stripe
  return c.json({ received: true });
});

export default app;
```

### 4. Register Routes
In `src/app.ts`:
```typescript
import paymentRoutes from './routes/payment.routes';
app.route('/payment', paymentRoutes);
```

### 5. Run Commands
```bash
pnpm dbGenerate
pnpm build
```

## SDK API Reference
### Initialize
```typescript
import { Payment, PaymentProvider } from '@uptiqai/integrations-sdk';
const payment = new Payment({ provider: PaymentProvider.Stripe });
```

### Create Checkout Session
```typescript
const session = await payment.createCheckoutSession({
  amount: number,          // Amount in CENTS (2000 = $20.00)
  currency: string,        // 'usd', 'eur', etc.
  productName: string,
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string,
  metadata?: Record<string, string>
});
// Returns: { id, url, paymentStatus, amountTotal, currency }
```
### Verify Webhook
```typescript
const result = await payment.verifyWebhook({
  payload: string,   // raw body from Stripe
  signature: string  // 'stripe-signature' header
});
// Returns: { valid: boolean, eventType?: string }
// ⚠️ Parse payload separately to get full event:
const stripeEvent = JSON.parse(payload);
await handleWebhookEvent(stripeEvent);
```

## Frontend Requirements
Frontend must implement success/cancel pages.
### Success Page: `/payment/success`
```typescript
const sessionId = new URLSearchParams(window.location.search).get('session_id');
```
### Cancel Page
Create `/payment/cancel` route to show cancellation message

### Checkout Flow Example
```typescript
const response = await fetch('/payment/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 2000,  // $20.00 in cents
    currency: 'usd',
    productName: 'Premium Plan',
    customerEmail: 'user@example.com'
  })
});

const { sessionUrl } = await response.json();
window.location.href = sessionUrl;  // Redirect to Stripe Checkout
```
## Environment Variables
```bash
FRONTEND_DOMAIN=http://localhost:3000
```
## Critical Points

1. **Webhook Path:** MUST be exactly `/payment/stripe/webhook`
2. **Amount Format:** Always pass amount in CENTS (2000 = $20.00)
3. **Raw Body Required:** Use `c.req.text()` NOT `c.req.json()` for webhook endpoint
4. **Credentials Managed by SDK:** No manual STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET setup needed
5. **Idempotency:** Webhook handler uses `processed` field to prevent duplicate processing
6. **Two-Step Webhook Processing:**
   - Step 1: Verify signature with `payment.verifyWebhook()` → Returns `{ valid: boolean }`
   - Step 2: Parse payload with `JSON.parse(rawBody)` → Get full Stripe event object

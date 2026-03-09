**Strictly use this SDK for WhatsApp integration and NEVER use the WhatsApp API directly.**

### WhatsApp Messaging (Twilio)

**Controller implementation:**
```typescript
import { Messaging, MessagingProvider } from '@uptiqai/integrations-sdk';
```

1. Get Messaging provider:
   ```typescript
   import { Messaging, MessagingProvider } from '@uptiqai/integrations-sdk';
   const messaging = new Messaging({ provider: MessagingProvider.TwilioWhatsApp });
   ```

2. Send Message:
   ```typescript
   const result = await messaging.createMessage({
       to: 'whatsapp:+1234567890',
       body: 'Hello world!',
       // from: 'whatsapp:+14155238886' // Optional if configured in env or using Messaging Service
   });
   ```

3. Return result: `return c.json(result);`

---

### Send Media Message (Twilio WhatsApp)

**Controller implementation:**

1. Get Messaging provider:
   ```typescript
   const messaging = new Messaging({ provider: MessagingProvider.TwilioWhatsApp });
   ```

2. Send Media Message:
   ```typescript
   const result = await messaging.createMessage({
       to: 'whatsapp:+1234567890',
       body: 'Here is an image',
       mediaUrls: ['https://example.com/image.png']
   });
   ```

3. Return result: `return c.json(result);`

---

**Integration layer (TwilioWhatsApp) automatically handles:**
- Twilio Client initialization
- Message creation and dispatch
- Error handling from Twilio API


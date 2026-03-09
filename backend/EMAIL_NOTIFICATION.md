# Always use "@uptiqai/integration-sdk" for email integration

## Import

```ts
import { Email, EmailProvider } from '@uptiqai/integrations-sdk';
```

## Email: Send

```ts
const email = new Email({ provider: EmailProvider.Resend });

const result = await email.sendEmail({
  to: ['user@example.com'],
  subject: 'Welcome to UPTIQ',
  html: '<p>Hello from UPTIQ</p>',
});

```

## Email: Attachments

```ts
const email = new Email({ provider: EmailProvider.Resend });

const result = await email.sendEmail({
  to: ['user@example.com'],
  subject: 'Invoice',
  text: 'Please find the invoice attached.',
  attachments: [
    {
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
      content: base64Pdf,
    },
  ],
});

```

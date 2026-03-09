`Generate simple images and automatically upload to storage with signed URLs`

**Location:** `src/integrations/imageGeneration/`

**Environment Variables:**

- `IMAGE_GENERATION_PROVIDER` - Image generation provider
- `IMAGE_GENERATION_MODEL` - Image gen model (default: `gemini-2.5-flash-image`)

**IMPORTANT:** Always use `process.env.IMAGE_GENERATION_PROVIDER` provider for image generation don't differ from this
**IMPORTANT:** Always use `process.env.IMAGE_GENERATION_MODEL` model for image generation don't differ from this

**getInstance()**

```typescript
import { ImageGeneration, ImageGenerationProvider } from '@uptiqai/integrations-sdk';

const imageGenerator = new ImageGeneration({ provider: process.env.IMAGE_GENERATION_PROVIDER as ImageGenerationProvider});

// Generate image - automatically uploads to storage and returns signed URL
const result = await imageGenerator.generateImage({
  prompt: 'A beautiful sunset over mountains',
  aspectRatio: '16:9', // Optional
  model: process.env.IMAGE_GENERATION_MODEL // Always use this model
});

// Returns: { url, storageKey, mimeType, fileSize }
// - url: Signed URL
// - storageKey: Permanent storage identifier
```

**Integration automatically handles:**
- Image generation via model present in env
- Upload to configured storage (S3/GCS/Azure)
- Signed URL generation

**Usage in routes/controllers:**
- Call integration directly in controller
- Optionally save `storageKey` to database for persistence
- Use `storageKey` with storage integration to regenerate signed URLs later

**Key Points:**
- Integration returns ready-to-use signed URL
- No service layer needed for basic usage
- **Always use `process.env.IMAGE_GENERATION_MODEL` model**.
- Add database model if you need image history/gallery features

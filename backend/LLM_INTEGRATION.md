**You must not use this integration for image generation. For image generation use src/integrations/imageGeneration integration strictly.**

## Forbidden Dependencies

**NEVER install or import these packages - they are already wrapped in @uptiqai/integrations-sdk:**

- ❌ `ai` - AI SDK core
- ❌ `@ai-sdk/google` - Google AI SDK
- ❌ `@ai-sdk/anthropic` - Anthropic SDK
- ❌ `@ai-sdk/openai` - OpenAI SDK
- ❌ `@google/generative-ai` - Direct Google AI
- ❌ `@anthropic-ai/sdk` - Direct Anthropic
- ❌ `openai` - Direct OpenAI

**Use instead:** `@uptiqai/integrations-sdk` for ALL LLM operations


**Environment Variables:**
 - `LLM_PROVIDER` : always pass this as provider
 - `LLM_MODEL` : always pass this as model 

**Usage Example (Implement when user requests chat):**

**for streaming llm integation use this**

```typescript
import { Llm, LlmProvider } from '@uptiqai/integrations-sdk'
const llm = new Llm({ provider: process.env.LLM_PROVIDER as LlmProvider); // REQUIRED

//For streaming
const result = await llm.createStream({
    messages: [{ role: 'user', content: 'Hello!' }],
    model:  process.env.LLM_MODEL,
    options: { temperature: 0.7, maxTokens: 1000, topP: 0.9 }
);

c.header('Content-Type', 'text/event-stream');
c.header('Cache-Control', 'no-cache');
c.header('Connection', 'keep-alive');

//Return the stream directly - Hono will handle it
return c.body(result.data);
```

**for non-streaming llm integation use this**   
```typescript
import { Llm } from '@uptiqai/integrations-sdk'
const llm = new Llm({ provider: process.env.LLM_PROVIDER); // REQUIRED

// Non-streaming
const result = await llm.generateText({
    messages: [{ role: 'user', content: 'Hello!' }],
    model:  process.env.LLM_MODEL
);

```

**Important:**
- Provider parameter is REQUIRED
- Model parameter is optional (falls back to defaultModel from env or hardcoded defaults)
- Only one LLM provider will be configured per application

**Implement `/ai/chat` endpoint only when user explicitly requests chat functionality**
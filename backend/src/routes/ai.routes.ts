import { Hono, Context } from 'hono';
import { Llm, LlmProvider } from '@uptiqai/integrations-sdk';
import catchAsync from '../utils/catchAsync.ts';

const aiRoutes = new Hono();

const llm = new Llm({ 
    provider: (process.env.LLM_PROVIDER as LlmProvider) || LlmProvider.Google 
});

aiRoutes.post('/generate-content', catchAsync(async (c: Context) => {
    const { name, meetingType, date, time, tone } = await c.req.json();

    const prompt = `You are an AI appointment assistant. Generate communication assets for an appointment.
    User Name: ${name}
    Meeting Type: ${meetingType}
    Date: ${date}
    Time: ${time}
    Tone: ${tone}

    Generate the following fields as plain strings in a JSON format:
    1. confirmationEmail (A single formatted string starting with "Subject: ..." followed by the body)
    2. rescheduleMessage (A short, friendly message)
    3. cancellationMessage (A clear message regarding cancellation)
    4. reminderMessage (A brief reminder for 24 hours before)
    5. meetingAgenda (A single string with numbered points and timing, use newlines for each point)

    Respond ONLY with the JSON object. Example:
    {
      "confirmationEmail": "Subject: ...\\n\\nDear...",
      "rescheduleMessage": "...",
      "cancellationMessage": "...",
      "reminderMessage": "...",
      "meetingAgenda": "1. 10:00 AM - Intro\\n2. 10:15 AM - Demo"
    }`;

    const result = await llm.generateText({
        messages: [{ role: 'user', content: prompt }],
        model: process.env.LLM_MODEL
    });

    // Extract JSON from response (sometimes LLMs wrap in markdown code blocks)
    let content = (result as any).text || (result as any).data || '';
    if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
    }

    return c.json(JSON.parse(content));
}));

aiRoutes.post('/suggest-slots', catchAsync(async (c: Context) => {
    const { currentDate, currentTime, meetingType } = await c.req.json();

    const prompt = `An appointment of type "${meetingType}" is currently scheduled for ${currentDate} at ${currentTime}.
    Suggest 3 alternative available time slots that might be better or more convenient.
    The slots should be within the next 7 days.
    Format the output as a JSON object with a "slots" array. Each slot should have "date" (YYYY-MM-DD) and "time" (e.g., "10:00 AM") fields.
    Respond ONLY with the JSON object.`;

    const result = await llm.generateText({
        messages: [{ role: 'user', content: prompt }],
        model: process.env.LLM_MODEL
    });

    let content = (result as any).text || (result as any).data || '';
    if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
    }

    return c.json(JSON.parse(content));
}));

export default aiRoutes;

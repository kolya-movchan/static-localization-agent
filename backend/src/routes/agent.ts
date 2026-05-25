import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../db/database';
import { agentChat } from '../services/gemini';

const router = Router();

const SYSTEM_INSTRUCTION = `You are a Localization Agent for a tool called Static Localization Agent. Your job is to help users start an image localization job via Google Drive.

You guide users step by step to collect:
1. A Google Drive file URL or folder URL (required) — detect if it's a single file or a folder
2. Target languages as locale codes (required) — e.g. EN, UA, DE, RU, FR, ES, PL, IT
3. Any optional comments or special instructions for the AI translator (optional)

Rules:
- Be concise and friendly.
- When you have collected all required info (URL + at least one language), ask for confirmation with a summary before starting.
- When the user confirms, respond ONLY with a valid JSON action block and nothing else:
  {"action":"start_job","input_type":"file"|"folder","input_url":"<url>","languages":["EN","UA"],"comments":"<optional>"}
- If the user provides a Google Drive URL that contains "/d/" it is a file; if it contains "/folders/" it is a folder.
- For languages, accept common names too (English → EN, Ukrainian → UA, German → DE, etc.) and convert to 2-letter codes.
- If the user says "no comments" or skips, use empty string for comments.
- Never make up information. If unsure about the URL type, ask.
- Keep each message under 150 words.`;

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

router.post('/chat', async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    const geminiMessages = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const reply = await agentChat(geminiMessages, SYSTEM_INSTRUCTION);

    // Check if agent wants to start a job
    const actionMatch = reply.match(/\{[\s\S]*"action"\s*:\s*"start_job"[\s\S]*\}/);
    if (actionMatch) {
      let parsed: {
        action: string;
        input_type: string;
        input_url: string;
        languages: string[];
        comments?: string;
      };

      try {
        parsed = JSON.parse(actionMatch[0]);
      } catch {
        res.json({ message: reply });
        return;
      }

      const jobId = uuidv4();
      queries.createJob.run(
        jobId,
        parsed.input_type,
        parsed.input_url,
        JSON.stringify(parsed.languages),
        parsed.comments ?? null
      );

      const job = queries.getJob.get(jobId);
      res.json({
        message: `Job started! I've queued localization for ${parsed.languages.join(', ')}. Track progress on the dashboard.`,
        jobId,
        job: { ...job, languages: parsed.languages },
      });
      return;
    }

    res.json({ message: reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[agent] Error:', msg);
    res.status(500).json({ error: 'Agent failed: ' + msg });
  }
});

export default router;

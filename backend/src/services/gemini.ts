import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '../config';

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

function buildLocalizationPrompt(language: string, comments: string): string {
  return `Current Locale: ${language}

Translate all text on this image to the ${language} locale. Keep fonts, layout, colors, and all visual elements exactly the same. Only change the text language. Output the full localized image.

If the Current Locale is "UA" - Translate to Ukrainian.
If the Current Locale is "EN" - Copywrite content in English.
If the Current Locale is "RU" - Translate to Russian.
If the Current Locale is "DE" - Translate to German.
If the Current Locale is "FR" - Translate to French.
If the Current Locale is "ES" - Translate to Spanish.
If the Current Locale is "PL" - Translate to Polish.
If the Current Locale is "IT" - Translate to Italian.

Additional instructions: ${comments || 'None.'}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiEdit(
  model: string,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  attempt = 1
): Promise<Buffer> {
  try {
    const base64 = imageBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    throw new Error('Gemini returned no image in response');
  } catch (err: unknown) {
    const isRateLimit =
      err instanceof Error && (err.message.includes('429') || err.message.includes('quota'));

    if (isRateLimit && attempt < config.worker.maxRetries) {
      await sleep(attempt * 10_000);
      return callGeminiEdit(model, imageBuffer, mimeType, prompt, attempt + 1);
    }
    throw err;
  }
}

export interface EditResult {
  buffer: Buffer;
  modelUsed: string;
}

export async function editImageWithFallback(
  imageBuffer: Buffer,
  mimeType: string,
  language: string,
  comments: string
): Promise<EditResult> {
  const prompt = buildLocalizationPrompt(language, comments);

  try {
    const buffer = await callGeminiEdit(
      config.gemini.primaryModel,
      imageBuffer,
      mimeType,
      prompt
    );
    return { buffer, modelUsed: config.gemini.primaryModel };
  } catch (primaryErr) {
    console.warn(
      `[gemini] Primary model failed (${config.gemini.primaryModel}), trying fallback:`,
      (primaryErr as Error).message
    );

    const buffer = await callGeminiEdit(
      config.gemini.fallbackModel,
      imageBuffer,
      mimeType,
      prompt
    );
    return { buffer, modelUsed: config.gemini.fallbackModel };
  }
}

export async function agentChat(
  messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  systemInstruction: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: config.gemini.agentModel,
    contents: messages,
    config: { systemInstruction },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

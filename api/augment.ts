// api/augment.ts  (Vercel Node Serverless Function)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { context, before, after } = req.body as {
    context: string;
    before: string;
    after: string;
  };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const promptSystem =
    "You are a reflective-writing coach. " +
    "Use BEFORE/AFTER only for context, but create TWO Korean sentences " +
    "that replace SELECTED without repeating words or meanings from BEFORE/AFTER.";

  const promptUser =
    `BEFORE: ${before}\nSELECTED: ${context}\nAFTER: ${after}\n\n` +
    "위 지침에 따라 증강해줘.";

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: promptSystem },
      { role: 'user', content: promptUser },
    ],
    temperature: 0.7,
  });

  res.status(200).json({ text: completion.choices[0].message.content });
}

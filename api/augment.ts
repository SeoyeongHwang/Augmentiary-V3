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
    "You are a reflective-writing coach.\n" +
    "Use BEFORE and AFTER strictly as background context.\n" +
    "Generate an augmented version of SELECTED that:\n" +
    "  -Conveys new insight in EXACTLY two Korean sentences.\n" +
    "  -Do not use overlap sentence from BEFORE and AFTER so that the augmented content flow naturally with the BEFORE and AFTER entries.\n" +
    "  -Flows naturally with the surrounding text.\n";

  const promptUser =
    `--- BEFORE ---\n${before}\n\n<< SELECTED >>\n${context}\n\n--- AFTER ---\n${after}\n` +
    "일기의 앞, 뒤 맥락을 고려하여, 사용자의 자기이해와 성찰에 도움될 수 있도록 'SELECTED' 부분에 예상치 못한 통찰을 추가하여 자연스럽게 증강해줘. 일기의 내용과 공명하는 글이어야 해. 증강된 부분만 응답해줘.";

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

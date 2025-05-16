import { Router } from 'express';
import { OpenAI } from 'openai';
import 'dotenv/config';

const router = Router();

router.use((req, _res, next) => {
    console.log('🔵 /augment reached!', req.method, req.url);
    next();
  });

router.post('/', async (req, res) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { context } = req.body as { context: string };

  // 🔸 실제 LLM 호출
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a reflective writing coach.' },
      { role: 'user',   content: `“${context}”를 두 문장 통찰로 재구성해줘` },
    ],
    temperature: 0.7,
  });

  // 🔸 Connect 표준으로 직접 응답
  const payload = JSON.stringify({ text: completion.choices[0].message.content });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(payload).toString());
  res.end(payload);
});

export default router;

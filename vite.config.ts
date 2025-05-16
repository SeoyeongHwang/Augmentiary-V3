import 'dotenv/config';    

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),

    // ────────────── Connect 핸들러 직접 주입 ──────────────
    {
      name: 'augment-inline-backend',
      configureServer(server) {
        // 몸체(JSON) 파서 ― 아주 가벼운 버전
        server.middlewares.use('/augment', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end('Method Not Allowed');
          }

          /* ---- ① 요청 바디 읽기 ---- */
          const chunks: Uint8Array[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const bodyStr = Buffer.concat(chunks).toString();
          const { context, before, after} = JSON.parse(bodyStr) as {
            context: string;
            before:  string;
            after:   string;
          };

          /* ---- ② OpenAI 호출 ---- */
          const { OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 
                "You are a reflective-writing coach.\n" +
                "Use BEFORE and AFTER strictly as background context.\n" +
                "Generate an augmented version of SELECTED that:\n" +
                "  • Conveys new insight in EXACTLY two Korean sentences.\n" +
                "  • Do not use overlap sentence so that the augmented content flow naturally with the BEFORE and AFTER entries.\n" +
                "  • Flows naturally with the surrounding text.\n"
              },
              { 
                role: 'user', 
                content: 
                  `--- BEFORE ---\n${before}\n` +
                  `<< SELECTED >>\n${context}\n` +
                  `--- AFTER ---\n${after}\n` +
                  "앞, 뒤 맥락을 고려하여, 위 'SELECTED' 부분만 긍정적인 재해석으로 증강해줘.",
              },
            ],
            temperature: 0.7,
          });

          /* ---- ③ JSON 응답 ---- */
          const payload = JSON.stringify({
            text: completion.choices[0].message.content,
          });
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Length', Buffer.byteLength(payload).toString());
          res.end(payload);
        });
      },
    },
  ],
});

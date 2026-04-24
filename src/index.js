import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Ollama } from 'ollama';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

import { db } from './db/client.js';
import { sessions, messages } from './db/schema.js';
import { serveStatic } from 'hono/bun';

// ── OLLAMA CLIENT ────────────────────────────────────────────────
const ollama = new Ollama({
  host: "https://ollama.com", // e.g. https://api.ollama.ai (cloud)
  headers: {
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },


});

// ── SYSTEM PROMPT ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are GuideAI — a Socratic learning assistant. Your core mission is to guide users toward solutions, not hand them solutions directly.

## YOUR BEHAVIOUR RULES:

**When a user asks about solving ANY kind of problem** (coding bugs, math, logic, debugging, algorithms, design decisions, errors, how-to tasks, anything that requires finding a solution or fixing something):
- DO NOT provide the direct answer or solution
- INSTEAD: guide them step by step — ask clarifying questions, explain relevant concepts, point to the right approach, break down the problem into smaller steps, hint at what to look for
- Think like a great teacher or mentor: "What have you tried? Let's think about X. Have you considered Y?"
- You can show small illustrative code snippets to explain a concept, but never write the full working solution for them

**When a user is NOT asking about solving a problem** (greetings, casual chat, opinions, general knowledge questions, asking how you work, factual lookups, etc.):
- Respond normally, naturally, and helpfully
- No need to guide — just be a good conversationalist

## EXAMPLES:

User: "Hi, how are you?" → Respond normally, warmly.
User: "What is recursion?" → Explain it normally (this is a knowledge question, not a problem to solve).
User: "Help me fix my recursive function that crashes" → Guide them: ask to see the code, ask what error they get, explain what to look for in a base case, etc.
User: "Write me a function to sort a list" → Guide them: ask what sorting approach they want to learn, explain the concepts behind sorting, have them try first.
User: "My SQL query returns duplicates, fix it" → Guide them: ask to see the query, explain what causes duplicates, hint at DISTINCT or GROUP BY concepts.

## TONE:
- Warm, encouraging, patient
- Ask one or two focused questions rather than overwhelming them
- Celebrate when they're on the right track
- Keep responses concise but complete`;

// ── HELPER: generate session title from first message ─────────────
async function generateTitle(firstMessage) {
  try {
    const reply = await callOllama({
      model: 'gpt-oss:120b-cloud', // or cloud model name
      messages: [
        {
          role: 'system',
          content:
            'Generate a very short title (3-5 words max). Return ONLY the title.',
        },
        { role: 'user', content: firstMessage },
      ],
    });

    return reply.trim() || firstMessage.slice(0, 40);
  } catch (e) {
    console.log(e)
    return firstMessage.slice(0, 40);
  }
}

// ── HELPER: call ollama ──────────────────────────────────────────
async function callOllama({ model, messages }) {
  const res = await ollama.chat({
    model,
    messages,
  });

  return res.message?.content || '';
}

// ── APP ───────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

app.use('/*', serveStatic({ root: './public' }))

// ── POST /chat ────────────────────────────────────────────────────
app.post('/chat', async (c) => {
  const { message, sessionId, model } = await c.req.json();

  if (!message?.trim()) return c.json({ error: 'Message is required' }, 400);

  const selectedModel = model || 'claude-sonnet-4-20250514';

  try {
    let session;
    let isNewSession = false;

    // Find or create session
    if (sessionId) {
      const found = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      session = found[0];
    }

    if (!session) {
      isNewSession = true;
      const newId = uuid();
      const title = await generateTitle(message);
      await db.insert(sessions).values({ id: newId, title, model: selectedModel });
      const created = await db.select().from(sessions).where(eq(sessions.id, newId)).limit(1);
      session = created[0];
    }

    // Load conversation history for context
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, session.id))
      .orderBy(messages.createdAt);

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // ── CALL OLLAMA ─────────────────────────
    const reply = await callOllama({
      model: selectedModel,
      messages: apiMessages,
    });


    // Persist both messages
    await db.insert(messages).values([
      { sessionId: session.id, role: 'user',      content: message },
      { sessionId: session.id, role: 'assistant', content: reply   },
    ]);

    return c.json({
      reply,
      sessionId: session.id,
      sessionTitle: isNewSession ? session.title : undefined,
    });

  } catch (err) {
    console.error('Chat error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ── GET /sessions ─────────────────────────────────────────────────
app.get('/sessions', async (c) => {
  const list = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.updatedAt))
    .limit(50);

  return c.json(list.map(s => ({
    id: s.id,
    title: s.title,
    model: s.model,
    createdAt: s.createdAt,
  })));
});

// ── GET /sessions/:id/messages ────────────────────────────────────
app.get('/sessions/:id/messages', async (c) => {
  const { id } = c.req.param();
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.createdAt);

  return c.json(msgs.map(m => ({ role: m.role, content: m.content })));
});

// ── DELETE /sessions/:id ──────────────────────────────────────────
app.delete('/sessions/:id', async (c) => {
  const { id } = c.req.param();
  await db.delete(sessions).where(eq(sessions.id, id));
  return c.json({ ok: true });
});

// ── START ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});
console.log(`\n🚀 GuideAI backend running on http://localhost:${PORT}`);
console.log(`   POST /chat`);
console.log(`   GET  /sessions`);
console.log(`   GET  /sessions/:id/messages`);
console.log(`   DELETE /sessions/:id\n`);
#!/usr/bin/env node
import http from 'node:http';

const KB = {
  'world-facts-001': 'Paris is the capital of France.',
  'books-tech-042': 'The Pragmatic Programmer was written by Andrew Hunt and David Thomas.',
  'web-basics-007': 'HTTP stands for HyperText Transfer Protocol.',
  'other-001': 'Pluto is a dwarf planet.',
  'other-002': 'The Eiffel Tower is in Paris.',
};

function naiveSearch(query) {
  const q = query.toLowerCase();
  const scored = Object.entries(KB).map(([id, text]) => ({
    id,
    text,
    score: text.toLowerCase().split(' ').filter((w) => q.includes(w)).length,
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/rag') {
    res.writeHead(404).end('Not found');
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400).end('Bad JSON');
      return;
    }
    const query = payload.query ?? '';
    const top = naiveSearch(query);
    const answer = top[0]?.text ?? "I don't know.";
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        answer,
        sources: top.map((t) => ({ id: t.id, score: t.score })),
      }),
    );
  });
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`Mock RAG server on http://localhost:${PORT}/api/rag`);
});

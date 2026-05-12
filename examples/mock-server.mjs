#!/usr/bin/env node
import http from 'node:http';

const KB = {
  'docs-sso-reset':
    "To reset SSO: Navigate to Settings, click SSO section, then click 'Reset SSO config'. Re-upload your IDP metadata XML file. Changes take effect immediately.",
  'docs-webhooks-plans':
    "The subscription.plan_changed webhook fires whenever a plan changes. The payload includes an 'action' field with values like 'upgrade', 'downgrade', or 'cancel'.",
  'docs-api-limits':
    'API rate limits: Free tier allows 100 requests per minute with a daily cap of 10000 requests. Paid tiers have higher limits.',
  'docs-security-2fa':
    'Two-factor authentication: Go to Account, then Security, then Two-Factor Authentication. Scan the QR code shown with any TOTP authenticator app (Google Authenticator, Authy, 1Password). Enter the 6-digit code to confirm activation.',
  'docs-export-csv':
    'Data export to CSV: Visit Settings, click Data Export, select CSV format, click Export. The download link will be emailed to you within 5 minutes.',
  'docs-billing-invoices':
    'Past invoices are available in Settings, Billing, Invoice History. Click any invoice to download as PDF.',
  'docs-team-roles':
    'Team roles: Owner (full access), Admin (manage settings), Member (use product), Viewer (read-only).',
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
        sources: top.map((t) => ({ id: t.id, score: t.score, content: t.text })),
      }),
    );
  });
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`Mock RAG server on http://localhost:${PORT}/api/rag`);
});

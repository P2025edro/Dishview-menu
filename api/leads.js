// POST /api/leads — public "request a demo" form · GET — list enquiries (super admin)
// Each enquiry is stored in Blob; if RESEND_API_KEY and LEAD_EMAIL are set it is also emailed.
import { put, list } from '@vercel/blob';
import { handler, json, bad, readBody, getSession } from './_lib.js';
const s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const POST = handler(async req => {
  const b = await readBody(req, 6000);
  if (b.website) return json({ ok: true }); // honeypot field: bots fill it, people never see it
  const lead = { name: s(b.name, 100), restaurant: s(b.restaurant, 120), email: s(b.email, 160), phone: s(b.phone, 40), message: s(b.message, 2000), at: new Date().toISOString() };
  if (!lead.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return bad('Please add your name and a valid email');
  await put(`leads/${lead.at.slice(0, 10)}.json`, JSON.stringify(lead), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
  if (process.env.RESEND_API_KEY && process.env.LEAD_EMAIL) {
    const text = Object.entries(lead).map(([k, v]) => `${k}: ${v}`).join('\n');
    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.LEAD_FROM || 'Dishview <onboarding@resend.dev>', to: [process.env.LEAD_EMAIL], reply_to: lead.email, subject: `Dishview demo request — ${lead.restaurant || lead.name}`, text }),
    }).catch(e => console.error('email failed', e));
  }
  return json({ ok: true }, 201);
});
export const GET = handler(async req => {
  if (getSession(req)?.role !== 'super') return bad('Forbidden', 403);
  const { blobs } = await list({ prefix: 'leads/', limit: 500 });
  const items = await Promise.all(blobs.map(b => fetch(b.url).then(r => r.json()).catch(() => null)));
  return json(items.filter(Boolean).sort((a, b) => b.at.localeCompare(a.at)));
});

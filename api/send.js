import { Resend } from 'resend';

const escape = (s) =>
  String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

const sanitize = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').slice(0, max).trim();

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;

const FIELD_LABELS_DE = {
  name: 'Name',
  email: 'E-Mail',
  phone: 'Telefon',
  company: 'Firma',
  service: 'Leistung',
  service_type: 'Art des Transports',
  pickup_address: 'Abholadresse',
  delivery_address: 'Lieferadresse',
  weight: 'Gewicht',
  dimensions: 'Maße',
  date_needed: 'Wunschtermin',
  is_hazardous: 'Gefahrgut',
  additional_info: 'Zusätzliche Informationen',
  message: 'Nachricht',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const { type, data, token, openedAt, hp } = body;

    // ── 1. Honeypot — silently accept (don't tell bot it failed) ──
    if (typeof hp === 'string' && hp.length > 0) {
      return res.status(200).json({ ok: true });
    }

    // ── 2. Time-trap (must be open at least 3s, max 4h) ──
    const elapsed = Date.now() - Number(openedAt || 0);
    if (!Number.isFinite(elapsed) || elapsed < 3000 || elapsed > 1000 * 60 * 60 * 4) {
      return res.status(400).json({ error: 'Bitte versuchen Sie es erneut.' });
    }

    // ── 3. Type whitelist ──
    if (type !== 'contact' && type !== 'quote') {
      return res.status(400).json({ error: 'Invalid type' });
    }
    if (typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // ── 4. IP (für Turnstile-Verifikation und Logging) ──
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : (fwd || '').toString()).split(',')[0].trim() || 'unknown';

    // ── 5. Verify Cloudflare Turnstile ──
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Sicherheitsprüfung fehlt.' });
    }
    const tsResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    });
    const tsJson = await tsResp.json().catch(() => ({}));
    if (!tsJson.success) {
      const codes = Array.isArray(tsJson['error-codes']) ? tsJson['error-codes'].join(', ') : 'unknown';
      console.error('Turnstile verify failed:', codes, 'fullResponse:', JSON.stringify(tsJson));
      return res.status(400).json({ error: `Bot-Verifizierung fehlgeschlagen (${codes}).` });
    }

    // ── 6. Validate & sanitize fields ──
    const fields = {};
    if (type === 'contact') {
      fields.name = sanitize(data.name, 100);
      fields.email = sanitize(data.email, 200);
      fields.phone = sanitize(data.phone, 50);
      fields.company = sanitize(data.company, 150);
      fields.service = sanitize(data.service, 100);
      fields.message = sanitize(data.message, 5000);
      if (!fields.name || !fields.email || !fields.message) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
      }
      if (!isEmail(fields.email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
      if (fields.message.length < 5) return res.status(400).json({ error: 'Nachricht zu kurz.' });
    } else {
      fields.name = sanitize(data.name, 100);
      fields.company = sanitize(data.company, 150);
      fields.email = sanitize(data.email, 200);
      fields.phone = sanitize(data.phone, 50);
      fields.service_type = sanitize(data.service_type, 100);
      fields.pickup_address = sanitize(data.pickup_address, 300);
      fields.delivery_address = sanitize(data.delivery_address, 300);
      fields.weight = sanitize(data.weight, 50);
      fields.dimensions = sanitize(data.dimensions, 50);
      fields.date_needed = sanitize(data.date_needed, 50);
      fields.is_hazardous = data.is_hazardous ? 'Ja' : 'Nein';
      fields.additional_info = sanitize(data.additional_info, 5000);
      if (!fields.name || !fields.email || !fields.phone || !fields.service_type || !fields.pickup_address || !fields.delivery_address) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
      }
      if (!isEmail(fields.email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }

    // Crude content spam check — too many URLs
    const allText = Object.values(fields).join(' ');
    const urlMatches = allText.match(/https?:\/\//gi) || [];
    if (urlMatches.length > 3) {
      return res.status(400).json({ error: 'Anfrage konnte nicht verarbeitet werden.' });
    }

    // ── 7. Build & send email ──
    const rows = Object.entries(fields)
      .filter(([_, v]) => v && v !== 'Nein' || _ === 'is_hazardous')
      .map(([k, v]) => {
        const label = FIELD_LABELS_DE[k] || k;
        return `<tr><td style="padding:8px 14px;background:#fafafa;border-bottom:1px solid #eee;font-weight:600;color:#111;width:200px">${escape(label)}</td><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#27272a">${escape(v).replace(/\n/g, '<br>')}</td></tr>`;
      })
      .join('');

    const subject = type === 'contact'
      ? `Neue Kontaktanfrage – ${fields.name}`
      : `Neue Angebotsanfrage – ${fields.name}`;

    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;margin:0;padding:24px">
<table style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7">
  <tr><td style="background:#111;color:#FFD400;padding:20px 24px;font-weight:700;font-size:18px;letter-spacing:.05em">TKS KURIER-SERVICE</td></tr>
  <tr><td style="padding:24px"><h2 style="margin:0 0 16px;font-size:20px;color:#111">${escape(subject)}</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:6px;overflow:hidden">${rows}</table>
  <p style="color:#71717a;font-size:12px;margin-top:24px">IP: ${escape(ip)} · Eingang: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</p>
  </td></tr>
</table></body></html>`;

    const missing = [];
    if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!process.env.RESEND_FROM)    missing.push('RESEND_FROM');
    if (!process.env.RESEND_TO)      missing.push('RESEND_TO');
    if (missing.length) {
      console.error('Missing env vars:', missing.join(', '));
      return res.status(500).json({ error: `Server-Konfiguration fehlt: ${missing.join(', ')}` });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendResult = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: process.env.RESEND_TO,
      reply_to: fields.email,
      subject,
      html,
    });

    if (sendResult && sendResult.error) {
      console.error('Resend error', sendResult.error);
      const msg = sendResult.error.message || 'Mail konnte nicht versendet werden.';
      return res.status(502).json({ error: `Resend: ${msg}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send error', err);
    return res.status(500).json({ error: `Server-Fehler: ${err && err.message ? err.message : 'unbekannt'}` });
  }
}

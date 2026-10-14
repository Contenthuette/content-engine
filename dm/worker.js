// Kommentar → DM mit Follow-Gate (Instagram API with Instagram Login) – Cloudflare Worker
// KV "DM":  kw:<KEYWORD> = {message, offer, active}   token = {access_token, refreshed_at}
//           st:<igsid>   = {kw, tries, at}               c:<comment_id> = 1 (dedupe)
// Vars/Secrets: VERIFY_TOKEN, APP_SECRET, IG_USER_ID, IG_HANDLE
const G = 'https://graph.instagram.com';
const FOLLOW_BTN = '✅ Ich folge dir';
const PUBLIC_REPLIES = ['Check deine DMs 👀', 'Hab dir geschrieben 📩', 'Schau in deine DMs 🔥', 'Ist unterwegs – check DMs ✉️', 'Gesendet 👀 schau in deine Nachrichten'];

const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json'}});
const norm = (s) => (s || '').toUpperCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function token(env) {
  const t = await env.DM.get('token', 'json');
  return t?.access_token;
}
async function ig(env, path, opts = {}) {
  const tk = await token(env);
  const url = `${G}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tk)}`;
  const r = await fetch(url, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) console.log('IG error', path, r.status, JSON.stringify(body));
  return {ok: r.ok, body};
}
const post = (env, path, payload) => ig(env, path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});

async function verifySig(req, raw, env) {
  const sig = req.headers.get('x-hub-signature-256') || '';
  if (!env.APP_SECRET) return true;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.APP_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sig === `sha256=${hex}`;
}

async function keywords(env) {
  const list = await env.DM.list({prefix: 'kw:'});
  return list.keys.map((k) => k.name.slice(3));
}
async function matchKeyword(env, text) {
  const words = new Set(norm(text).split(' '));
  for (const kw of await keywords(env)) {
    if (!words.has(norm(kw))) continue;
    const d = await env.DM.get('kw:' + kw, 'json');
    if (d && d.active !== false) return {kw, d};
  }
  return null;
}

async function followGate(env, igsid, kw, d, viaComment) {
  const handle = env.IG_HANDLE ? '@' + env.IG_HANDLE : 'mir';
  const text = `Hey! 👋 Folg ${handle} kurz, dann schick ich dir ${d.offer || 'alles'} direkt hier rein. Danach einfach auf „${FOLLOW_BTN}“ tippen 👇`;
  const qr = [{content_type: 'text', title: FOLLOW_BTN, payload: 'FOLLOW:' + kw}];
  const recipient = viaComment ? {comment_id: viaComment} : {id: igsid};
  let r = await post(env, 'me/messages', {recipient, message: {text, quick_replies: qr}});
  if (!r.ok) r = await post(env, 'me/messages', {recipient, message: {text: text.replace(`auf „${FOLLOW_BTN}“ tippen 👇`, 'kurz „fertig“ schreiben 👇')}});
  await env.DM.put('st:' + igsid, JSON.stringify({kw, tries: 0, at: Date.now()}), {expirationTtl: 60 * 60 * 24 * 14});
  return r.ok;
}

async function deliver(env, igsid, st) {
  const d = await env.DM.get('kw:' + st.kw, 'json');
  if (!d) return;
  const p = await ig(env, `${igsid}?fields=is_user_follow_business,username`);
  const follows = p.ok && p.body.is_user_follow_business === true;
  if (follows) {
    await post(env, 'me/messages', {recipient: {id: igsid}, message: {text: d.message}});
    await env.DM.delete('st:' + igsid);
    await env.DM.put(`log:${Date.now()}:${igsid}`, JSON.stringify({kw: st.kw, user: p.body.username, ok: true}), {expirationTtl: 60 * 60 * 24 * 90});
    return;
  }
  st.tries = (st.tries || 0) + 1;
  if (st.tries > 3) return;
  await env.DM.put('st:' + igsid, JSON.stringify(st), {expirationTtl: 60 * 60 * 24 * 14});
  const handle = env.IG_HANDLE ? '@' + env.IG_HANDLE : 'meinem Account';
  await post(env, 'me/messages', {recipient: {id: igsid}, message: {text: `Ich seh dich noch nicht als Follower 🙈 Folg ${handle} und tipp dann nochmal auf „${FOLLOW_BTN}“.`, quick_replies: [{content_type: 'text', title: FOLLOW_BTN, payload: 'FOLLOW:' + st.kw}]}});
}

async function onComment(env, v) {
  if (!v || !v.id || !v.from || v.from.id === env.IG_USER_ID) return;
  if (await env.DM.get('c:' + v.id)) return;
  await env.DM.put('c:' + v.id, '1', {expirationTtl: 60 * 60 * 24 * 30});
  const m = await matchKeyword(env, v.text);
  if (!m) return;
  const reply = PUBLIC_REPLIES[Math.floor(Math.random() * PUBLIC_REPLIES.length)];
  await post(env, `${v.id}/replies`, {message: reply});
  await followGate(env, v.from.id, m.kw, m.d, v.id);
}

async function onMessage(env, ev) {
  const igsid = ev.sender?.id;
  if (!igsid || igsid === env.IG_USER_ID || ev.message?.is_echo) return;
  const payload = ev.message?.quick_reply?.payload || ev.postback?.payload || '';
  const text = ev.message?.text || '';
  let st = await env.DM.get('st:' + igsid, 'json');
  if (payload.startsWith('FOLLOW:')) st = st || {kw: payload.slice(7), tries: 0};
  if (st && (payload.startsWith('FOLLOW:') || /\b(fertig|done|ok|folge|gefolgt|erledigt)\b|✅/i.test(text))) return deliver(env, igsid, st);
  const m = await matchKeyword(env, text); // someone DMs the keyword directly
  if (m) return followGate(env, igsid, m.kw, m.d, null);
}

const PRIVACY = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Datenschutz</title>
<body style="font-family:system-ui;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.55">
<h1>Datenschutzhinweis – Instagram-Nachrichten</h1>
<p>Dieser Dienst beantwortet Kommentare und Direktnachrichten auf unserem Instagram-Account automatisch. Verarbeitet werden
nur die Daten, die Instagram uns dafür übermittelt (Instagram-ID, Benutzername, Kommentar- bzw. Nachrichtentext, Follower-Status),
ausschließlich um dir die angefragten Inhalte zu senden. Zwischenstände werden höchstens 14 Tage, Protokolle höchstens 90 Tage
gespeichert und nicht weitergegeben.</p>
<p><b>Löschung:</b> Schreib uns per Instagram-DM „Daten löschen“, dann entfernen wir alle zu dir gespeicherten Einträge.</p></body>`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/privacy') return new Response(PRIVACY, {headers: {'content-type': 'text/html; charset=utf-8'}});
    if (url.pathname === '/health') return json({ok: true, keywords: await keywords(env), token: !!(await token(env))});
    if (url.pathname !== '/webhook') return new Response('not found', {status: 404});
    if (req.method === 'GET') {
      const q = url.searchParams;
      if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === env.VERIFY_TOKEN) return new Response(q.get('hub.challenge'));
      return new Response('forbidden', {status: 403});
    }
    const raw = await req.text();
    if (!(await verifySig(req, raw, env))) return new Response('bad signature', {status: 401});
    let body = {};
    try { body = JSON.parse(raw); } catch {}
    const jobs = [];
    for (const e of body.entry || []) {
      for (const ch of e.changes || []) if (ch.field === 'comments' || ch.field === 'live_comments') jobs.push(onComment(env, ch.value));
      for (const m of e.messaging || []) {
        if (/daten löschen/i.test(m.message?.text || '')) { jobs.push(env.DM.delete('st:' + m.sender.id)); continue; }
        jobs.push(onMessage(env, m));
      }
    }
    await Promise.allSettled(jobs);
    return new Response('EVENT_RECEIVED');
  },
  // keep the long-lived token alive (valid 60 days, refresh weekly)
  async scheduled(_ev, env) {
    const t = await env.DM.get('token', 'json');
    if (!t?.access_token) return;
    if (Date.now() - (t.refreshed_at || 0) < 6 * 24 * 3600 * 1000) return;
    const r = await fetch(`${G}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t.access_token)}`);
    const b = await r.json().catch(() => ({}));
    if (b.access_token) await env.DM.put('token', JSON.stringify({access_token: b.access_token, refreshed_at: Date.now()}));
  },
};

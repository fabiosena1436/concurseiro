import {createHash, timingSafeEqual} from 'node:crypto';
import * as admin from 'firebase-admin';
import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret, defineString} from 'firebase-functions/params';

const geminiKey = defineString('GEMINI_API_KEY');
const searchModel = defineString('GEMINI_SEARCH_MODEL', {default: 'gemini-2.5-flash'});
const botToken = defineSecret('TELEGRAM_BOT_TOKEN');
const webhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const allowedUsers = defineString('TELEGRAM_ALLOWED_USER_IDS', {default: ''});
const db = () => admin.firestore();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: unknown, size = 200) => typeof value === 'string' ? value.trim().slice(0, size) : '';
const now = () => new Date().toISOString();
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function officialUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    const official = ['cebraspe.org.br', 'conhecimento.fgv.br', 'vunesp.com.br', 'institutoaocp.org.br'];
    if (url.protocol !== 'https:' || url.username || url.password || !(/(^|\.)gov\.br$/.test(host) || /(^|\.)edu\.br$/.test(host) || official.some(domain => host === domain || host.endsWith(`.${domain}`)))) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {return null;}
}

export function linksInMessage(text: string): string[] {
  return [...new Set((text.match(/https:\/\/[^\s<>()]+/g) ?? []).map(value => value.replace(/[.,;!?]+$/, '')))].slice(0, 10);
}

async function queueOfficial(url: string, title: string, origin: string, note: string): Promise<boolean> {
  const canonical = officialUrl(url);
  if (!canonical) return false;
  const ref = db().collection('sourceCandidates').doc(hash(canonical));
  try {
    await ref.create({url: canonical, title: clean(title) || 'Prova a identificar', banca: 'A identificar', year: new Date().getFullYear(), orgao: new URL(canonical).hostname, cargo: '', status: 'pending', origin, note: clean(note, 500), discoveredAt: now(), discoveredBy: origin});
    return true;
  } catch (error: unknown) {
    if ((error as {code?: number}).code === 6 || (error as {code?: string}).code === 'already-exists') return false;
    throw error;
  }
}

type SearchResponse = {steps?: Array<{type?: string; content?: Array<{type?: string; text?: string; annotations?: Array<{type?: string; url?: string; title?: string}>}>}>};

export async function discoverOfficial(term: string): Promise<{added: number; found: number}> {
  const key = geminiKey.value();
  if (!key || key === 'disabled') throw new Error('GEMINI_API_KEY não configurada.');
  const query = clean(term, 120);
  if (query.length < 3) throw new Error('Informe um tema com pelo menos 3 caracteres.');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-goog-api-key': key, 'Api-Revision': '2026-05-20'},
    body: JSON.stringify({model: searchModel.value(), input: `Localize páginas oficiais de provas anteriores e gabaritos definitivos de concursos brasileiros relacionados a: ${query}. Priorize sites de órgãos públicos e bancas oficiais. Cite as URLs das páginas de origem. Não invente links.`, tools: [{type: 'google_search'}]}),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`Pesquisa Gemini falhou (HTTP ${response.status}).`);
  const body = await response.json() as SearchResponse;
  const candidates = (body.steps ?? []).flatMap(step => step.type === 'model_output' ? (step.content ?? []).flatMap(content => (content.annotations ?? []).filter(annotation => annotation.type === 'url_citation' && annotation.url).map(annotation => ({url: annotation.url!, title: annotation.title || content.text || query}))) : []);
  const unique = [...new Map(candidates.map(item => [officialUrl(item.url), item])).values()].filter(item => officialUrl(item.url)).slice(0, 20);
  let added = 0;
  for (const item of unique) if (await queueOfficial(item.url, item.title, 'web-search', `Busca: ${query}`)) added++;
  return {added, found: unique.length};
}

export const telegramWebhook = onRequest({secrets: [botToken, webhookSecret], timeoutSeconds: 30, cors: false}, async (request, response) => {
  if (request.method !== 'POST') {response.status(405).end(); return;}
  const expected = webhookSecret.value();
  const received = clean(request.headers['x-telegram-bot-api-secret-token'], 256);
  if (!expected || !safeEqual(received, expected)) {response.status(401).end(); return;}
  const update = request.body ?? {};
  const message = update.message ?? update.channel_post;
  const fromId = String(message?.from?.id ?? '');
  const permitted = new Set(allowedUsers.value().split(',').map(id => id.trim()).filter(Boolean));
  if (!message || !permitted.has(fromId)) {response.status(200).json({ok: true}); return;}
  const updateId = Number(update.update_id);
  if (!Number.isSafeInteger(updateId) || updateId < 0) {response.status(400).end(); return;}
  const inboxRef = db().collection('telegramInbox').doc(String(updateId));
  const caption = clean(message.caption || message.text, 2000);
  const links = linksInMessage(caption);
  const file = message.document;
  let created = true;
  try {
    await inboxRef.create({updateId, fromId, chatId: String(message.chat?.id ?? ''), messageId: message.message_id ?? null, text: caption, links, fileName: clean(file?.file_name), fileId: clean(file?.file_id, 300), fileUniqueId: clean(file?.file_unique_id, 300), mimeType: clean(file?.mime_type), fileSize: Number(file?.file_size ?? 0), status: 'pending', receivedAt: now()});
  } catch (error: unknown) {
    if ((error as {code?: number}).code === 6 || (error as {code?: string}).code === 'already-exists') created = false;
    else throw error;
  }
  let added = 0;
  for (const link of links) if (await queueOfficial(link, caption.slice(0, 150), 'telegram', `Telegram update ${updateId}`)) added++;
  if (created && message.chat?.type === 'private' && message.chat?.id) {
    await fetch(`https://api.telegram.org/bot${botToken.value()}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: message.chat.id, text: 'Recebido para análise. Links oficiais entram na fila; anexos ficam pendentes de revisão de origem e direitos.'}), signal: AbortSignal.timeout(5000)}).catch(error => console.error('Telegram acknowledgement failed:', error));
  }
  response.status(200).json({ok: true, queued: added});
});

export const scheduledDiscovery = onSchedule({schedule: '0 8 * * *', timeZone: 'America/Sao_Paulo', timeoutSeconds: 300}, async () => {
  const settings = (await db().collection('systemSettings').doc('discovery').get()).data();
  if (settings?.enabled !== true) return;
  const terms = Array.isArray(settings.terms) ? settings.terms.map((x: unknown) => clean(x, 120)).filter((x: string) => x.length >= 3).slice(0, 5) : [];
  for (const term of terms) {
    try {await discoverOfficial(term);} catch (error) {console.error('scheduledDiscovery:', term, error);}
  }
  await db().collection('systemSettings').doc('discovery').set({lastRunAt: now()}, {merge: true});
});

import {createHash, timingSafeEqual} from 'node:crypto';
import * as admin from 'firebase-admin';
import {onRequest} from 'firebase-functions/v2/https';
import {defineString} from 'firebase-functions/params';

const tavilyKey = defineString('TAVILY_API_KEY', {default: 'disabled'});
const cronKey = defineString('DISCOVERY_CRON_KEY', {default: 'disabled'});
const botToken = defineString('TELEGRAM_BOT_TOKEN', {default: 'disabled'});
const webhookSecret = defineString('TELEGRAM_WEBHOOK_SECRET', {default: 'disabled'});
const allowedUsers = defineString('TELEGRAM_ALLOWED_USER_IDS', {default: ''});
const allowedChats = defineString('TELEGRAM_ALLOWED_CHAT_IDS', {default: ''});
const db = () => admin.firestore();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: unknown, size = 200) => typeof value === 'string' ? value.trim().slice(0, size) : '';
const now = () => new Date().toISOString();
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const sendTelegramMessage = async (chatId: string | number, message: string) => {
  const result = await fetch(`https://api.telegram.org/bot${botToken.value()}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: chatId, text: message}), signal: AbortSignal.timeout(5000)});
  if (!result.ok) console.error('Telegram sendMessage HTTP', result.status);
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

type SearchResponse = {results?: Array<{url?: string; title?: string}>};

export function extractOfficialResults(body: SearchResponse): Array<{url: string; title: string}> {
  const unique = new Map<string, {url: string; title: string}>();
  for (const item of body.results ?? []) {
    const url = officialUrl(item.url);
    if (url && !unique.has(url)) unique.set(url, {url, title: clean(item.title) || 'Prova a identificar'});
  }
  return [...unique.values()].slice(0, 10);
}

export async function discoverOfficial(term: string): Promise<{added: number; found: number}> {
  const key = tavilyKey.value();
  if (!key || key === 'disabled') throw new Error('TAVILY_API_KEY não configurada.');
  const query = clean(term, 120);
  if (query.length < 3) throw new Error('Informe um tema com pelo menos 3 caracteres.');
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
    body: JSON.stringify({query: `prova concurso gabarito definitivo ${query}`, search_depth: 'basic', max_results: 10, include_domains: ['gov.br', 'edu.br', 'cebraspe.org.br', 'conhecimento.fgv.br', 'vunesp.com.br', 'institutoaocp.org.br'], include_domains_mode: 'restrict', country: 'brazil', language: 'pt', include_answer: false, include_raw_content: false, include_usage: true}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 429 || response.status === 432) throw new Error('A cota gratuita da Tavily acabou ou o limite de chamadas foi atingido. Aguarde a renovação mensal.');
    throw new Error(`Pesquisa Tavily falhou (HTTP ${response.status}).`);
  }
  const body = await response.json() as SearchResponse;
  const unique = extractOfficialResults(body);
  let added = 0;
  for (const item of unique) if (await queueOfficial(item.url, item.title, 'tavily-search', `Busca: ${query}`)) added++;
  return {added, found: unique.length};
}

export const telegramWebhook = onRequest({timeoutSeconds: 30, cors: false}, async (request, response) => {
  if (request.method !== 'POST') {response.status(405).end(); return;}
  const expected = webhookSecret.value();
  const received = clean(request.headers['x-telegram-bot-api-secret-token'], 256);
  if (!expected || expected === 'disabled' || !safeEqual(received, expected)) {response.status(401).end(); return;}
  const update = request.body ?? {};
  const message = update.message ?? update.channel_post;
  const fromId = String(message?.from?.id ?? '');
  if (message?.chat?.type === 'private' && /^\/id(?:@\w+)?$/i.test(String(message.text ?? '').trim()) && fromId) {
    await sendTelegramMessage(message.chat.id, `Seu ID de usuário: ${fromId}`).catch(error => console.error('Telegram /id failed:', error));
    response.status(200).json({ok: true}); return;
  }
  const userIds = new Set(allowedUsers.value().split(',').map(id => id.trim()).filter(Boolean));
  const chatIds = new Set(allowedChats.value().split(',').map(id => id.trim()).filter(Boolean));
  if (!message || (!userIds.has(fromId) && !chatIds.has(String(message.chat?.id ?? '')))) {response.status(200).json({ok: true}); return;}
  const updateId = Number(update.update_id);
  if (!Number.isSafeInteger(updateId) || updateId < 0) {response.status(400).end(); return;}
  const inboxRef = db().collection('telegramInbox').doc(String(updateId));
  const caption = clean(message.caption || message.text, 2000);
  const links = linksInMessage(caption);
  const file = message.document;
  const pdf = file && (file.mime_type === 'application/pdf' || /\.pdf$/i.test(file.file_name ?? '')) ? file : null;
  if (!links.length && !pdf) {response.status(200).json({ok: true}); return;}
  let created = true;
  try {
    await inboxRef.create({updateId, fromId, chatId: String(message.chat?.id ?? ''), messageId: message.message_id ?? null, text: caption, links, fileName: clean(pdf?.file_name), fileId: clean(pdf?.file_id, 300), fileUniqueId: clean(pdf?.file_unique_id, 300), mimeType: clean(pdf?.mime_type), fileSize: Number(pdf?.file_size ?? 0), status: 'pending', receivedAt: now()});
  } catch (error: unknown) {
    if ((error as {code?: number}).code === 6 || (error as {code?: string}).code === 'already-exists') created = false;
    else throw error;
  }
  let added = 0;
  for (const link of links) if (await queueOfficial(link, caption.slice(0, 150), 'telegram', `Telegram update ${updateId}`)) added++;
  if (created && message.chat?.type === 'private' && message.chat?.id) {
    await sendTelegramMessage(message.chat.id, 'Recebido para análise. Links oficiais entram na fila; anexos ficam pendentes de revisão de origem e direitos.').catch(error => console.error('Telegram acknowledgement failed:', error));
  }
  response.status(200).json({ok: true, queued: added});
});

export const configureTelegramWebhook = onRequest({timeoutSeconds: 30, cors: true}, async (request, response) => {
  try {
    if (request.method !== 'POST') {response.status(405).end(); return;}
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = token ? await admin.auth().verifyIdToken(token) : null;
    if (user?.admin !== true) {response.status(403).json({error: {message: 'Acesso restrito ao administrador.'}}); return;}
    const secret = webhookSecret.value();
    if (!secret || secret === 'disabled' || botToken.value() === 'disabled' || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error('Segredos do bot não configurados.');
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
    if (!projectId) throw new Error('Projeto Firebase não identificado.');
    const url = `https://us-central1-${projectId}.cloudfunctions.net/telegramWebhook`;
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken.value()}/setWebhook`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url, secret_token: secret, allowed_updates: ['message', 'channel_post'], drop_pending_updates: false, max_connections: 5}), signal: AbortSignal.timeout(15000)});
    const result = await telegramResponse.json() as {ok?: boolean; description?: string};
    if (!telegramResponse.ok || !result.ok) throw new Error(result.description || 'Telegram recusou o webhook.');
    response.status(200).json({data: {connected: true}});
  } catch (error) {
    console.error('configureTelegramWebhook:', error);
    response.status(503).json({error: {message: 'Não foi possível configurar o bot. Confira os segredos e a implantação das Functions.'}});
  }
});

export const telegramWebhookStatus = onRequest({timeoutSeconds: 20, cors: true}, async (request, response) => {
  try {
    if (request.method !== 'POST') {response.status(405).end(); return;}
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = token ? await admin.auth().verifyIdToken(token) : null;
    if (user?.admin !== true) {response.status(403).json({error: {message: 'Acesso restrito ao administrador.'}}); return;}
    if (botToken.value() === 'disabled') throw new Error('Token do bot não configurado.');
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
    if (!projectId) throw new Error('Projeto Firebase não identificado.');
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken.value()}/getWebhookInfo`, {signal: AbortSignal.timeout(10000)});
    const body = await telegramResponse.json() as {ok?: boolean; result?: {url?: string; pending_update_count?: number; last_error_message?: string}};
    if (!telegramResponse.ok || !body.ok) throw new Error('Telegram não informou o estado do webhook.');
    response.status(200).json({data: {connected: body.result?.url === `https://us-central1-${projectId}.cloudfunctions.net/telegramWebhook`, pending: body.result?.pending_update_count ?? 0, lastError: clean(body.result?.last_error_message, 300)}});
  } catch (error) {
    console.error('telegramWebhookStatus:', error);
    response.status(503).json({error: {message: 'Não foi possível consultar o Telegram. Confira o token e a rede da Function.'}});
  }
});

export const scheduledDiscovery = onRequest({timeoutSeconds: 30, cors: false}, async (request, response) => {
  if (request.method !== 'POST') {response.status(405).end(); return;}
  const expected = cronKey.value();
  const received = clean(request.headers['x-discovery-cron-key'], 256);
  if (!expected || expected === 'disabled' || !safeEqual(received, expected)) {response.status(401).end(); return;}
  const settingsRef = db().collection('systemSettings').doc('discovery');
  const settings = (await settingsRef.get()).data();
  if (settings?.enabled !== true) {response.status(200).json({skipped: 'disabled'}); return;}
  const terms = Array.isArray(settings.terms) ? settings.terms.map((x: unknown) => clean(x, 120)).filter((x: string) => x.length >= 3).slice(0, 5) : [];
  if (!terms.length) {response.status(200).json({skipped: 'no-terms'}); return;}
  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const runRef = db().collection('discoveryRuns').doc(date);
  try {await runRef.create({startedAt: now()});} catch (error: unknown) {
    if ((error as {code?: number}).code === 6 || (error as {code?: string}).code === 'already-exists') {response.status(200).json({skipped: 'already-run'}); return;}
    throw error;
  }
  const term = terms[Math.floor(Date.now() / 86400000) % terms.length];
  try {
    const result = await discoverOfficial(term);
    await Promise.all([runRef.update({status: 'completed', term, ...result}), settingsRef.set({lastRunAt: now()}, {merge: true})]);
    response.status(200).json({term, ...result});
  } catch (error) {
    console.error('scheduledDiscovery:', error);
    await runRef.update({status: 'failed', term, failedAt: now()});
    response.status(503).json({error: 'Busca diária falhou. Consulte os logs da Function.'});
  }
});

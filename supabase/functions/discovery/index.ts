import {createClient} from 'npm:@supabase/supabase-js@2';
import {createRemoteJWKSet, jwtVerify} from 'npm:jose@6';

const PROJECT_ID = 'simulado-concurso-ia';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const DOMAINS = ['gov.br', 'edu.br', 'cebraspe.org.br', 'conhecimento.fgv.br', 'vunesp.com.br', 'institutoaocp.org.br'];
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const env = (name: string) => Deno.env.get(name) || '';
const clean = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const reply = (body: unknown, status = 200, cors = false) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', ...(cors ? CORS : {})}});
const apiError = (message: string, status = 400) => reply({error: {message}}, status, true);
const requireData = <T>(result: {data: T | null; error: {message: string} | null}): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
};
const db = () => {
  if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Supabase não configurado.');
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {auth: {persistSession: false}});
};
const equal = (a: string, b: string) => {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
};
const adminUid = async (request: Request) => {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    const {payload} = await jwtVerify(token, JWKS, {issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID, algorithms: ['RS256']});
    return payload.admin === true && typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {return null;}
};

function canonicalUrl(value: unknown, officialOnly = false): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    if (officialOnly && !DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {return null;}
}
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');

async function queue(url: string, title: string, origin: string, note = '', extra: Record<string, unknown> = {}) {
  const normalized = canonicalUrl(url, origin !== 'manual');
  if (!normalized) return false;
  const row = {id: await sha256(normalized), url: normalized, title: clean(title) || 'Prova a identificar', year: new Date().getFullYear(), banca: 'A identificar', orgao: new URL(normalized).hostname, cargo: '', origin, note: clean(note, 500), discovered_by: origin, ...extra};
  const {data, error} = await db().from('source_candidates').upsert(row, {onConflict: 'id', ignoreDuplicates: true}).select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}

async function search(term: string) {
  const key = env('TAVILY_API_KEY');
  if (!key) throw new Error('TAVILY_API_KEY não configurada.');
  const query = clean(term, 120);
  if (query.length < 3) throw new Error('Informe um tema com pelo menos 3 caracteres.');
  const response = await fetch('https://api.tavily.com/search', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`}, body: JSON.stringify({query: `prova concurso gabarito definitivo ${query}`, search_depth: 'basic', max_results: 10, include_domains: DOMAINS, include_domains_mode: 'restrict', include_answer: false, include_raw_content: false}), signal: AbortSignal.timeout(20000)});
  if (response.status === 429 || response.status === 432) throw new Error('Cota gratuita da Tavily atingida. Aguarde a renovação.');
  if (!response.ok) throw new Error(`Pesquisa Tavily falhou (HTTP ${response.status}).`);
  const body = await response.json() as {results?: Array<{url?: string; title?: string}>};
  const unique = new Map<string, string>();
  for (const item of body.results ?? []) {
    const url = canonicalUrl(item.url, true);
    if (url && !unique.has(url)) unique.set(url, clean(item.title) || 'Prova a identificar');
  }
  let added = 0;
  for (const [url, title] of [...unique].slice(0, 10)) if (await queue(url, title, 'tavily-search', `Busca: ${query}`)) added++;
  return {added, found: Math.min(unique.size, 10)};
}

const telegram = async (method: string, data?: unknown) => {
  if (!env('TELEGRAM_BOT_TOKEN')) throw new Error('Token do bot não configurado.');
  const response = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {method: data ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(10000)});
  const body = await response.json() as {ok?: boolean; result?: Record<string, unknown>};
  if (!response.ok || !body.ok) throw new Error(`Telegram ${method} falhou (HTTP ${response.status}).`);
  return body.result ?? {};
};
const linksIn = (text: string) => [...new Set((text.match(/https:\/\/[^\s<>()]+/g) ?? []).map(link => link.replace(/[.,;!?]+$/, '')))].slice(0, 10);

async function webhook(request: Request) {
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (!secret || !equal(request.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) return reply({error: 'Unauthorized'}, 401);
  const update = await request.json();
  const message = update.message ?? update.channel_post;
  const fromId = String(message?.from?.id ?? '');
  if (message?.chat?.type === 'private' && /^\/id(?:@\w+)?$/i.test(String(message.text ?? '').trim()) && fromId) {
    await telegram('sendMessage', {chat_id: message.chat.id, text: `Seu ID de usuário: ${fromId}`});
    return reply({ok: true});
  }
  const users = new Set(env('TELEGRAM_ALLOWED_USER_IDS').split(',').map(x => x.trim()).filter(Boolean));
  const chats = new Set(env('TELEGRAM_ALLOWED_CHAT_IDS').split(',').map(x => x.trim()).filter(Boolean));
  if (!message || (!users.has(fromId) && !chats.has(String(message.chat?.id ?? '')))) return reply({ok: true});
  const id = Number(update.update_id);
  if (!Number.isSafeInteger(id) || id < 0) return reply({error: 'Invalid update'}, 400);
  const caption = clean(message.caption || message.text, 2000);
  const links = linksIn(caption);
  const file = message.document;
  const pdf = file && (file.mime_type === 'application/pdf' || /\.pdf$/i.test(file.file_name ?? '')) ? file : null;
  if (!links.length && !pdf) return reply({ok: true});
  const {data, error} = await db().from('telegram_inbox').upsert({id, from_id: fromId, chat_id: String(message.chat?.id ?? ''), message_id: Number(message.message_id) || null, text: caption, links, file_name: clean(pdf?.file_name), file_id: clean(pdf?.file_id, 300), file_unique_id: clean(pdf?.file_unique_id, 300), mime_type: clean(pdf?.mime_type), file_size: Number(pdf?.file_size ?? 0)}, {onConflict: 'id', ignoreDuplicates: true}).select('id').maybeSingle();
  if (error) throw error;
  if (data) {
    for (const link of links) await queue(link, caption.slice(0, 150), 'telegram', `Telegram update ${id}`);
    if (message.chat?.type === 'private') await telegram('sendMessage', {chat_id: message.chat.id, text: 'Recebido para análise. Links oficiais entram na fila; anexos aguardam revisão.'}).catch(console.error);
  }
  return reply({ok: true});
}

async function cron(request: Request) {
  const key = env('DISCOVERY_CRON_KEY');
  if (!key || !equal(request.headers.get('x-discovery-cron-key') ?? '', key)) return reply({error: 'Unauthorized'}, 401);
  const settings = requireData(await db().from('discovery_settings').select('*').eq('id', true).single());
  if (!settings.enabled) return reply({skipped: 'disabled'});
  const terms = Array.isArray(settings.terms) ? settings.terms.filter((x: unknown) => typeof x === 'string' && x.length >= 3).slice(0, 5) : [];
  if (!terms.length) return reply({skipped: 'no-terms'});
  const day = today();
  const {data, error} = await db().from('discovery_runs').upsert({day}, {onConflict: 'day', ignoreDuplicates: true}).select('day').maybeSingle();
  if (error) throw error;
  if (!data) return reply({skipped: 'already-run'});
  const term = terms[Math.floor(Date.now() / 86400000) % terms.length];
  try {
    const result = await search(term);
    requireData(await db().from('discovery_runs').update({status: 'completed', term, ...result, finished_at: new Date().toISOString()}).eq('day', day).select().single());
    requireData(await db().from('discovery_settings').update({last_run_at: new Date().toISOString()}).eq('id', true).select().single());
    return reply({term, ...result});
  } catch (error) {
    await db().from('discovery_runs').update({status: 'failed', term, finished_at: new Date().toISOString()}).eq('day', day);
    throw error;
  }
}

const candidate = (row: Record<string, unknown>) => ({id: row.id, title: row.title, year: row.year, banca: row.banca, orgao: row.orgao, cargo: row.cargo, url: row.url, status: row.status, discoveredAt: row.discovered_at});
const inbox = (row: Record<string, unknown>) => ({id: String(row.id), fromId: row.from_id, chatId: row.chat_id, messageId: row.message_id, text: row.text, links: row.links, fileName: row.file_name, mimeType: row.mime_type, fileSize: row.file_size, receivedAt: row.received_at, status: row.status});

async function adminAction(action: string, data: Record<string, unknown>, uid: string) {
  const client = db();
  if (action === 'getDiscoverySettings') {
    const row = requireData(await client.from('discovery_settings').select('*').eq('id', true).single());
    return {enabled: row.enabled, terms: row.terms, lastRunAt: row.last_run_at};
  }
  if (action === 'saveDiscoverySettings') {
    if (!Array.isArray(data.terms) || data.terms.length > 5 || data.terms.some(x => typeof x !== 'string' || x.trim().length < 3 || x.length > 120)) throw new Error('Informe até cinco temas de busca.');
    const row = requireData(await client.from('discovery_settings').update({enabled: data.enabled === true, terms: [...new Set((data.terms as string[]).map(x => x.trim()))], updated_at: new Date().toISOString(), updated_by: uid}).eq('id', true).select().single());
    return {enabled: row.enabled, terms: row.terms, lastRunAt: row.last_run_at};
  }
  if (action === 'importSourceCandidates') {
    if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100) throw new Error('Envie de 1 a 100 fontes por lote.');
    let added = 0, existing = 0;
    for (const item of data.items) {
      const source = item as Record<string, unknown>;
      const url = canonicalUrl(source?.url);
      const title = clean(source?.title), banca = clean(source?.banca, 100), year = Number(source?.year);
      if (!url || !title || !banca || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) throw new Error('Cada fonte precisa de título, banca, ano e URL HTTPS.');
      if (await queue(url, title, 'manual', '', {year, banca, orgao: clean(source.orgao, 100), cargo: clean(source.cargo, 100), discovered_by: uid})) added++; else existing++;
    }
    return {added, existing};
  }
  if (action === 'listSourceCandidates' || action === 'listTelegramInbox') {
    const table = action === 'listSourceCandidates' ? 'source_candidates' : 'telegram_inbox';
    const cursor = clean(data.cursor, 100);
    let query = client.from(table).select('*').order(table === 'source_candidates' ? 'discovered_at' : 'received_at', {ascending: false}).order('id', {ascending: false}).limit(51);
    if (cursor) {
      const previous = requireData(await client.from(table).select('*').eq('id', cursor).single());
      const timestamp = table === 'source_candidates' ? previous.discovered_at : previous.received_at;
      const column = table === 'source_candidates' ? 'discovered_at' : 'received_at';
      query = query.or(`${column}.lt.${timestamp},and(${column}.eq.${timestamp},id.lt.${cursor})`);
    }
    const rows = requireData(await query) as Record<string, unknown>[];
    return {items: rows.slice(0, 50).map(table === 'source_candidates' ? candidate : inbox), nextCursor: rows.length > 50 ? String(rows[49].id) : null};
  }
  if (action === 'reviewSourceCandidate') {
    const id = clean(data.id, 100), status = clean(data.status, 20);
    if (!/^[a-f0-9]{64}$/.test(id) || !['pending', 'accepted', 'rejected'].includes(status)) throw new Error('Revisão inválida.');
    const row = requireData(await client.from('source_candidates').update({status, reviewed_at: new Date().toISOString(), reviewed_by: uid}).eq('id', id).select('id').maybeSingle());
    if (!row) throw new Error('Fonte não encontrada.');
    return {id};
  }
  if (action === 'runDiscoverySearch') {
    const term = clean(data.term, 120);
    if (term.length < 3) throw new Error('Informe o tema da busca.');
    const day = today();
    const allowed = requireData(await client.rpc('reserve_discovery_search', {p_user_id: uid, p_day: day}));
    if (!allowed) throw new Error('Limite diário de 10 buscas atingido.');
    try {return await search(term);} catch (error) {await client.rpc('release_discovery_search', {p_user_id: uid, p_day: day}); throw error;}
  }
  if (action === 'configureTelegramWebhook' || action === 'telegramWebhookStatus') {
    const url = `${env('SUPABASE_URL')}/functions/v1/discovery?mode=telegram`;
    if (action === 'configureTelegramWebhook') {
      const secret = env('TELEGRAM_WEBHOOK_SECRET');
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error('Segredo do webhook não configurado.');
      await telegram('setWebhook', {url, secret_token: secret, allowed_updates: ['message', 'channel_post'], drop_pending_updates: false});
      return {connected: true};
    }
    const result = await telegram('getWebhookInfo');
    return {connected: result.url === url, pending: Number(result.pending_update_count ?? 0), lastError: clean(result.last_error_message, 300)};
  }
  throw new Error('Ação desconhecida.');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
  if (request.method !== 'POST') return apiError('Método inválido.', 405);
  try {
    const mode = new URL(request.url).searchParams.get('mode');
    if (mode === 'telegram') return await webhook(request);
    if (mode === 'cron') return await cron(request);
    const uid = await adminUid(request);
    if (!uid) return apiError('Acesso restrito ao administrador.', 403);
    const body = await request.json();
    const data = body?.data ?? {};
    return reply({data: await adminAction(clean(data.action, 40), data, uid)}, 200, true);
  } catch (error) {
    console.error('Discovery request failed:', error);
    return apiError(error instanceof Error ? error.message : 'Erro ao processar solicitação.', 503);
  }
});

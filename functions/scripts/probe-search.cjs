const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '..', '.env.simulado-concurso-ia');
const env = fs.readFileSync(envPath, 'utf8');
const line = env.split(/\r?\n/).find(value => /^GEMINI_API_KEY\s*=/.test(value));
const key = line?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
if (!key || key === 'disabled') throw new Error('GEMINI_API_KEY não configurada.');
const plain = process.argv.includes('--plain');
const requestedModel = process.argv.find(argument => argument.startsWith('--model='))?.slice('--model='.length);
const model = requestedModel && ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'].includes(requestedModel) ? requestedModel : 'gemini-3.8-flash';

fetch(plain ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` : 'https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'x-goog-api-key': key, 'Api-Revision': '2026-05-20'},
  body: JSON.stringify(plain ? {contents: [{parts: [{text: 'Responda apenas: OK'}]}]} : {model, input: 'Localize uma página oficial de prova de concurso público brasileiro e cite sua URL.', tools: [{type: 'google_search'}]}),
  signal: AbortSignal.timeout(30000),
}).then(async response => {
  const body = await response.json().catch(() => ({}));
  const citations = (body.steps ?? []).flatMap(step => step.content ?? []).flatMap(content => content.annotations ?? []).filter(annotation => annotation.type === 'url_citation').length;
  console.log(JSON.stringify({status: response.status, citations, errorStatus: body.error?.status ?? null, errorMessage: String(body.error?.message ?? '').replaceAll(key, '[REDACTED]').slice(0, 300), quota: (body.error?.details ?? []).map(detail => ({type: detail['@type'], violations: (detail.violations ?? []).map(violation => ({quotaId: violation.quotaId, quotaValue: violation.quotaValue}))})), keyReportedLeaked: /reported as leaked/i.test(String(body.error?.message ?? ''))}));
  if (!response.ok || (!plain && citations === 0)) process.exitCode = 1;
}).catch(error => {console.error('NETWORK_ERROR', error.message); process.exitCode = 1;});

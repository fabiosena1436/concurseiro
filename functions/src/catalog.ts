import {onRequest} from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {createHash} from 'node:crypto';
import {defineString} from 'firebase-functions/params';
import {AiProviderError, generateWithChatApi, isAiProvider} from './aiProviders';
import {discoverOfficial} from './discovery';

type Data = Record<string, any>;
const db = () => admin.firestore();
const importGeminiKey = defineString('GEMINI_API_KEY');
const importGeminiModel = defineString('GEMINI_MODEL', {default: 'gemini-3.5-flash-lite'});
const importGroqKey = defineString('GROQ_API_KEY', {default: 'disabled'});
const importOpenrouterKey = defineString('OPENROUTER_API_KEY', {default: 'disabled'});
const clean = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const now = () => new Date().toISOString();
const fields = ['banca', 'tipo', 'orgao', 'cargo', 'escolaridade', 'year', 'subject', 'paperId', 'search'];
const canonical = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
const facetValue = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex').slice(0, 20);
const titleWords = (value: unknown) => [...new Set(canonical(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(word => word.length >= 2))].slice(0, 8);
const fingerprint = (...parts: unknown[]) => createHash('sha256').update(parts.map(canonical).join('|')).digest('hex');
export const facets = (item: Data, kind: 'paper' | 'question') => {
  const result = new Set<string>([`${item.status}|`]);
  for (const field of fields) {
    const values = field === 'subject' && kind === 'paper' ? item.materias : field === 'search' && kind === 'paper' ? titleWords(item.title) : [item[field]];
    const entries = [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(value => `${field}=${field === 'search' ? facetValue(titleWords(value)[0]) : facetValue(value)}`))];
    for (const key of [...result]) for (const entry of entries) result.add(`${key}${key.endsWith('|') ? '' : '&'}${entry}`);
  }
  return [...result];
};
export const filterKey = (status: string, filters: Data) => `${status}|${fields.filter(key => canonical(filters?.[key]) !== '').map(key => `${key}=${key === 'search' ? facetValue(titleWords(filters[key])[0]) : facetValue(filters[key])}`).join('&')}`;
const out = (doc: FirebaseFirestore.DocumentSnapshot) => ({id: doc.id, ...doc.data()});
const attemptQuestion = (doc: FirebaseFirestore.DocumentSnapshot) => {const q = doc.data()!; return {id: doc.id, paperId: q.paperId, text: q.text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, subject: q.subject, topic: q.topic, banca: q.banca, year: q.year, number: q.number, adapted: q.adapted};};
const fail = (status: number, message: string): never => {throw Object.assign(new Error(message), {status});};
const adminOnly = (user: admin.auth.DecodedIdToken | null) => {if (user?.admin !== true) fail(403, 'Acesso restrito ao administrador.');};
const requireUser = (user: admin.auth.DecodedIdToken | null) => {if (!user) fail(401, 'Entre na sua conta.');};
const paperFields = ['title', 'banca', 'concurso', 'orgao', 'tipo', 'cargo', 'escolaridade', 'pdfPath'];
export const validPaper = (p: Data) => {
  if (paperFields.some(k => !clean(p[k], 500)) || !Number.isInteger(p.year) || p.year < 1900 || p.year > new Date().getFullYear() + 1 || !Array.isArray(p.materias) || !p.materias.length || p.materias.length > 5 || p.materias.some((s: unknown) => !clean(s))) fail(400, 'Preencha os dados obrigatórios da prova (até cinco matérias).');
  if (!/^papers\/[A-Za-z0-9_-]+\/exam-[A-Za-z0-9_-]+\.pdf$/.test(p.pdfPath)) fail(400, 'Caminho do PDF inválido.');
  if (p.answerKeyPath && !/^papers\/[A-Za-z0-9_-]+\/answer-[A-Za-z0-9_-]+\.pdf$/.test(p.answerKeyPath)) fail(400, 'Caminho do gabarito inválido.');
  if (p.sourceUrl && !/^https?:\/\//i.test(p.sourceUrl)) fail(400, 'Informe uma URL de origem válida.');
};
export const validQuestion = (q: Data, publishing: boolean) => {
  if (!clean(q.paperId) || !['multiple', 'true_false'].includes(q.format) || !['draft', 'published', 'archived'].includes(q.status)) fail(400, 'Dados da questão inválidos.');
  if (!publishing) return;
  if (!clean(q.text, 5000) || q.text.length > 5000 || !clean(q.sourceText, 20000) || q.sourceText.length > 20000 || !clean(q.subject) || !clean(q.topic) || !clean(q.explanation, 3000) || q.explanation.length > 3000 || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 || q.options.some((x: unknown) => typeof x !== 'string' || !clean(x, 1000) || x.length > 1000) || (q.format === 'true_false' && (q.options.length !== 2 || q.options[0] !== 'Certo' || q.options[1] !== 'Errado')) || !Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length || !Array.isArray(q.warnings) || q.warnings.length > 0) fail(400, 'Revise texto, opções, explicação, avisos e confirme o gabarito antes de publicar.');
};
const publicOrAdmin = (doc: FirebaseFirestore.DocumentSnapshot, user: admin.auth.DecodedIdToken | null) => {
  if (!doc.exists || (doc.data()?.status !== 'published' && user?.admin !== true)) fail(404, 'Conteúdo não encontrado.');
};
const checkPdf = async (path: string) => {
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) fail(400, 'Envie o PDF antes de salvar.');
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  const [header] = await file.download({start: 0, end: 4});
  if (metadata.contentType !== 'application/pdf' || size < 5 || size > 20 * 1024 * 1024 || header.toString('ascii') !== '%PDF-') fail(400, 'Arquivo inválido: envie um PDF de até 20 MB.');
};
const taxonomyKeys = ['bancas', 'concursos', 'orgaos', 'tipos', 'cargos', 'escolaridades', 'materias', 'assuntos'];
const emptyTaxonomy = () => Object.fromEntries(taxonomyKeys.map(key => [key, []]));
const standard = (value: string, values: string[]) => values.find(item => canonical(item) === canonical(value)) ?? value;
const normalizePaper = (p: Data, t: Data) => ({...p, banca: standard(p.banca, t.bancas), concurso: standard(p.concurso, t.concursos), orgao: standard(p.orgao, t.orgaos), tipo: standard(p.tipo, t.tipos), cargo: standard(p.cargo, t.cargos), escolaridade: standard(p.escolaridade, t.escolaridades), materias: Array.isArray(p.materias) ? p.materias.map((value: string) => standard(value, t.materias)) : []});
const sourceKey = (url: string) => createHash('sha256').update(url).digest('hex');
const normalizeSourceUrl = (value: unknown) => {
  const raw = clean(value, 1000);
  let url: URL;
  try { url = new URL(raw); } catch { return fail(400, 'URL de origem inválida.'); }
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) fail(400, 'Use uma URL HTTPS pública de órgão ou banca.');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
};

export const catalogApi = onRequest({timeoutSeconds: 120, cors: true}, async (request, response) => {
  try {
    if (request.method !== 'POST') fail(405, 'Método inválido.');
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = token ? await admin.auth().verifyIdToken(token) : null;
    const data = request.body?.data ?? {};
    const action = clean(data.action, 40);
    let result: unknown;
    if (action === 'getTaxonomy') {
      const saved = (await db().collection('systemSettings').doc('taxonomy').get()).data() ?? {};
      result = Object.fromEntries(taxonomyKeys.map(key => [key, Array.isArray(saved[key]) ? saved[key] : []]));
    } else if (action === 'saveTaxonomy') {
      adminOnly(user);
      const input = data.taxonomy ?? {};
      const normalized: Data = {};
      for (const key of taxonomyKeys) {
        if (!Array.isArray(input[key]) || input[key].length > 200) fail(400, 'Taxonomia inválida.');
        const values = input[key].map((x: unknown) => clean(x, 100)).filter(Boolean);
        normalized[key] = values.filter((value: string, index: number) => values.findIndex((other: string) => canonical(other) === canonical(value)) === index);
      }
      await db().collection('systemSettings').doc('taxonomy').set({...normalized, updatedAt: now(), updatedBy: user!.uid});
      result = normalized;
    } else if (action === 'importSourceCandidates') {
      adminOnly(user);
      if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100) fail(400, 'Envie de 1 a 100 fontes por lote.');
      const collection = db().collection('sourceCandidates');
      const batch = db().batch();
      const seen = new Set<string>();
      let added = 0;
      let existing = 0;
      for (const item of data.items) {
        const url = normalizeSourceUrl(item?.url);
        const title = clean(item?.title, 200);
        const banca = clean(item?.banca, 100);
        const year = Number(item?.year);
        if (!title || !banca || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) fail(400, 'Cada fonte precisa de título, banca, ano e URL HTTPS.');
        const id = sourceKey(url);
        if (seen.has(id)) {existing++; continue;}
        seen.add(id);
        const ref = collection.doc(id);
        if ((await ref.get()).exists) {existing++; continue;}
        batch.set(ref, {url, title, banca, year, orgao: clean(item?.orgao, 100), cargo: clean(item?.cargo, 100), status: 'pending', discoveredAt: now(), discoveredBy: user!.uid, note: clean(item?.note, 500)});
        added++;
      }
      if (added) await batch.commit();
      result = {added, existing};
    } else if (action === 'listSourceCandidates') {
      adminOnly(user);
      const collection = db().collection('sourceCandidates');
      let query = collection.orderBy('discoveredAt', 'desc').limit(51);
      if (typeof data.cursor === 'string' && data.cursor) {
        const cursor = await collection.doc(data.cursor).get();
        if (cursor.exists) query = query.startAfter(cursor);
      }
      const docs = (await query.get()).docs;
      result = {items: docs.slice(0, 50).map(out), nextCursor: docs.length > 50 ? docs[49].id : null};
    } else if (action === 'reviewSourceCandidate') {
      adminOnly(user);
      const id = clean(data.id, 100);
      if (!/^[a-f0-9]{64}$/.test(id) || !['pending', 'accepted', 'rejected'].includes(data.status)) fail(400, 'Revisão inválida.');
      const ref = db().collection('sourceCandidates').doc(id);
      if (!(await ref.get()).exists) fail(404, 'Fonte não encontrada.');
      await ref.update({status: data.status, reviewedAt: now(), reviewedBy: user!.uid});
      result = {id};
    } else if (action === 'getDiscoverySettings') {
      adminOnly(user);
      const saved = (await db().collection('systemSettings').doc('discovery').get()).data() ?? {};
      result = {enabled: saved.enabled === true, terms: Array.isArray(saved.terms) ? saved.terms : [], lastRunAt: saved.lastRunAt ?? null};
    } else if (action === 'saveDiscoverySettings') {
      adminOnly(user);
      const terms = data.terms;
      if (!Array.isArray(terms) || terms.length > 5 || terms.some((x: unknown) => typeof x !== 'string' || x.trim().length < 3 || x.length > 120)) fail(400, 'Informe até cinco temas de busca.');
      await db().collection('systemSettings').doc('discovery').set({enabled: data.enabled === true, terms: [...new Set(terms.map((x: string) => x.trim()))], updatedAt: now(), updatedBy: user!.uid}, {merge: true});
      result = {enabled: data.enabled === true, terms};
    } else if (action === 'runDiscoverySearch') {
      adminOnly(user);
      const term = clean(data.term, 120);
      if (term.length < 3) fail(400, 'Informe o tema da busca.');
      const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
      const usageRef = db().collection('discoveryUsage').doc(`${user!.uid}_${day}`);
      await db().runTransaction(async transaction => {
        const usage = await transaction.get(usageRef);
        if ((usage.data()?.count ?? 0) >= 10) fail(429, 'Limite diário de 10 buscas atingido.');
        transaction.set(usageRef, {count: (usage.data()?.count ?? 0) + 1, day, userId: user!.uid}, {merge: true});
      });
      try {result = await discoverOfficial(term);} catch (error) {
        await usageRef.update({count: admin.firestore.FieldValue.increment(-1)});
        if (error instanceof Error && (error.message.includes('TAVILY_API_KEY') || error.message.includes('cota gratuita da Tavily'))) fail(503, error.message);
        throw error;
      }
    } else if (action === 'listTelegramInbox') {
      adminOnly(user);
      const collection = db().collection('telegramInbox');
      let query = collection.orderBy('receivedAt', 'desc').limit(51);
      if (typeof data.cursor === 'string' && data.cursor) {
        const cursor = await collection.doc(data.cursor).get();
        if (cursor.exists) query = query.startAfter(cursor);
      }
      const docs = (await query.get()).docs;
      result = {items: docs.slice(0, 50).map(out), nextCursor: docs.length > 50 ? docs[49].id : null};
    } else if (action === 'adminStats') {
      adminOnly(user);
      const entries = await Promise.all([
        db().collection('papers').where('status', '==', 'draft').count().get(),
        db().collection('papers').where('status', '==', 'published').count().get(),
        db().collection('bankQuestions').where('status', '==', 'draft').count().get(),
        db().collection('bankQuestions').where('status', '==', 'published').count().get(),
        db().collection('bankQuestions').where('status', '==', 'archived').count().get(),
      ]);
      result = {paperDrafts: entries[0].data().count, papersPublished: entries[1].data().count, questionDrafts: entries[2].data().count, questionsPublished: entries[3].data().count, questionsArchived: entries[4].data().count};
    } else if (action === 'studyHint') {
      requireUser(user);
      const questionId = clean(data.questionId, 100);
      const message = clean(data.message, 500);
      const question = await db().collection('bankQuestions').doc(questionId).get();
      if (!question.exists || question.data()?.status !== 'published') fail(404, 'Questão não encontrada.');
      const setting = (await db().collection('systemSettings').doc('ai').get()).data()?.activeProvider;
      const provider = isAiProvider(setting) ? setting : 'gemini';
      const key = provider === 'groq' ? importGroqKey.value() : provider === 'openrouter' ? importOpenrouterKey.value() : importGeminiKey.value();
      if (!key || key === 'disabled') fail(503, 'Assistente indisponível no momento.');
      const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
      const usageRef = db().collection('studyHintUsage').doc(`${user!.uid}_${day}`);
      await db().runTransaction(async transaction => {
        const usage = await transaction.get(usageRef);
        if ((usage.data()?.count ?? 0) >= 20) fail(429, 'Limite diário de 20 dicas atingido.');
        transaction.set(usageRef, {count: (usage.data()?.count ?? 0) + 1, userId: user!.uid, day}, {merge: true});
      });
      const q = question.data()!;
      const prompt = `Você é um tutor para concurso. Ajude o estudante a RACIOCINAR sobre a questão sem fornecer a letra, o gabarito ou a resposta final. Dê uma pista curta e uma pergunta orientadora. Se o conteúdo depender de lei ou fato atual, peça conferência na fonte atualizada. Se faltar figura, tabela ou contexto, diga isso.\nQuestão: ${clean(q.text, 5000)}\nAlternativas: ${JSON.stringify(q.options)}\nMatéria: ${clean(q.subject)}; assunto: ${clean(q.topic)}.\nPedido do estudante: ${message || 'Dê uma primeira dica.'}`;
      try {
        let hint: string;
        if (provider === 'gemini') {
          const model = new GoogleGenerativeAI(key).getGenerativeModel({model: importGeminiModel.value()});
          hint = (await model.generateContent(prompt)).response.text();
        } else hint = await generateWithChatApi(provider, key, prompt, 'Você é um tutor. Dê somente dicas, sem revelar a resposta ou letra correta.');
        result = {hint: clean(hint, 1800)};
      } catch (error) {
        await usageRef.update({count: admin.firestore.FieldValue.increment(-1)});
        throw error;
      }
    } else if (action === 'countQuestions') {
      const filters = data.filters && typeof data.filters === 'object' ? data.filters : {};
      const count = await db().collection('bankQuestions').where('facetKeys', 'array-contains', filterKey('published', filters)).count().get();
      result = {count: count.data().count};
    } else if (action === 'listPapers' || action === 'listQuestions') {
      const kind = action === 'listPapers' ? 'papers' : 'bankQuestions';
      const status = user?.admin === true && (data.status === 'draft' || data.status === 'archived') ? data.status : 'published';
      const filters = data.filters && typeof data.filters === 'object' ? data.filters : {};
      const key = filterKey(status, filters);
      const base = db().collection(kind);
      let query = base.where('facetKeys', 'array-contains', key).limit(21);
      if (typeof data.cursor === 'string' && data.cursor) {
        const cursor = await base.doc(data.cursor).get();
        if (cursor.exists) query = query.startAfter(cursor);
      }
      const docs = (await query.get()).docs;
      const visible = docs.slice(0, 20).map(out);
      result = {items: visible, nextCursor: docs.length > 20 ? docs[19].id : null};
    } else if (action === 'getPaper' || action === 'getQuestion') {
      const doc = await db().collection(action === 'getPaper' ? 'papers' : 'bankQuestions').doc(clean(data.id, 100)).get();
      publicOrAdmin(doc, user);
      result = out(doc);
    } else if (action === 'savePaper') {
      adminOnly(user);
      const id = clean(data.id, 100) || db().collection('papers').doc().id;
      if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(400, 'ID da prova inválido.');
      const rawInput = data.paper ?? {};
      const taxonomy = {...emptyTaxonomy(), ...(await db().collection('systemSettings').doc('taxonomy').get()).data()};
      const input: Data = normalizePaper(rawInput, taxonomy);
      validPaper(input);
      if (!new RegExp(`^papers/${id}/exam-[A-Za-z0-9_-]+[.]pdf$`).test(input.pdfPath) || (input.answerKeyPath && !new RegExp(`^papers/${id}/answer-[A-Za-z0-9_-]+[.]pdf$`).test(input.answerKeyPath))) fail(400, 'O arquivo não corresponde à prova.');
      await checkPdf(input.pdfPath);
      if (input.answerKeyPath) await checkPdf(input.answerKeyPath);
      const ref = db().collection('papers').doc(id);
      const old = await ref.get();
      const status = input.status === 'published' ? 'published' : 'draft';
      if (status === 'published' && input.rightsConfirmed !== true) fail(400, 'Confirme que o PDF pode ser disponibilizado.');
      const paperKey = fingerprint(input.title, input.year, input.banca, input.concurso, input.orgao, input.tipo, input.cargo);
      const samePaper = await db().collection('papers').where('paperKey', '==', paperKey).get();
      if (samePaper.docs.some(doc => doc.id !== id)) fail(409, 'Já existe uma prova com os mesmos dados de identificação.');
      const linked = await db().collection('bankQuestions').where('paperId', '==', id).get();
      if (status === 'draft' && linked.docs.some(doc => doc.data().status === 'published')) fail(409, 'Despublique as questões vinculadas antes de ocultar a prova.');
      const paper = {title: clean(input.title, 200), year: input.year, banca: clean(input.banca), concurso: clean(input.concurso), orgao: clean(input.orgao), tipo: clean(input.tipo), cargo: clean(input.cargo), escolaridade: clean(input.escolaridade), materias: [...new Set(input.materias.map((x: unknown) => clean(x)))], pdfPath: input.pdfPath, answerKeyPath: clean(input.answerKeyPath, 200), sourceUrl: clean(input.sourceUrl, 500), attribution: clean(input.attribution, 500), notes: clean(input.notes, 2000), rightsConfirmed: input.rightsConfirmed === true, rightsConfirmedBy: input.rightsConfirmed === true ? user!.uid : null, rightsConfirmedAt: input.rightsConfirmed === true ? now() : null, status, createdAt: old.data()?.createdAt ?? now(), updatedAt: now()};
      await ref.set({...paper, paperKey, facetKeys: facets(paper, 'paper')});
      const writer = db().bulkWriter();
      for (const doc of linked.docs) {
        const q = {...doc.data(), banca: paper.banca, year: paper.year, concurso: paper.concurso, tipo: paper.tipo, orgao: paper.orgao, cargo: paper.cargo, escolaridade: paper.escolaridade};
        writer.update(doc.ref, {...q, facetKeys: facets(q, 'question')});
      }
      await writer.close();
      await Promise.all([old.data()?.pdfPath !== paper.pdfPath ? old.data()?.pdfPath : null, old.data()?.answerKeyPath !== paper.answerKeyPath ? old.data()?.answerKeyPath : null].filter(Boolean).map((path: string) => admin.storage().bucket().file(path).delete({ignoreNotFound: true}).catch(error => console.error('Old PDF cleanup failed:', error))));
      result = {id};
    } else if (action === 'deletePaper') {
      adminOnly(user);
      const id = clean(data.id, 100);
      const linked = await db().collection('bankQuestions').where('paperId', '==', id).get();
      if (linked.docs.some(doc => doc.data().status !== 'archived')) fail(409, 'Arquive todas as questões vinculadas antes de excluir a prova. Tentativas concluídas continuarão disponíveis.');
      const ref = db().collection('papers').doc(id);
      const old = await ref.get();
      if (!old.exists) fail(404, 'Prova não encontrada.');
      await ref.delete();
      await Promise.all([old.data()?.pdfPath, old.data()?.answerKeyPath].filter(Boolean).map((path: string) => admin.storage().bucket().file(path).delete({ignoreNotFound: true})));
      result = {id};
    } else if (action === 'saveQuestion') {
      adminOnly(user);
      const id = clean(data.id, 100) || db().collection('bankQuestions').doc().id;
      const input = {...(data.question ?? {})};
      const taxonomy = {...emptyTaxonomy(), ...(await db().collection('systemSettings').doc('taxonomy').get()).data()};
      input.subject = standard(input.subject, taxonomy.materias);
      input.topic = standard(input.topic, taxonomy.assuntos);
      const publishing = input.status === 'published';
      validQuestion(input, publishing);
      const paper = await db().collection('papers').doc(input.paperId).get();
      if (!paper.exists || (publishing && paper.data()?.status !== 'published')) fail(400, 'Prova de origem inexistente ou não publicada.');
      const ref = db().collection('bankQuestions').doc(id);
      const old = await ref.get();
      const dedupeKey = fingerprint(input.paperId, clean(input.number) || clean(input.text, 5000));
      if (publishing) {
        const duplicates = await db().collection('bankQuestions').where('dedupeKey', '==', dedupeKey).get();
        if (duplicates.docs.some(doc => doc.id !== id && doc.data().status === 'published')) fail(409, 'Já existe uma questão publicada com esse número ou enunciado nesta prova.');
      }
      const version = (old.data()?.version ?? 0) + 1;
      const q = {paperId: input.paperId, sourceText: clean(input.sourceText, 20000), number: clean(input.number, 30), page: Number.isInteger(input.page) ? input.page : null, adapted: input.adapted === true, text: clean(input.text, 20000), format: input.format, options: Array.isArray(input.options) ? input.options.slice(0, 5).map((x: unknown) => clean(x, 4000)) : [], correctAnswer: Number.isInteger(input.correctAnswer) ? input.correctAnswer : null, explanation: clean(input.explanation, 20000), observations: clean(input.observations, 2000), correctionReason: clean(input.correctionReason, 500), subject: clean(input.subject), topic: clean(input.topic), banca: paper.data()?.banca, year: paper.data()?.year, concurso: paper.data()?.concurso, tipo: paper.data()?.tipo, orgao: paper.data()?.orgao, cargo: paper.data()?.cargo, escolaridade: paper.data()?.escolaridade, status: input.status, warnings: Array.isArray(input.warnings) ? input.warnings.map((x: unknown) => clean(x)).filter(Boolean) : [], version, reviewedBy: publishing ? user!.uid : old.data()?.reviewedBy ?? null, reviewedAt: publishing ? now() : old.data()?.reviewedAt ?? null, createdAt: old.data()?.createdAt ?? now(), updatedAt: now()};
      const batch = db().batch();
      if (old.exists) batch.set(ref.collection('revisions').doc(String(version - 1)), {...old.data(), savedAt: now(), reason: q.correctionReason || 'Edição administrativa'});
      batch.set(ref, {...q, dedupeKey, facetKeys: facets(q, 'question')});
      await batch.commit();
      result = {id, version};
    } else if (action === 'deleteQuestion') {
      adminOnly(user);
      const ref = db().collection('bankQuestions').doc(clean(data.id, 100));
      const old = await ref.get();
      if (!old.exists) fail(404, 'Questão não encontrada.');
      const version = (old.data()?.version ?? 1) + 1;
      const batch = db().batch();
      batch.set(ref.collection('revisions').doc(String(version - 1)), {...old.data(), savedAt: now(), reason: clean(data.reason, 500) || 'Arquivamento'});
      batch.update(ref, {status: 'archived', facetKeys: facets({...old.data(), status: 'archived'}, 'question'), version, updatedAt: now()});
      await batch.commit();
      result = {id: ref.id};
    } else if (action === 'importDrafts') {
      adminOnly(user);
      if (typeof data.raw !== 'string' || data.raw.length > 18000) fail(400, 'Cole até 18 mil caracteres por importação.');
      const raw = clean(data.raw, 18000);
      const paper = await db().collection('papers').doc(clean(data.paperId, 100)).get();
      if (!paper.exists || raw.length < 20) fail(400, 'Selecione uma prova e cole o texto das questões.');
      const jobId = createHash('sha256').update(`${paper.id}|${raw}`).digest('hex');
      const jobRef = db().collection('importJobs').doc(jobId);
      const previous = await jobRef.get();
      if (previous.exists) {
        const docs = await db().getAll(...(previous.data()?.ids as string[]).map(id => db().collection('bankQuestions').doc(id)));
        result = {drafts: docs.filter(doc => doc.exists).map(out)};
      } else {
      const setting = (await db().collection('systemSettings').doc('ai').get()).data()?.activeProvider;
      const provider = isAiProvider(setting) ? setting : 'gemini';
      const key = provider === 'groq' ? importGroqKey.value() : provider === 'openrouter' ? importOpenrouterKey.value() : importGeminiKey.value();
      if (!key || key === 'disabled') fail(503, 'A IA de importação não está configurada.');
      const prompt = `Organize o texto copiado de uma prova em rascunhos. Preserve o sentido original. Não invente trechos, alternativas, explicações nem gabaritos. Cada item deve ter sourceText (trecho exato de origem), text (enunciado limpo), options (strings), format (multiple ou true_false), subject, topic, warnings (lista de problemas; sinalize imagem, tabela, fórmula ou texto incompleto). Responda JSON {"questions":[...]}, máximo 30. Texto:\n${raw}`;
      let content = '';
      try {
        if (provider === 'gemini') {
          const model = new GoogleGenerativeAI(key).getGenerativeModel({model: importGeminiModel.value(), generationConfig: {responseMimeType: 'application/json'}});
          content = (await model.generateContent(prompt)).response.text();
        } else content = await generateWithChatApi(provider, key, prompt, 'Transcreva e organize questões existentes sem inventar conteúdo ou gabarito. Responda somente JSON com a chave questions.');
      } catch (error: any) {
        if ((error instanceof AiProviderError && error.statusCode === 429) || /429|quota|too many requests/i.test(String(error?.message))) {
          await db().collection('systemSettings').doc('ai').set({quotaAlert: {provider, detectedAt: admin.firestore.FieldValue.serverTimestamp()}}, {merge: true});
          fail(429, 'A cota da IA ativa acabou. Troque o provedor na aba IA e tente novamente.');
        }
        fail(503, 'A IA falhou ao organizar o texto. Tente novamente sem criar duplicatas.');
      }
      let parsed: Data = {};
      try {parsed = JSON.parse(content);} catch {fail(502, 'A IA devolveu um formato inválido. Tente novamente.');}
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) fail(502, 'A IA não identificou questões completas. Revise o texto e tente novamente.');
      const draftData = parsed.questions.slice(0, 30).map((q: Data, index: number) => {const draft = {paperId: paper.id, sourceText: clean(q.sourceText, 20000) || raw, text: clean(q.text, 20000), options: Array.isArray(q.options) ? q.options.slice(0, 5).map((x: unknown) => clean(x, 4000)) : [], format: q.format === 'true_false' ? 'true_false' : 'multiple', subject: clean(q.subject), topic: clean(q.topic), warnings: Array.isArray(q.warnings) ? q.warnings.map((x: unknown) => clean(x)).filter(Boolean) : ['Confira a transcrição com o original.'], correctAnswer: null, explanation: '', adapted: false, status: 'draft', version: 1, banca: paper.data()?.banca, year: paper.data()?.year, concurso: paper.data()?.concurso, tipo: paper.data()?.tipo, orgao: paper.data()?.orgao, cargo: paper.data()?.cargo, escolaridade: paper.data()?.escolaridade, createdAt: now(), updatedAt: now()}; return {id: `${jobId.slice(0, 30)}-${index}`, ...draft};});
      const batch = db().batch();
      for (const draft of draftData) batch.set(db().collection('bankQuestions').doc(draft.id), {...draft, facetKeys: facets(draft, 'question')});
      batch.set(jobRef, {ids: draftData.map((d: Data) => d.id), paperId: paper.id, createdAt: now(), createdBy: user!.uid});
      await batch.commit();
      result = {drafts: draftData};
      }
    } else if (action === 'startFilteredAttempt') {
      requireUser(user);
      const quantity = data.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) fail(400, 'Escolha de 1 a 50 questões.');
      const filters = data.filters && typeof data.filters === 'object' ? data.filters : {};
      const found = await db().collection('bankQuestions').where('facetKeys', 'array-contains', filterKey('published', filters)).limit(quantity).get();
      if (found.empty) fail(400, 'Nenhuma questão disponível para esses filtros.');
      const ref = db().collection('bankAttempts').doc();
      await ref.set({userId: user!.uid, questionIds: found.docs.map(doc => doc.id), snapshot: found.docs.map(attemptQuestion), answers: {}, status: 'in_progress', createdAt: now()});
      result = {id: ref.id};
    } else if (action === 'startAttempt') {
      requireUser(user);
      const ids: string[] = Array.isArray(data.questionIds) ? [...new Set(data.questionIds)].filter((id): id is string => typeof id === 'string') : [];
      if (!ids.length || ids.length > 50 || ids.some((id: unknown) => typeof id !== 'string')) fail(400, 'Escolha de 1 a 50 questões.');
      const snapshots = await db().getAll(...ids.map((id: string) => db().collection('bankQuestions').doc(id)));
      if (snapshots.some(doc => !doc.exists || doc.data()?.status !== 'published')) fail(400, 'Uma das questões não está disponível.');
      const ref = db().collection('bankAttempts').doc();
      const attempt = {userId: user!.uid, questionIds: ids, snapshot: snapshots.map(attemptQuestion), answers: {}, status: 'in_progress', createdAt: now()};
      await ref.set(attempt);
      result = {id: ref.id};
    } else if (action === 'saveAttempt' || action === 'finishAttempt') {
      requireUser(user);
      const ref = db().collection('bankAttempts').doc(clean(data.id, 100));
      const attemptDoc = await ref.get();
      const attempt = attemptDoc.data();
      if (!attempt || attempt.userId !== user!.uid) fail(403, 'Treino indisponível.');
      if (attempt!.status === 'completed' && action === 'finishAttempt') {result = {score: attempt!.score}; response.status(200).json({data: result}); return;}
      if (attempt!.status !== 'in_progress') fail(409, 'Treino já concluído.');
      const rawAnswers = data.answers && typeof data.answers === 'object' ? data.answers : {};
      const answers: Record<string, number> = {};
      for (const q of attempt!.snapshot as Data[]) if (Number.isInteger(rawAnswers[q.id]) && rawAnswers[q.id] >= 0 && rawAnswers[q.id] < q.options.length) answers[q.id] = rawAnswers[q.id];
      if (action === 'finishAttempt') {
        const correct = (attempt!.snapshot as Data[]).filter(q => answers[q.id] === q.correctAnswer).length;
        const score = Math.round(correct / attempt!.snapshot.length * 10000) / 100;
        await ref.update({answers, status: 'completed', score, timeTaken: Math.max(0, Math.floor((Date.now() - new Date(attempt!.createdAt).getTime()) / 1000)), completedAt: now()});
        result = {score};
      } else {await ref.update({answers}); result = {saved: true};}
    } else if (action === 'getAttempt' || action === 'listAttempts') {
      requireUser(user);
      if (action === 'getAttempt') {
        const doc = await db().collection('bankAttempts').doc(clean(data.id, 100)).get();
        if (!doc.exists || (doc.data()?.userId !== user!.uid && user?.admin !== true)) fail(404, 'Treino não encontrado.');
        const attempt = out(doc) as Data;
        if (attempt.status === 'in_progress') attempt.snapshot = attempt.snapshot.map((q: Data) => {const {correctAnswer: _answer, explanation: _explanation, ...visible} = q; void _answer; void _explanation; return visible;});
        result = attempt;
      } else {
        let query = db().collection('bankAttempts').where('userId', '==', user!.uid).orderBy('createdAt', 'desc').limit(21);
        if (typeof data.cursor === 'string' && data.cursor) {
          const cursor = await db().collection('bankAttempts').doc(data.cursor).get();
          if (!cursor.exists || cursor.data()?.userId !== user!.uid) fail(400, 'Página inválida.');
          query = query.startAfter(cursor);
        }
        const docs = (await query.get()).docs;
        result = {items: docs.slice(0, 20).map(doc => {const a = doc.data(); return {id: doc.id, userId: a.userId, questionIds: a.questionIds, status: a.status, score: a.score ?? null, timeTaken: a.timeTaken ?? null, createdAt: a.createdAt, completedAt: a.completedAt ?? null};}), nextCursor: docs.length > 20 ? docs[19].id : null};
      }
    } else fail(400, 'Ação desconhecida.');
    response.status(200).json({data: result});
  } catch (error: any) {
    console.error('catalogApi:', error);
    response.status(error.status && Number.isInteger(error.status) ? error.status : 500).json({error: {message: error.status ? error.message : 'Não foi possível concluir a operação. Tente novamente.'}});
  }
});

export const catalogPdf = onRequest({timeoutSeconds: 60}, async (request, response) => {
  try {
    if (request.method !== 'GET') fail(405, 'Método inválido.');
    const id = clean(request.query.id, 100);
    const kind = request.query.kind === 'answer' ? 'answerKeyPath' : 'pdfPath';
    const paper = await db().collection('papers').doc(id).get();
    if (!paper.exists || paper.data()?.status !== 'published' || !paper.data()?.[kind]) fail(404, 'PDF não encontrado.');
    const file = admin.storage().bucket().file(paper.data()![kind]);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="${kind === 'pdfPath' ? 'prova' : 'gabarito'}.pdf"`);
    response.setHeader('Cache-Control', 'private, no-store');
    file.createReadStream().on('error', error => {console.error('catalogPdf:', error); if (!response.headersSent) response.status(500).end(); else response.destroy(error);}).pipe(response);
  } catch (error: any) {
    response.status(error.status && Number.isInteger(error.status) ? error.status : 500).send(error.status ? error.message : 'PDF indisponível.');
  }
});

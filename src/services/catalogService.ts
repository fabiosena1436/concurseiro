import {getStorage, ref, uploadBytes} from 'firebase/storage';
import {auth} from './firebase';
import type {BankAttempt, BankAttemptSummary, BankQuestion, CatalogFilters, DiscoverySettings, Paper, SourceCandidate, Taxonomy, TelegramInboxItem} from '../types/catalog';

const endpoint = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/catalogApi';
const discoveryEndpoint = import.meta.env.VITE_DISCOVERY_ENDPOINT || 'https://vgykwicsfguwlxztmiqp.supabase.co/functions/v1/discovery';

async function discoveryCall<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Entre na conta de administrador.');
  const response = await fetch(discoveryEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, body: JSON.stringify({data: {action, ...input}})});
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    const message = error && typeof error === 'object' && 'message' in error ? error.message : null;
    throw new Error(typeof message === 'string' ? message : 'Não foi possível carregar as fontes. Tente novamente.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Resposta inválida do servidor.');
  return payload.data as T;
}

export async function catalogCall<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})}, body: JSON.stringify({data: {action, ...input}})});
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    const message = error && typeof error === 'object' && 'message' in error ? error.message : null;
    throw new Error(typeof message === 'string' ? message : 'Não foi possível carregar o acervo. Tente novamente.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Resposta inválida do servidor.');
  return payload.data as T;
}

export type Page<T> = {items: T[]; nextCursor: string | null};
export const listPapers = (filters: CatalogFilters = {}, cursor?: string, status?: 'draft') => catalogCall<Page<Paper>>('listPapers', {filters, cursor, status});
export const listQuestions = (filters: CatalogFilters = {}, cursor?: string, status?: 'draft' | 'archived') => catalogCall<Page<BankQuestion>>('listQuestions', {filters, cursor, status});
export const getPaper = (id: string) => catalogCall<Paper>('getPaper', {id});
export const getQuestion = (id: string) => catalogCall<BankQuestion>('getQuestion', {id});
export const studyHint = (questionId: string, message: string) => catalogCall<{hint: string}>('studyHint', {questionId, message});
export const savePaper = (paper: Paper) => catalogCall<{id: string}>('savePaper', {id: paper.id, paper});
export const deletePaper = (id: string) => catalogCall<{id: string}>('deletePaper', {id});
export const saveQuestion = (question: BankQuestion) => catalogCall<{id: string; version: number}>('saveQuestion', {id: question.id, question});
export const deleteQuestion = (id: string) => catalogCall<{id: string}>('deleteQuestion', {id});
export const importDrafts = (paperId: string, raw: string) => catalogCall<{drafts: BankQuestion[]}>('importDrafts', {paperId, raw});
export const startAttempt = (questionIds: string[]) => catalogCall<{id: string}>('startAttempt', {questionIds});
export const startFilteredAttempt = (filters: CatalogFilters, quantity: number) => catalogCall<{id: string}>('startFilteredAttempt', {filters, quantity});
export const countQuestions = (filters: CatalogFilters) => catalogCall<{count: number}>('countQuestions', {filters});
export const adminStats = () => catalogCall<{paperDrafts: number; papersPublished: number; questionDrafts: number; questionsPublished: number; questionsArchived: number}>('adminStats');
export const getTaxonomy = () => catalogCall<Taxonomy>('getTaxonomy');
export const importSourceCandidates = (items: Array<Pick<SourceCandidate, 'title' | 'year' | 'banca' | 'orgao' | 'cargo' | 'url'>>) => discoveryCall<{added: number; existing: number}>('importSourceCandidates', {items});
export const listSourceCandidates = (cursor?: string) => discoveryCall<Page<SourceCandidate>>('listSourceCandidates', {cursor});
export const reviewSourceCandidate = (id: string, status: SourceCandidate['status']) => discoveryCall<{id: string}>('reviewSourceCandidate', {id, status});
export const getDiscoverySettings = () => discoveryCall<DiscoverySettings>('getDiscoverySettings');
export const saveDiscoverySettings = (enabled: boolean, terms: string[]) => discoveryCall<DiscoverySettings>('saveDiscoverySettings', {enabled, terms});
export const runDiscoverySearch = (term: string) => discoveryCall<{added: number; found: number}>('runDiscoverySearch', {term});
export const listTelegramInbox = (cursor?: string) => discoveryCall<Page<TelegramInboxItem>>('listTelegramInbox', {cursor});
export type TelegramWebhookStatus = {connected: boolean; pending: number; lastError: string};
async function telegramAdminCall<T>(functionName: 'configureTelegramWebhook' | 'telegramWebhookStatus'): Promise<T> {
  return discoveryCall<T>(functionName);
}
export const configureTelegramWebhook = () => telegramAdminCall<{connected: boolean}>('configureTelegramWebhook');
export const getTelegramWebhookStatus = () => telegramAdminCall<TelegramWebhookStatus>('telegramWebhookStatus');
export const saveTaxonomy = (taxonomy: Taxonomy) => catalogCall<Taxonomy>('saveTaxonomy', {taxonomy});
export const getAttempt = (id: string) => catalogCall<BankAttempt>('getAttempt', {id});
export const saveAttempt = (id: string, answers: Record<string, number>) => catalogCall<{saved: boolean}>('saveAttempt', {id, answers});
export const finishAttempt = (id: string, answers: Record<string, number>) => catalogCall<{score: number}>('finishAttempt', {id, answers});
export const listAttempts = (cursor?: string) => catalogCall<Page<BankAttemptSummary>>('listAttempts', {cursor});

export async function uploadPdf(paperId: string, file: File, name: 'exam' | 'answer'): Promise<string> {
  if ((file.type && file.type !== 'application/pdf') || !file.name.toLowerCase().endsWith('.pdf') || file.size > 20 * 1024 * 1024 || file.size === 0) throw new Error('Selecione um PDF de até 20 MB.');
  const path = `papers/${paperId}/${name}-${crypto.randomUUID()}.pdf`;
  await uploadBytes(ref(getStorage(), path), file, {contentType: 'application/pdf'});
  return path;
}

export const pdfUrl = (path: string) => {
  const match = /^papers\/([A-Za-z0-9_-]+)\/(exam|answer)-[A-Za-z0-9_-]+\.pdf$/.exec(path);
  if (!match) throw new Error('Caminho do PDF inválido.');
  return `https://us-central1-simulado-concurso-ia.cloudfunctions.net/catalogPdf?id=${encodeURIComponent(match[1])}&kind=${match[2]}`;
};

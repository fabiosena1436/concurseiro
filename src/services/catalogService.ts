import {getStorage, ref, uploadBytes} from 'firebase/storage';
import {auth} from './firebase';
import type {BankAttempt, BankAttemptSummary, BankQuestion, CatalogFilters, Paper, Taxonomy} from '../types/catalog';

const endpoint = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/catalogApi';

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

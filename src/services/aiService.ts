import { auth } from './firebase';
import type { Question } from '../types/exam';

const functionURL = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/generateQuestions';

const errorMessage = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object' || !('error' in value)) return undefined;
  const error = value.error;
  if (!error || typeof error !== 'object' || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
};

export const generateQuestionsFromBank = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'fundamental' | 'medio' | 'superior',
  editalContent?: string,
  existingQuestions?: { question: string }[],
  specificContent?: string
): Promise<Question[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Você precisa entrar na sua conta para gerar questões.');

  const token = await user.getIdToken();
  const response = await fetch(functionURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { subject, numQuestions, banca, difficulty, editalContent, existingQuestions, specificContent } }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload) ?? 'Não foi possível gerar questões agora. Tente novamente.');
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('A resposta da geração veio em um formato inesperado. Tente novamente.');
  }
  const questions = payload.data as Question[];
  if (questions.length !== numQuestions || questions.some(q => !q.question || !Array.isArray(q.options) || !Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length)) {
    throw new Error('As questões geradas vieram incompletas. Tente novamente.');
  }
  return questions;
};

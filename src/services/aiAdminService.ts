import { auth } from './firebase';

export type AiProvider = 'gemini' | 'groq' | 'openrouter';

export interface AiSettings {
  activeProvider: AiProvider;
  configured: Record<AiProvider, boolean>;
  quotaAlert: { provider: AiProvider; detectedAt: string | null } | null;
}

const endpoint = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/manageAiProvider';

const requestSettings = async (provider?: AiProvider): Promise<AiSettings> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Você precisa entrar como administrador.');
  const response = await fetch(endpoint, {
    method: provider ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(provider ? { 'Content-Type': 'application/json' } : {}) },
    ...(provider ? { body: JSON.stringify({ data: { provider } }) } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    const message = error && typeof error === 'object' && 'message' in error ? error.message : null;
    throw new Error(typeof message === 'string' ? message : 'Não foi possível configurar a IA.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.data) {
    throw new Error('Resposta inesperada do servidor.');
  }
  return payload.data as AiSettings;
};

export const getAiSettings = () => requestSettings();
export const selectAiProvider = (provider: AiProvider) => requestSettings(provider);

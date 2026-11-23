export type AiProvider = "gemini" | "groq" | "openrouter";

export class AiProviderError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

export const isAiProvider = (value: unknown): value is AiProvider =>
  value === "gemini" || value === "groq" || value === "openrouter";

const endpoints = {
  groq: {url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b"},
  openrouter: {url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/free"},
};

export const generateWithChatApi = async (
  provider: "groq" | "openrouter",
  apiKey: string,
  prompt: string,
  systemInstruction = 'Crie questões de concursos públicos brasileiros. Responda somente com um objeto JSON válido com a chave questions, sem Markdown.'
): Promise<string> => {
  const {url, model} = endpoints[provider];
  const result = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" ? {"HTTP-Referer": "https://concurseiro-beryl.vercel.app", "X-Title": "Simulado Concurso IA"} : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        {role: "system", content: systemInstruction},
        {role: "user", content: prompt},
      ],
      max_completion_tokens: 4096,
      ...(provider === "groq" ? {response_format: {type: "json_object"}} : {}),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!result.ok) {
    // Provider responses may contain account details. Keep them out of logs and UI.
    throw new AiProviderError(`A API ${provider} respondeu com HTTP ${result.status}.`, result.status);
  }
  const payload: unknown = await result.json();
  const content = (payload as {choices?: {message?: {content?: unknown}}[]})?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiProviderError("A IA retornou uma resposta vazia.", 502);
  }
  return content;
};

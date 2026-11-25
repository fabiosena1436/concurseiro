import {onRequest} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cors from "cors";
import {AiProvider, AiProviderError, generateWithChatApi, isAiProvider} from "./aiProviders";
export {catalogApi, catalogPdf} from './catalog';
export {telegramWebhook, configureTelegramWebhook, telegramWebhookStatus, scheduledDiscovery} from './discovery';

// 1. DEFINIÇÃO DE PARÂMETROS
// Trocado de OPENAI_KEY para GEMINI_API_KEY (Gratuita na cota padrão)
const geminiApiKey = defineString("GEMINI_API_KEY");
const geminiModelStr = defineString("GEMINI_MODEL", {default: "gemini-3.5-flash-lite"});
const groqApiKey = defineString("GROQ_API_KEY", {default: "disabled"});
const openrouterApiKey = defineString("OPENROUTER_API_KEY", {default: "disabled"});
const adminEmailsConfig = defineString("ADMIN_EMAILS", { default: "" });
const aiSettingsRef = () => admin.firestore().collection("systemSettings").doc("ai");

const getProviderKey = (provider: AiProvider): string => {
  if (provider === "groq") return groqApiKey.value() === "disabled" ? "" : groqApiKey.value();
  if (provider === "openrouter") return openrouterApiKey.value() === "disabled" ? "" : openrouterApiKey.value();
  return geminiApiKey.value();
};

const getActiveProvider = async (): Promise<AiProvider> => {
  const provider: unknown = (await aiSettingsRef().get()).data()?.activeProvider;
  return isAiProvider(provider) ? provider : "gemini";
};

const recordQuotaAlert = async (provider: AiProvider): Promise<void> => {
  await aiSettingsRef().set({
    quotaAlert: {provider, detectedAt: admin.firestore.FieldValue.serverTimestamp()},
  }, {merge: true});
};

// 2. CONFIGURAÇÃO DO CORS
// Lista de origens permitidas. Adicione a URL do seu app em produção aqui.
const whitelist = [
  'http://localhost:5173',
  'http://127.0.0.1:5173', // Adicionado para cobrir o acesso via IP local
  'https://concurseiro-three.vercel.app',
  'https://concurseiro-beryl.vercel.app'
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  }
};

const corsHandler = cors(corsOptions);

admin.initializeApp();

const bancaProfiles = {
  "Cespe/Cebraspe": "Famosa por questões no formato 'Certo' ou 'Errado', onde uma resposta errada anula uma certa. As questões são complexas, interdisciplinares e exigem muita atenção a detalhes e jurisprudência atualizada.",
  "Fundação Getúlio Vargas (FGV)": "Conhecida por questões longas, com textos e cenários complexos que exigem interpretação e raciocínio lógico. As alternativas são muitas vezes bem elaboradas para induzir ao erro.",
  "Fundação Cesgranrio": "Estilo mais direto e objetivo, com questões que cobram o conhecimento literal da lei ou do conteúdo. Menos interpretativa que a FGV ou o Cespe.",
  "Fundação Carlos Chagas (FCC)": "Alternativas geralmente longas e muito parecidas entre si, exigindo que o candidato conheça o 'decoreba' e a literalidade da lei. A jurisprudência também é cobrada com frequência.",
  "Vunesp": "Conhecida por enunciados diretos e cobrança literal da lei ('lei seca'). As questões frequentemente incluem 'pegadinhas' e detalhes específicos como prazos e exceções. O nível de dificuldade é considerado moderado, mas exige atenção.",
  "KLC": "Estilo de prova com questões objetivas, diretas e bem estruturadas. Foco em testar conhecimentos específicos e habilidades dos candidatos, com padrões de prova mais previsíveis.",
  "Outra": "Estilo genérico de múltipla escolha (A, B, C, D), focado na precisão do conteúdo e clareza.",
};

const difficultyProfiles = {
  'fundamental': "Questões de nível fundamental: Foco em conceitos básicos, definições diretas e conhecimento literal. As perguntas devem ser simples, claras e com vocabulário acessível.",
  'medio': "Questões de nível médio: Exige compreensão de conceitos, capacidade de relacionar informações e aplicar conhecimento em cenários simples. Pode incluir 'pegadinhas' e exigir mais atenção aos detalhes do que o nível fundamental.",
  'superior': "Questões de nível superior: Exige raciocínio complexo, análise crítica, interpretação de cenários abstratos e conhecimento aprofundado e específico da matéria. As alternativas devem ser sutis, bem elaboradas e plausíveis, testando a profundidade do conhecimento do candidato e sua capacidade de discernimento."
};

const getRelevantContext = (content: string): string => {
  if (!content) {
    return "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";
  }
  return content.substring(0, 4000);
};

const getAllowedAdminEmails = (): Set<string> => {
  const raw = adminEmailsConfig.value().trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
};

const requireAdminToken = async (request: any, response: any): Promise<admin.auth.DecodedIdToken | null> => {
  const idToken = request.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    response.status(401).send({ error: { message: "Unauthorized. No token provided." } });
    return null;
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Error verifying ID token:", error);
    response.status(401).send({ error: { message: "Unauthorized. Invalid token." } });
    return null;
  }

  const allowedAdmins = getAllowedAdminEmails();
  if (allowedAdmins.size === 0) {
    response.status(500).send({ error: { message: "ADMIN_EMAILS is not configured for this environment." } });
    return null;
  }

  const emailLower = decodedToken.email?.toLowerCase() ?? "";
  if (!allowedAdmins.has(emailLower)) {
    response.status(403).send({ error: { message: "Forbidden. Admin access required." } });
    return null;
  }

  return decodedToken;
};

const createPrompt = (data: {
  subject: string;
  numQuestions: number;
  banca: keyof typeof bancaProfiles;
  difficulty: keyof typeof difficultyProfiles;
  editalContent?: string;
  specificContent?: string; // NOVO CAMPO
  existingQuestions?: { question: string }[];
}) => {
  const { subject, numQuestions, banca, difficulty, editalContent, specificContent, existingQuestions } = data;
  const bancaStyle = bancaProfiles[banca] || bancaProfiles["Outra"];
  const context = getRelevantContext(editalContent || "");
  const hasEdital = !!editalContent && editalContent.trim() !== '' && context !== "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";

  // Tópico principal refinado com o conteúdo específico
  const topic = specificContent ? `${subject} (foco específico em: ${specificContent})` : subject;

  // Define o formato da questão e o número de opções
  const isCespe = banca === "Cespe/Cebraspe";
  const questionFormat = isCespe ? "'Certo' ou 'Errado'" : "Múltipla Escolha com 5 alternativas (A, B, C, D, E)";
  const optionsNote = isCespe
    ? "Para questões 'Certo ou Errado', o array de opções deve conter apenas duas strings: 'Certo' e 'Errado'."
    : "Para questões de Múltipla Escolha, o array de opções deve conter exatamente 5 strings, uma para cada alternativa (A, B, C, D, E).";

  const sourceOfTruth = hasEdital
    ? `**Fonte de Verdade (Contexto):** Use **EXCLUSIVAMENTE** as informações contidas na seção "CONTEXTO PARA QUESTÕES". Se o contexto for insuficiente, recuse-se a criar a questão.`
    : `**Fonte de Verdade (Conhecimento Geral):** Use seu conhecimento aprofundado sobre o **Tópico Principal**.`;

  const generationRules = hasEdital
    ? `1. **FIDELIDADE AO CONTEXTO:** Baseie-se **ESTRITAMENTE** no "CONTEXTO PARA QUESTÕES".`
    : `1. **BASE NO CONHECIMENTO:** Baseie-se em seu conhecimento sobre o **Tópico Principal**, garantindo precisão e relevância.`;

  const existingQuestionsSection = (existingQuestions && existingQuestions.length > 0)
    ? `
    **QUESTÕES EXISTENTES (PARA EVITAR REPETIÇÃO):**
    Abaixo estão as questões que já foram geradas. **NÃO GERE** questões semanticamente iguais ou muito parecidas com estas.
    ---
    ${existingQuestions.map((q) => `- ${q.question}`).join("\n")}
    ---
    `
    : "";
    
  // Mapeamento de dificuldade para texto
  const difficultyMap = {
    'fundamental': 'Ensino Fundamental',
    'medio': 'Ensino Médio',
    'superior': 'Ensino Superior'
  };
  const difficultyText = difficultyMap[difficulty] || "Nível não especificado";
  const difficultyDescription = difficultyProfiles[difficulty] || "Nível não especificado.";

  return `
    **Você é um Especialista em Concursos Públicos criando questões para a banca "${banca}".**
    **Missão:** Gerar ${numQuestions} questões **NOVAS E DISTINTAS** de altíssima qualidade sobre o **Tópico Principal: "${topic}"**.

    **ETAPA 1: REGRAS GERAIS**
    - **IDIOMA OBRIGATÓRIO:** Todo o conteúdo (enunciado, opções, explicação) deve ser gerado **estritamente em Português do Brasil**.
    - **Nível de Dificuldade:** ${difficultyText}.
    - **Detalhamento da Dificuldade:** ${difficultyDescription}.
    - **Estilo da Banca (${banca}):** ${bancaStyle}.
    - ${sourceOfTruth}
    - **Formato da Questão:** ${questionFormat}.
    ${existingQuestionsSection}
    **CONTEXTO PARA QUESTÕES (Use apenas se a Fonte de Verdade for 'Contexto'):**
    ---
    ${context}
    ---

    **ETAPA 2: REGRAS DE GERAÇÃO E FORMATAÇÃO**
    ${generationRules}
    2. **QUANTIDADE EXATA:** O array "questions" na saída JSON final deve conter **exatamente** ${numQuestions} objetos de questão.
    3. **EVITAR REPETIÇÃO:** É **PROIBIDO** criar questões que sejam semanticamente similares às listadas na seção "QUESTÕES EXISTENTES".
    4. **PROIBIDO META-QUESTÕES:** Não crie questões sobre "o contexto fornecido" ou a falta de informações. Foque apenas no **Tópico Principal**.
    5. **ESTRUTURA JSON OBRIGATÓRIA:** A saída final **DEVE** ser um único objeto JSON válido, contendo uma chave "questions", que é um array de objetos. Não inclua texto ou comentários fora do JSON.
    
    **ETAPA 3: ESTRUTURA DE CADA QUESTÃO NO JSON**
    Cada objeto no array "questions" deve ter a seguinte estrutura:
    {
      "question": "(string) O enunciado completo da pergunta.",
      "options": (string[]) Um array de strings. ${optionsNote},
      "correctAnswer": (number) O índice da resposta correta (0 para 'Certo' ou 'A', 1 para 'Errado' ou 'B', e assim por diante).
      "explanation": "(string) Uma explicação detalhada e clara, justificando a resposta correta com base na Fonte de Verdade."
    }
  `;
};

export const generateQuestions = onRequest({timeoutSeconds: 300}, (request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== "POST") {
      response.status(405).send({error: {message: "Method Not Allowed"}});
      return;
    }
    const idToken = request.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
      response.status(401).send({ error: { message: "Unauthorized. No token provided.", status: "UNAUTHENTICATED" } });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Error verifying ID token:", error);
      response.status(401).send({ error: { message: "Unauthorized. Invalid token.", status: "UNAUTHENTICATED" } });
      return;
    }

    const uid = decodedToken.uid;
    const userDocRef = admin.firestore().collection("users").doc(uid);

    let provider: AiProvider;
    try {
      provider = await getActiveProvider();
    } catch (error) {
      console.error("Failed to read active AI provider:", error);
      response.status(503).send({error: {message: "Não foi possível verificar a IA ativa."}});
      return;
    }
    const apiKey = getProviderKey(provider);

    if (!apiKey) {
      console.error(`A chave da API ${provider} não foi configurada.`);
      response.status(500).send({ error: { message: "A chave da API da IA não está configurada no servidor.", status: "FAILED_PRECONDITION" } });
      return;
    }
    
    const data = request.body?.data || {};
    const { subject, numQuestions, banca, difficulty, editalContent, existingQuestions, specificContent, title, displayBanca } = data;

    if (typeof subject !== 'string' || !subject.trim() || subject.length > 150 || typeof title !== 'string' || !title.trim() || title.length > 150 || numQuestions !== 10 || typeof banca !== 'string' || banca.length > 100 || !['fundamental', 'medio', 'superior'].includes(difficulty) || (editalContent !== undefined && typeof editalContent !== 'string') || (specificContent !== undefined && typeof specificContent !== 'string')) {
      response.status(400).send({ error: { message: "Argumentos 'subject', 'numQuestions', 'banca', e 'difficulty' são obrigatórios.", status: "INVALID_ARGUMENT" } });
      return;
    }

    let reserved = false;
    let succeeded = false;
    try {
      const allowed = await admin.firestore().runTransaction(async transaction => {
        reserved = false;
        const profile = await transaction.get(userDocRef);
        if (!profile.exists) return false;
        if (profile.data()?.isUnlocked === true) return true;
        if ((profile.data()?.generationCount ?? 0) >= 3) return false;
        transaction.update(userDocRef, { generationCount: admin.firestore.FieldValue.increment(1) });
        reserved = true;
        return true;
      });
      if (!allowed) {
        response.status(403).send({ error: { message: 'Limite gratuito atingido ou perfil não encontrado. Entre em contato pelo suporte para continuar.', status: 'PERMISSION_DENIED' } });
        return;
      }
    } catch (error) {
      console.error('Failed to reserve generation:', error);
      response.status(500).send({ error: { message: 'Não foi possível verificar seu limite de uso.' } });
      return;
    }

    try {
      const safeExistingQuestions = Array.isArray(existingQuestions) ? existingQuestions.slice(-30).filter((item: any) => typeof item?.question === 'string').map((item: any) => ({ question: item.question.slice(0, 300) })) : [];
      const safeBanca = Object.prototype.hasOwnProperty.call(bancaProfiles, banca) ? banca as keyof typeof bancaProfiles : 'Outra';
      const prompt = createPrompt({ subject, numQuestions, banca: safeBanca, difficulty, editalContent, specificContent: specificContent?.slice(0, 500), existingQuestions: safeExistingQuestions });
      
      let responseContent: string;
      if (provider === "gemini") {
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
          model: geminiModelStr.value(),
          generationConfig: {responseMimeType: "application/json"},
          systemInstruction: "Você é um assistente especialista em criar questões de concursos públicos brasileiros. Responda somente com um objeto JSON válido seguindo as regras do usuário.",
        });
        responseContent = (await model.generateContent(prompt)).response.text();
      } else {
        responseContent = await generateWithChatApi(provider, apiKey, prompt);
      }

      if (!responseContent) {
        response.status(500).send({ error: { message: "A resposta da IA está vazia ou nula.", status: "INTERNAL" } });
        return;
      }

      let responseObject;
      try {
        responseObject = JSON.parse(responseContent);
      } catch (parseError) {
        console.error(`Error parsing JSON from ${provider}:`, parseError);
        response.status(500).send({ error: { message: "A resposta da IA não é um JSON válido.", status: "INTERNAL" } });
        return;
      }

      const questionsArray = responseObject.questions;
      if (!Array.isArray(questionsArray) || questionsArray.length !== 10 || questionsArray.some((q: any) => typeof q?.question !== 'string' || !Array.isArray(q.options) || q.options.length !== (safeBanca === "Cespe/Cebraspe" ? 2 : 5) || q.options.some((option: any) => typeof option !== 'string' || !option.trim()) || !Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length || typeof q.explanation !== 'string' || !q.explanation.trim())) {
        response.status(500).send({ error: { message: "A resposta da IA não contém um array 'questions'.", status: "INTERNAL" } });
        return;
      }

      const allQuestions = questionsArray.map((q, index) => ({
        ...q,
        id: `${subject}-${banca.toLowerCase().replace(/\s/g, "")}-${index}`,
        subject: subject,
      }));

      const examRef = await admin.firestore().collection('exams').add({title: title.trim(), creatorId: uid, questions: allQuestions, banca: typeof displayBanca === 'string' ? displayBanca.trim().slice(0, 100) : banca, createdAt: admin.firestore.FieldValue.serverTimestamp(), source: 'generated_ai'});
      succeeded = true;
      response.status(200).send({ data: {questions: allQuestions, examId: examRef.id} });

    } catch (error: any) {
      console.error(`Error calling ${provider} API or processing data:`, {
        errorMessage: error.message,
      });

      let friendlyMessage = "Ocorreu um erro interno ao chamar a API da IA.";
      let statusString = "INTERNAL";
      let httpStatus = 500;

      if (error instanceof AiProviderError && error.statusCode === 429) {
        friendlyMessage = "A cota da IA ativa acabou. O administrador foi avisado e pode selecionar outra IA gratuita.";
        statusString = "RESOURCE_EXHAUSTED";
        httpStatus = 429;
      } else if (error.message) {
        const msgLower = error.message.toLowerCase();
        if (msgLower.includes("503") || msgLower.includes("high demand") || msgLower.includes("overloaded")) {
          friendlyMessage = "A inteligência artificial está com alta demanda no momento. Por favor, aguarde alguns segundos e tente novamente.";
          statusString = "UNAVAILABLE";
          httpStatus = 503;
        } else if (msgLower.includes("429") || msgLower.includes("quota") || msgLower.includes("too many requests")) {
          friendlyMessage = "A cota da IA ativa acabou. O administrador foi avisado e pode selecionar outra IA gratuita.";
          statusString = "RESOURCE_EXHAUSTED";
          httpStatus = 429;
        }
      }

      if (httpStatus === 429) {
        await recordQuotaAlert(provider).catch(alertError => console.error("Failed to record AI quota alert:", alertError));
      }

      response.status(httpStatus).send({ error: { message: friendlyMessage, status: statusString } });
    } finally {
      if (reserved && !succeeded) {
        await userDocRef.update({ generationCount: admin.firestore.FieldValue.increment(-1) }).catch(error => console.error('Failed to restore generation quota:', error));
      }
    }
  });
});

export const manageAiProvider = onRequest({timeoutSeconds: 60}, (request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== "GET" && request.method !== "POST") {
      response.status(405).send({error: {message: "Method Not Allowed"}});
      return;
    }
    const caller = await requireAdminToken(request, response);
    if (!caller) return;

    try {
      if (request.method === "POST") {
        const selected: unknown = request.body?.data?.provider;
        if (!isAiProvider(selected)) {
          response.status(400).send({error: {message: "Provedor inválido."}});
          return;
        }
        if (!getProviderKey(selected)) {
          response.status(412).send({error: {message: "Cadastre a chave deste provedor no servidor antes de ativá-lo."}});
          return;
        }
        await aiSettingsRef().set({
          activeProvider: selected,
          quotaAlert: admin.firestore.FieldValue.delete(),
          changedAt: admin.firestore.FieldValue.serverTimestamp(),
          changedBy: caller.uid,
        }, {merge: true});
      }
      const settings = (await aiSettingsRef().get()).data();
      const alert = settings?.quotaAlert;
      response.status(200).send({data: {
        activeProvider: isAiProvider(settings?.activeProvider) ? settings.activeProvider : "gemini",
        configured: {
          gemini: Boolean(geminiApiKey.value()),
          groq: Boolean(getProviderKey("groq")),
          openrouter: Boolean(getProviderKey("openrouter")),
        },
        quotaAlert: isAiProvider(alert?.provider) ? {
          provider: alert.provider,
          detectedAt: alert.detectedAt?.toDate?.().toISOString() ?? null,
        } : null,
      }});
    } catch (error) {
      console.error("Failed to manage AI provider:", error);
      response.status(500).send({error: {message: "Não foi possível carregar as configurações da IA."}});
    }
  });
});

export const submitExamResult = onRequest({ timeoutSeconds: 60 }, (request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'POST') {
      response.status(405).send({ error: { message: 'Method Not Allowed' } });
      return;
    }
    const token = request.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      response.status(401).send({ error: { message: 'Authentication required' } });
      return;
    }
    let caller;
    try {
      caller = await admin.auth().verifyIdToken(token);
    } catch {
      response.status(401).send({ error: { message: 'Invalid authentication token' } });
      return;
    }
    try {
      const { examId, answers, timeTaken } = request.body?.data || {};
      if (typeof examId !== 'string' || !Array.isArray(answers) || answers.length > 100 || !Number.isFinite(timeTaken) || timeTaken < 0) {
        response.status(400).send({ error: { message: 'Invalid result data' } });
        return;
      }
      const examDoc = await admin.firestore().collection('exams').doc(examId).get();
      const exam = examDoc.data();
      if (!examDoc.exists || exam?.creatorId !== caller.uid || !Array.isArray(exam.questions) || exam.questions.length === 0) {
        response.status(403).send({ error: { message: 'Exam unavailable' } });
        return;
      }
      const supplied = new Map<string, unknown>(answers.map((answer: any) => [answer?.questionId, answer?.selectedAnswer]));
      const checkedAnswers = exam.questions.map((question: any) => {
        const selected = supplied.get(question.id);
        const selectedAnswer = typeof selected === 'number' && Number.isInteger(selected) && selected >= 0 && selected < question.options.length ? selected : null;
        return { questionId: question.id, selectedAnswer, isCorrect: selectedAnswer === question.correctAnswer };
      });
      const score = Math.round((checkedAnswers.filter((answer: any) => answer.isCorrect).length / checkedAnswers.length) * 10000) / 100;
      const result = await admin.firestore().collection('results').add({
        userId: caller.uid,
        examId,
        answers: checkedAnswers,
        score,
        timeTaken: Math.min(Math.floor(timeTaken), 3600),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      response.status(200).send({ data: { resultId: result.id } });
    } catch (error) {
      console.error('Failed to save exam result:', error);
      response.status(500).send({ error: { message: 'Could not save result' } });
    }
  });
});

export const grantAdminAccess = onRequest({ timeoutSeconds: 60 }, (request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'POST') {
      response.status(405).send({ error: { message: "Method Not Allowed" } });
      return;
    }

    const caller = await requireAdminToken(request, response);
    if (!caller) {
      return;
    }

    const targetEmail = (request.body?.email || request.body?.data?.email || '').trim();
    if (!targetEmail) {
      response.status(400).send({ error: { message: "email is required." } });
      return;
    }
    if (!getAllowedAdminEmails().has(targetEmail.toLowerCase())) {
      response.status(403).send({ error: { message: 'Target email is not in ADMIN_EMAILS.' } });
      return;
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(targetEmail);
      await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

      response.status(200).send({
        data: {
          success: true,
          uid: userRecord.uid,
          email: targetEmail,
          message: "Admin access granted successfully."
        }
      });
    } catch (error: any) {
      console.error("Error granting admin access:", error);
      response.status(500).send({ error: { message: "Failed to grant admin access.", details: error.message } });
    }
  });
});

export const deleteUserByAdmin = onRequest({timeoutSeconds: 60}, (request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'POST') {
      response.status(405).send({ error: { message: "Method Not Allowed" } });
      return;
    }

    const decodedToken = await requireAdminToken(request, response);
    if (!decodedToken) {
      return;
    }

    const { uidToDelete } = request.body.data || {};
    if (!uidToDelete) {
      response.status(400).send({ error: { message: "uidToDelete is required." } });
      return;
    }

    try {
      await admin.auth().deleteUser(uidToDelete);
      await admin.firestore().collection("users").doc(uidToDelete).delete();

      response.status(200).send({ data: { success: true, message: "User deleted successfully." } });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      response.status(500).send({ error: { message: "Failed to delete user.", details: error.message } });
    }
  });
});


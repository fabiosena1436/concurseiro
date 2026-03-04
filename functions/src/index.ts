
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import {defineString} from "firebase-functions/params";

// 1. DEFINIÇÃO DE PARÂMETROS
const openAIKey = defineString("OPENAI_KEY");
const openAIModel = defineString("OPENAI_MODEL", {default: "gpt-4o-mini"});

admin.initializeApp();
const db = admin.firestore(); // NEW: Firestore DB instance

const bancaProfiles = {
  "Cespe/Cebraspe": "Famosa por questões no formato 'Certo' ou 'Errado', onde uma resposta errada anula uma certa. As questões são complexas, interdisciplinares e exigem muita atenção a detalhes e jurisprudência atualizada.",
  "Fundação Getúlio Vargas (FGV)": "Conhecida por questões longas, com textos e cenários complexos que exigem interpretação e raciocínio lógico. As alternativas são muitas vezes bem elaboradas para induzir ao erro.",
  "Fundação Cesgranrio": "Estilo mais direto e objetivo, com questões que cobram o conhecimento literal da lei ou do conteúdo. Menos interpretativa que a FGV ou o Cespe.",
  "Fundação Carlos Chagas (FCC)": "Alternativas geralmente longas e muito parecidas entre si, exigindo que o candidato conheça o 'decoreba' e a literalidade da lei. A jurisprudência também é cobrada com frequência.",
  "Outra": "Estilo genérico de múltipla escolha (A, B, C, D, E), focado na precisão do conteúdo e clareza.",
};

const getRelevantContext = (content: string): string => {
  if (!content) {
    return "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";
  }
  return content.substring(0, 4000);
};

// --- PROMPT CREATION (Updated to accept questions from the bank) ---
const createPrompt = (data: {
  subject: string;
  numQuestions: number;
  banca: keyof typeof bancaProfiles;
  difficulty: string;
  editalContent?: string;
  existingQuestions?: { question: string }[]; // Can be from user history or from the bank
}) => {
  const { subject, numQuestions, banca, difficulty, editalContent, existingQuestions } = data;
  const bancaStyle = bancaProfiles[banca] || bancaProfiles["Outra"];
  const context = getRelevantContext(editalContent || "");
  const hasEdital = !!editalContent && editalContent.trim() !== '' && context !== "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";

  const isCespe = banca === "Cespe/Cebraspe";
  const questionFormat = isCespe ? "'Certo' ou 'Errado'" : "Múltipla Escolha com 5 alternativas (A, B, C, D, E)";
  const optionsNote = isCespe
    ? "Para questões 'Certo ou Errado', o array de opções deve conter apenas duas strings: 'Certo' e 'Errado'."
    : "Para questões de Múltipla Escolha, o array de opções deve conter exatamente 5 strings, uma para cada alternativa (A, B, C, D, E).";

  const sourceOfTruth = hasEdital
    ? `**Fonte de Verdade (Contexto):** Use **EXCLUSIVamente** as informações contidas na seção "CONTEXTO PARA QUESTÕES". Se o contexto for insuficiente, recuse-se a criar a questão.`
    : `**Fonte de Verdade (Conhecimento Geral):** Use seu conhecimento aprofundado sobre o **Tópico Principal**.`;

  const generationRules = hasEdital
    ? `1. **FIDELIDADE AO CONTEXTO:** Baseie-se **ESTRITAMENTE** no "CONTEXTO PARA QUESTÕES".`
    : `1. **BASE NO CONHECIMENTO:** Baseie-se em seu conhecimento sobre o **Tópico Principal**, garantindo precisão e relevância.`;

  const existingQuestionsSection = (existingQuestions && existingQuestions.length > 0)
    ? `
    **QUESTÕES EXISTENTES (PARA EVITAR REPETIÇÃO):**
    Abaixo estão exemplos de questões que já existem no sistema. **NÃO GERE** questões semanticamente iguais ou muito parecidas com estas. O objetivo é criar conteúdo 100% novo.
    ---
    ${existingQuestions.map((q) => `- ${q.question}`).join("\n")}
    ---
    `
    : "";

  return `
    **Você é um Especialista em Concursos Públicos criando questões para a banca "${banca}".**
    **Missão:** Gerar ${numQuestions} questões **NOVAS E DISTINTAS** de altíssima qualidade sobre o **Tópico Principal: "${subject}"**.

    **ETAPA 1: REGRAS GERAIS**
    - **Nível de Dificuldade:** ${difficulty === "medio" ? "Ensino Médio" : "Ensino Superior"}.
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
    2. **EVITAR REPETIÇÃO:** É **PROIBIDO** criar questões que sejam semanticamente similares às listadas na seção "QUESTÕES EXISTENTES".
    3. **PROIBIDO META-QUESTÕES:** Não crie questões sobre "o contexto fornecido" ou a falta de informações. Foque apenas no **Tópico Principal**.
    4. **ESTRUTURA JSON OBRIGATÓRIA:** A saída final **DEVE** ser um único objeto JSON válido, contendo uma chave "questions", que é um array de objetos. Não inclua texto ou comentários fora do JSON.
    
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


export const generateQuestions = functions.https.onCall(async (data, context) => {
  // --- AUTHENTICATION ---
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  // --- PARAMETERS & VALIDATION ---
  const apiKey = openAIKey.value();
  const model = openAIModel.value();
  if (!apiKey) {
    throw new functions.https.HttpsError("failed-precondition", "The OpenAI API key is not configured.");
  }

  const { subject, numQuestions, banca, difficulty, editalContent, existingQuestions: userHistory } = data;
  if (!subject || !numQuestions || !banca || !difficulty) {
    throw new functions.https.HttpsError("invalid-argument", "The 'subject', 'numQuestions', 'banca', and 'difficulty' arguments are required.");
  }

  try {
    // --- STEP 1: Fetch from Question Bank ---
    const questionBankRef = db.collection('questionBank');
    
    // Map form difficulty to database values
    const difficultyQueryValues = difficulty === 'medio'
        ? ['facil', 'medio']
        : ['dificil'];

    const querySnapshot = await questionBankRef
      .where('subject', '==', subject)
      .where('banca', '==', banca)
      .where('difficulty', 'in', difficultyQueryValues)
      .get();

    let availableQuestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter out questions the user has already seen
    const userHistorySafe = userHistory ?? [];
    if (userHistorySafe.length > 0) {
      const userHistoryIds = new Set(userHistorySafe.map((q: any) => q.id));
      availableQuestions = availableQuestions.filter(q => !userHistoryIds.has(q.id));
    }
    
    const questionsFromBank = availableQuestions.slice(0, numQuestions);
    
    let allQuestions = [...questionsFromBank];
    const questionsToGenerate = numQuestions - allQuestions.length;

    // --- STEP 2: Generate missing questions with AI (if needed) ---
    if (questionsToGenerate > 0) {
      const openai = new OpenAI({ apiKey });
      
      // Use existing questions (from bank AND user history) to prevent duplicates
      const questionsForPrompt = [
          ...(userHistory || []),
          ...allQuestions
      ].map(q => ({ question: q.question }));

      const prompt = createPrompt({ 
          subject, 
          numQuestions: questionsToGenerate, 
          banca, 
          difficulty, 
          editalContent, 
          existingQuestions: questionsForPrompt 
      });

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "system", content: "Você é um assistente especialista em criar questões de concursos públicos. Sua única função é gerar um objeto JSON válido." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new functions.https.HttpsError("internal", "The AI response is empty or null.");
      }

      const responseObject = JSON.parse(responseContent);
      if (!Array.isArray(responseObject.questions)) {
        throw new functions.https.HttpsError("internal", "The AI response does not contain a 'questions' array.");
      }
      
      const newAiQuestions = responseObject.questions;

      // --- STEP 3: Save new questions to the bank ---
      const batch = db.batch();
      const savedQuestions = [];

      for (const q of newAiQuestions) {
          const newDocRef = questionBankRef.doc(); // Create a new document with a unique ID
          const questionData = {
              ...q,
              subject,
              banca,
              difficulty,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: 'ai_generated'
          };
          batch.set(newDocRef, questionData);
          savedQuestions.push({ id: newDocRef.id, ...questionData });
      }
      await batch.commit();

      allQuestions = [...allQuestions, ...savedQuestions];
    }
    
    // Shuffle the final list to mix bank and new questions
    allQuestions.sort(() => Math.random() - 0.5);

    return allQuestions.slice(0, numQuestions);

  } catch (error: any) {
    console.error("Error in generateQuestions function:", {
      errorMessage: error.message,
      errorCode: error.code,
    });
    throw new functions.https.HttpsError("internal", "An internal error occurred.", { originalError: error.message });
  }
});

// --- NEW: Function to manually add a question ---
export const addQuestionManually = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication and Admin Role
    if (context.auth?.token.admin !== true) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can add questions.");
    }

    // 2. Get and Validate Data
    const { subject, topic, question, options, correctAnswer, explanation, banca, difficulty } = data;
    if (!subject || !topic || !question || !options || correctAnswer === undefined || !explanation || !banca || !difficulty) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
    }

    // 3. Save to Firestore
    try {
        const questionBankRef = db.collection('questionBank');
        const newQuestion = {
            subject,
            topic,
            question,
            options,
            correctAnswer,
            explanation,
            banca,
            difficulty,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'admin',
            authorUid: context.auth.uid
        };

        const docRef = await questionBankRef.add(newQuestion);
        return { id: docRef.id, ...newQuestion };

    } catch (error) {
        console.error("Error saving question to Firestore:", error);
        throw new functions.https.HttpsError("internal", "Internal server error while saving question.");
    }
});

export const addQuestionsBatch = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication and Admin Role
    if (context.auth?.token.admin !== true) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can add questions in batch.");
    }

    // 2. Get and Validate Data
    const questions = data.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Request body must contain a non-empty 'questions' array.");
    }

    // 3. Save to Firestore using a Batch
    try {
        const batch = db.batch();
        const questionBankRef = db.collection('questionBank');
        
        for (const q of questions) {
            // Basic validation for each question object
            if (!q.subject || !q.topic || !q.question || !q.options || q.correctAnswer === undefined || !q.explanation || !q.banca || !q.difficulty) {
               console.warn("Skipping invalid question object:", q);
               continue; // Skip invalid objects
            }

            const newDocRef = questionBankRef.doc(); // auto-generate ID
            const newQuestionData = {
                ...q,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'admin-batch',
                authorUid: context.auth.uid
            };
            batch.set(newDocRef, newQuestionData);
        }

        await batch.commit();
        return { message: `Batch processed. ${questions.length} questions attempted.` };

    } catch (error) {
        console.error("Error batch saving questions to Firestore:", error);
        throw new functions.https.HttpsError("internal", "Internal server error while batch saving questions.");
    }
});


export const setAdmin = functions.https.onCall(async (data, context) => {
    // Check if the user is an admin
    if (context.auth?.token.admin !== true) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Only admins can add other admins."
        );
    }

    const email = data.email;
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        return { message: `Success! ${email} has been made an admin.` };
    } catch (error) {
        console.error("Error setting admin claim:", error);
        throw new functions.https.HttpsError("internal", "Error setting admin claim.");
    }
});


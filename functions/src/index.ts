
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";

admin.initializeApp();

const openai = new OpenAI({
  apiKey: functions.config().openai.key,
});

const model = functions.config().openai.model || "gpt-3.5-turbo-1106";

export const generateQuestions = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { subject, numQuestions, banca, difficulty, editalContent } = data;

  if (!subject || !numQuestions || !banca || !difficulty) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with the arguments 'subject', 'numQuestions', 'banca', and 'difficulty'."
    );
  }

  const questionsPerCall = 10;
  const numCalls = Math.ceil(numQuestions / questionsPerCall);
  const allQuestions: any[] = [];

  try {
    for (let i = 0; i < numCalls; i++) {
      const currentNumQuestions = Math.min(questionsPerCall, numQuestions - allQuestions.length);
      if (currentNumQuestions <= 0) continue;

      const prompt = `
        **Instruções para o Assistente:**
        Você é um especialista em criar questões para concursos públicos brasileiros, atuando como se fosse um membro da banca examinadora "${banca}".
        Sua tarefa é gerar ${currentNumQuestions} questões de múltipla escolha com 4 opções cada.

        **Regras Estritas:**
        1.  **Fidelidade ao Conteúdo:** Se um "Conteúdo do Edital" for fornecido, TODAS as questões devem ser estritamente baseadas NELE. Não invente tópicos ou faça perguntas sobre o próprio edital. As questões devem ser sobre as MATÉRIAS dentro do edital.
        2.  **Qualidade e Precisão:** As perguntas e respostas devem ser precisas, claras e com um nível de dificuldade apropriado para o nível "${difficulty === 'medio' ? 'Ensino Médio' : 'Ensino Superior'}".
        3.  **Estilo da Banca:** As questões devem refletir o estilo e a complexidade da banca "${banca}".
        4.  **Tópico Principal:** Se o campo "Conteúdo do Edital" estiver vazio, baseie as questões no tópico principal: "${subject}".

        **Conteúdo do Edital (se aplicável):**
        ${editalContent ? editalContent : "Nenhum conteúdo de edital fornecido. Usar o tópico principal."}

        **Formato de Saída OBRIGATÓRIO:**
        A saída deve ser um ÚNICO objeto JSON, contendo a chave "questions", que é um array de objetos. Cada objeto deve ter:
        - "question": O texto da pergunta.
        - "options": Um array com 4 strings para as opções.
        - "correctAnswer": O índice (0 a 3) da resposta correta.
        - "explanation": Uma explicação breve e clara do porquê a resposta está correta.

        **Exemplo de Saída Detalhado:**
        {
          "questions": [
            {
              "id": "gerado-0",
              "question": "De acordo com a Constituição Federal de 1988, qual dos seguintes princípios NÃO é um fundamento da República Federativa do Brasil?",
              "options": [
                "A soberania",
                "A cidadania",
                "A dignidade da pessoa humana",
                "A separação de poderes"
              ],
              "correctAnswer": 3,
              "explanation": "A separação de poderes, embora seja um princípio fundamental da organização do Estado brasileiro, não está listada no Art. 1º da Constituição como um dos fundamentos da República, que são: a soberania, a cidadania, a dignidade da pessoa humana, os valores sociais do trabalho e da livre iniciativa, e o pluralismo político.",
              "subject": "Direito Constitucional"
            }
          ]
        }
      `;

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "Você é um assistente especialista em criar questões de concursos públicos brasileiros. Sua tarefa é gerar questões no formato JSON exato solicitado pelo usuário, seguindo regras estritas de fidelidade ao conteúdo e qualidade."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new functions.https.HttpsError("internal", "A resposta da IA está vazia.");
      }

      const responseObject = JSON.parse(responseContent);
      const questionsArray = responseObject.questions;

      if (!Array.isArray(questionsArray)) {
        throw new functions.https.HttpsError("internal", "A resposta da IA não contém um array de 'questions'.");
      }

      allQuestions.push(...questionsArray);
    }

    return allQuestions.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${index}`,
      subject: subject,
    }));

  } catch (error) {
    console.error("Error calling OpenAI API:", {
      error: error,
      requestData: data,
    });

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError("internal", "Error calling OpenAI API.", error);
  }
});

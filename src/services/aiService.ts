import OpenAI from 'openai';
import { type Question } from '../types/exam';

// Recupera a chave da API das variáveis de ambiente
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Lança um erro se a chave da API não estiver definida, para evitar falhas silenciosas.
if (!apiKey) {
  throw new Error("A chave da API da OpenAI (VITE_OPENAI_API_KEY) não está definida no seu ambiente.");
}

// Cria uma instância do cliente OpenAI
const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true, // Necessário para uso no lado do cliente (navegador)
});

// Esta função agora gera questões reais usando a API da OpenAI.
export const generateQuestionsFromBank = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'medio' | 'superior',
  editalContent?: string
): Promise<Question[]> => {
  const allQuestions: Question[] = [];
  const questionsPerCall = 10; // Número de questões a serem solicitadas por chamada de API
  const numCalls = Math.ceil(numQuestions / questionsPerCall);

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

        **Exemplo de Saída:**
        {
          "questions": [
            {
              "id": "gerado-0",
              "question": "Exemplo de pergunta sobre o tópico.",
              "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
              "correctAnswer": 1,
              "explanation": "A opção B está correta porque...",
              "subject": "${subject}"
            }
          ]
        }
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
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
        throw new Error("A resposta da IA está vazia.");
      }

      console.log(`Resposta da API (chamada ${i + 1}/${numCalls}):`, responseContent);

      const responseObject = JSON.parse(responseContent);
      const questionsArray = responseObject.questions as Question[];

      if (!Array.isArray(questionsArray)) {
        throw new Error("A resposta da IA não contém um array de 'questions'.");
      }

      allQuestions.push(...questionsArray);
    }

    return allQuestions.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${index}`,
      subject: subject,
    }));

  } catch (error) {
    console.error("Erro ao chamar a API da OpenAI:", error);
    const fallbackQuestion: Question = {
      id: 'error-0',
      question: `Ocorreu um erro ao gerar as questões com a IA para a banca ${banca}.`,
      options: ['Tente novamente', 'Verifique sua chave de API', 'Veja o console para detalhes', 'Tente outra banca'],
      correctAnswer: 0,
      explanation: error instanceof Error ? error.message : 'Erro desconhecido. Verifique o console de desenvolvedor.',
      subject: subject,
    };

    // Se algumas questões foram geradas com sucesso, retorna-as junto com as de fallback
    const remainingQuestions = numQuestions - allQuestions.length;
    if (remainingQuestions > 0) {
      const fallbackQuestions = Array(remainingQuestions).fill(fallbackQuestion).map((q, i) => ({ ...q, id: `error-${allQuestions.length + i}` }));
      return [...allQuestions, ...fallbackQuestions];
    }

    return allQuestions;
  }
};


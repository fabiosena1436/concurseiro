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
  editalContent?: string
): Promise<Question[]> => {

  // 1. Construir o prompt detalhado para a IA
  const prompt = `
    Por favor, gere ${numQuestions} questões de concurso sobre o tópico "${subject}".
    As questões devem seguir o estilo e o nível de dificuldade da banca examinadora: "${banca}".
    ${editalContent ? `\nBaseie-se no seguinte conteúdo do edital:\n${editalContent}` : ''}
    
    Para cada questão, forneça:
    - O texto da pergunta (question).
    - 4 opções de resposta (options), sendo uma delas a correta.
    - O índice da resposta correta (correctAnswer, um número de 0 a 3).
    - Uma breve explicação sobre a resposta correta (explanation).

    Formate a saída como um ÚNICO objeto JSON, contendo uma chave "questions".
    O valor de "questions" deve ser um array de objetos, como no exemplo abaixo:
    {
      "questions": [
        {
          "id": "gerado-0",
          "question": "Qual conceito de informática se refere à 'nuvem'?",
          "options": ["Hardware Físico", "Computação em Nuvem", "Rede Local", "Software Instalado"],
          "correctAnswer": 1,
          "explanation": "Computação em nuvem é o fornecimento de serviços de computação pela Internet.",
          "subject": "${subject}"
        }
      ]
    }
  `;

  try {
    // 2. Fazer a chamada para a API da OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106", // Modelo otimizado para saídas JSON
      messages: [
        {
          role: "system",
          content: "Você é um assistente especialista em criar questões de concursos públicos brasileiros. Sua tarefa é gerar questões no formato JSON exato solicitado pelo usuário."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" }, // Habilita o modo de saída JSON
    });

    // 3. Extrair e processar a resposta da IA
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("A resposta da IA está vazia.");
    }
    
    console.log("Resposta da API:", responseContent); // Para depuração

    // O modelo pode retornar um objeto JSON com uma chave que contém o array.
    // Precisamos encontrar e retornar o array de questões.
    const responseObject = JSON.parse(responseContent);
    const questionsArray = responseObject.questions as Question[];

    if (!Array.isArray(questionsArray)) {
       throw new Error("A resposta da IA não contém um array de 'questions'.");
    }
    
    // Adiciona IDs únicos e garante que a matéria está correta
    return questionsArray.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${index}`,
      subject: subject,
    }));

  } catch (error) {
    console.error("Erro ao chamar a API da OpenAI:", error);
    // Em caso de erro na API, retorna uma questão de fallback para o usuário saber o que aconteceu.
    const fallbackQuestion: Question = {
      id: 'error-0',
      question: `Ocorreu um erro ao gerar as questões com a IA para a banca ${banca}.`,
      options: ['Tente novamente', 'Verifique sua chave de API', 'Veja o console para detalhes', 'Tente outra banca'],
      correctAnswer: 0,
      explanation: error instanceof Error ? error.message : 'Erro desconhecido. Verifique o console de desenvolvedor.',
      subject: subject,
    };
    return Array(numQuestions).fill(fallbackQuestion).map((q, i) => ({...q, id: `error-${i}`}));
  }
};


import { getFunctions, httpsCallable, HttpsError } from 'firebase/functions';
import { type Question } from '../types/exam';

const functions = getFunctions();
const generateQuestionsCallable = httpsCallable<any, Question[]>(functions, 'generateQuestions');

// Tipo para as questões já geradas e armazenadas localmente
interface StoredQuestion {
  question: string;
}

export const generateQuestionsFromBank = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'medio' | 'superior',
  editalContent?: string,
  existingQuestions?: StoredQuestion[]
): Promise<Question[]> => {
  try {
    const result = await generateQuestionsCallable({
      subject,
      numQuestions,
      banca,
      difficulty,
      editalContent,
      existingQuestions,
    });
    
    const questions = result.data;

    if (!Array.isArray(questions)) {
      console.error("A API não retornou um array de questões.", questions);
      // Retorna uma questão de fallback para que o usuário saiba que algo deu errado
      throw new Error("A resposta da API de geração de questões não está no formato esperado (não é um array).");
    }
    
    // O mapeamento de ID pode não ser mais necessário se a função já retorna IDs únicos
    return questions.map((q) => ({
      ...q,
      subject: subject,
    }));

  } catch (error: unknown) {
    console.error("Falha na operação de generateQuestionsFromBank:", error);

    let errorMessage: string;
    if (error instanceof HttpsError) {
      errorMessage = `Erro da API: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Ocorreu um erro desconhecido.';
    }

    const finalErrorMessage = `Ocorreu um erro ao gerar as questões com a IA. Detalhe: ${errorMessage}`;

    const fallbackQuestion: Question = {
      id: 'error-0',
      question: finalErrorMessage,
      options: ['Tente novamente', 'Verifique os parâmetros', 'Tente mais tarde', 'Contate o suporte'],
      correctAnswer: 0,
      explanation: `A chamada para a API falhou. Causa: ${errorMessage}. Verifique o console do navegador e os logs da Cloud Function para mais detalhes.`,
      subject: subject,
    };
    return [fallbackQuestion];
  }
};


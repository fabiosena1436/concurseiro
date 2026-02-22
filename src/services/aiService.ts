import { httpsCallable, FunctionsError } from 'firebase/functions';
import { functions } from './firebase';
import { type Question } from '../types/exam';

const generateQuestionsFn = httpsCallable(functions, 'generateQuestions');

export const generateQuestionsFromBank = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'medio' | 'superior',
  editalContent?: string
): Promise<Question[]> => {
  try {
    const result = await generateQuestionsFn({
      subject,
      numQuestions,
      banca,
      difficulty,
      editalContent,
    });

    const questions = result.data as Question[];
    
    return questions.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${index}`,
      subject: subject,
    }));

  } catch (error) {
    console.error("Erro ao chamar a função da nuvem 'generateQuestions':", error);

    let errorMessage = `Ocorreu um erro ao gerar as questões com a IA para a banca ${banca}.`;
    if (error instanceof FunctionsError) {
      switch (error.code) {
        case 'unauthenticated':
          errorMessage = 'Você precisa estar autenticado para gerar questões.';
          break;
        case 'invalid-argument':
          errorMessage = 'Houve um problema com os parâmetros enviados para gerar as questões.';
          break;
        case 'internal':
          errorMessage = 'Ocorreu um erro interno no servidor ao gerar as questões. A equipe de desenvolvimento já foi notificada.';
          break;
        default:
          errorMessage = `Ocorreu um erro inesperado. Código: ${error.code}`;
          break;
      }
    }

    const fallbackQuestion: Question = {
      id: 'error-0',
      question: errorMessage,
      options: ['Tente novamente', 'Verifique os parâmetros', 'Tente mais tarde', 'Contate o suporte'],
      correctAnswer: 0,
      explanation: error instanceof Error ? error.message : 'Erro desconhecido. Verifique o console de desenvolvedor para mais detalhes.',
      subject: subject,
    };
    return Array(numQuestions).fill(fallbackQuestion).map((q, i) => ({ ...q, id: `error-${i}` }));
  }
};


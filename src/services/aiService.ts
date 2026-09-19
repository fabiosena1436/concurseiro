import { auth } from './firebase';
import type { Question, QuestionSource } from '../types/exam';

const functionURL = import.meta.env.VITE_GENERATE_QUESTIONS_URL ||
  'https://us-central1-simulado-concurso-ia.cloudfunctions.net/generateQuestions';

export interface GenerateQuestionsOptions {
  subject: string;
  numQuestions: number;
  banca: string;
  difficulty: 'fundamental' | 'medio' | 'superior';
  sourceType?: QuestionSource;
  editalContent?: string;
  pdfContent?: string;
  pdfFileName?: string;
  existingQuestions?: Pick<Question, 'question'>[];
  specificContent?: string;
}

type ApiResponse = {
  data?: unknown;
  error?: {
    message?: string;
  };
};

const isApiResponse = (value: unknown): value is ApiResponse => (
  typeof value === 'object' && value !== null
);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocorreu um erro desconhecido ao gerar as questões.';
};

export const generateQuestionsFromBank = async ({
  subject,
  numQuestions,
  banca,
  difficulty,
  sourceType = 'topic',
  editalContent,
  pdfContent,
  pdfFileName,
  existingQuestions,
  specificContent,
}: GenerateQuestionsOptions): Promise<Question[]> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Você precisa estar autenticado para gerar questões.');
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch(functionURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          subject,
          numQuestions,
          banca,
          difficulty,
          sourceType,
          editalContent,
          pdfContent,
          pdfFileName,
          existingQuestions,
          specificContent,
        },
      }),
    });

    const result: unknown = await response.json();

    if (!response.ok) {
      const errorMessage = isApiResponse(result) && result.error?.message
        ? result.error.message
        : 'Falha ao buscar dados da inteligência artificial.';
      throw new Error(errorMessage);
    }

    const responseData = isApiResponse(result) ? result.data : undefined;
    if (!Array.isArray(responseData)) {
      throw new Error('A resposta da geração de questões não teve o formato esperado.');
    }

    return responseData.map((question, index) => ({
      ...(question as Question),
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${Date.now()}-${index}`,
      subject,
    }));
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Falha na operação de generateQuestionsFromBank:", error);
    throw new Error(errorMessage);
  }
};

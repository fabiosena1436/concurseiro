import { functions, auth } from './firebase';
import { type Question } from '../types/exam';

const functionURL = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/generateQuestions';

export const generateQuestionsFromBank = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'fundamental' | 'medio' | 'superior',
  editalContent?: string,
  existingQuestions?: Question[],
  specificContent?: string
): Promise<Question[]> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Você precisa estar autenticado para gerar questões.');
    }

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
          editalContent,
          existingQuestions,
          specificContent,
        }
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // A resposta de erro da nossa função agora está em result.error
      const errorPayload = result.error || { message: 'Erro desconhecido', status: 'UNKNOWN' };
      console.error("Erro ao chamar a função da nuvem 'generateQuestions':", errorPayload);
      // Lançamos um erro com a mensagem da API para ser pego pelo bloco catch
      throw new Error(errorPayload.message || 'Falha ao buscar dados.');
    }

    // The raw HTTP response from a callable function wraps the payload in a 'data' key for success.
    const questions = result.data as Question[];


    if (!Array.isArray(questions)) {
        console.error("A API não retornou um array de questões no campo 'data'. Resposta recebida:", result);
        throw new Error("A resposta da API de geração de questões não teve o formato esperado.");
    }
    
    return questions.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, '')}-${index}`,
      subject: subject,
    }));

  } catch (error: any) {
    // O erro pode ser da rede (fetch falhou) ou o que lançamos acima
    console.error("Falha na operação de generateQuestionsFromBank:", error);

    let errorMessage = `Ocorreu um erro ao gerar as questões com a IA. Detalhe: ${error.message}`;

    const fallbackQuestion: Question = {
      id: 'error-0',
      question: errorMessage,
      options: ['Tente novamente', 'Verifique os parâmetros', 'Tente mais tarde', 'Contate o suporte'],
      correctAnswer: 0,
      explanation: `A chamada para a API falhou. Causa: ${error.message || 'Erro desconhecido.'}. Verifique o console do navegador (aba 'Rede' e 'Console') e os logs da Cloud Function para mais detalhes.`,
      subject: subject,
    };
    return [fallbackQuestion];
  }
};

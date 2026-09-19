import { auth } from './firebase';

const deleteUserFunctionURL = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/deleteUserByAdmin';

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => (
  typeof value === 'object' && value !== null
);

export const deleteUserAccount = async (uidToDelete: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Você precisa estar autenticado.');
  }

  const token = await user.getIdToken();

  const response = await fetch(deleteUserFunctionURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        uidToDelete,
      },
    }),
  });

  const result: unknown = await response.json();

  if (!response.ok) {
    const errorMessage = isApiErrorResponse(result) && result.error?.message
      ? result.error.message
      : 'Erro desconhecido';
    throw new Error(errorMessage || 'Falha ao deletar usuário.');
  }
};

import { auth } from './firebase';

const deleteUserFunctionURL = 'https://us-central1-simulado-concurso-ia.cloudfunctions.net/deleteUserByAdmin';

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
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        uidToDelete,
      },
    }),
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Falha ao deletar usuário.';
    if (result && typeof result === 'object' && 'error' in result) {
      const error = result.error;
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') message = error.message;
    }
    throw new Error(message);
  }
};

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

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorPayload = result?.error || { message: 'Erro desconhecido' };
    throw new Error(errorPayload.message || 'Falha ao deletar usuário.');
  }
};

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import type { Exam } from "../types/exam";
import type { Result } from "../types/result";
import type { UserProfile } from "../types/user";
import type { SupportMessage } from "../types/message";

const ensureAuthenticatedUser = async (): Promise<void> => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Você precisa estar autenticado.");
  }

  const tokenResult = await user.getIdTokenResult();
  if (!tokenResult.claims.admin) {
    throw new Error("Acesso de administrador obrigatório.");
  }
};

const examsCollection = collection(db, "exams");
const resultsCollection = collection(db, "results");
const usersCollection = collection(db, "users");
const messagesCollection = collection(db, "messages");

/**
 * Envia uma nova mensagem de suporte.
 */
export const sendSupportMessage = async (message: Omit<SupportMessage, "id" | "createdAt" | "isReadByAdmin" | "isReadByUser">): Promise<void> => {
  await addDoc(messagesCollection, {
    ...message,
    sender: 'user',
    createdAt: serverTimestamp(),
    isReadByAdmin: false,
    isReadByUser: true,
  });
};

/**
 * Responde uma mensagem de suporte (Admin).
 */
export const replySupportMessage = async (userId: string, userEmail: string, userName: string, replyText: string): Promise<void> => {
  await ensureAuthenticatedUser();

  await addDoc(messagesCollection, {
    userId,
    userEmail,
    userName,
    text: replyText,
    sender: 'admin',
    createdAt: serverTimestamp(),
    isReadByAdmin: true,
    isReadByUser: false,
  });
};

/**
 * Busca as mensagens de um usuário.
 */
export const getUserMessages = async (userId: string): Promise<SupportMessage[]> => {
  const q = query(messagesCollection, where("userId", "==", userId));
  const snapshot = await getDocs(q);
  const msgs = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
      repliedAt: data.repliedAt ? (data.repliedAt as Timestamp).toDate() : undefined,
    } as SupportMessage;
  });
  return msgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

/**
 * Busca todas as mensagens (Para o Admin).
 */
export const getAllMessages = async (): Promise<SupportMessage[]> => {
  await ensureAuthenticatedUser();

  const q = query(messagesCollection);
  const snapshot = await getDocs(q);
  const msgs = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
      repliedAt: data.repliedAt ? (data.repliedAt as Timestamp).toDate() : undefined,
    } as SupportMessage;
  });
  return msgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

/**
 * Marca uma mensagem como lida pelo usuário.
 */
export const markMessageAsReadByUser = async (messageId: string): Promise<void> => {
  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, {
    isReadByUser: true
  });
};

/**
 * Marca uma mensagem como lida pelo Admin.
 */
export const markMessageAsReadByAdmin = async (messageId: string): Promise<void> => {
  await ensureAuthenticatedUser();

  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, {
    isReadByAdmin: true
  });
};

/**
 * Deleta uma mensagem de suporte.
 */
export const deleteSupportMessage = async (messageId: string): Promise<void> => {
  await ensureAuthenticatedUser();

  const msgRef = doc(db, "messages", messageId);
  await deleteDoc(msgRef);
};

/**
 * Busca todos os usuários do sistema (Para o painel Admin).
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  await ensureAuthenticatedUser();

  const querySnapshot = await getDocs(usersCollection);
  return querySnapshot.docs.map(doc => doc.data() as UserProfile);
};

/**
 * Atualiza o status de desbloqueio de um usuário.
 */
export const toggleUserUnlockStatus = async (uid: string, isUnlocked: boolean): Promise<void> => {
  await ensureAuthenticatedUser();

  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    isUnlocked: isUnlocked
  });
};

/**
 * Cria um novo simulado no Firestore.
 * @param examData - Os dados do simulado a serem salvos.
 * @returns O ID do simulado criado.
 */
export const createExam = async (
  examData: Omit<Exam, "id" | "createdAt">
): Promise<string> => {
  const docRef = await addDoc(examsCollection, {
    ...examData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Busca um simulado específico no Firestore pelo seu ID.
 * @param examId - O ID do simulado.
 * @returns Os dados do simulado, ou null se não for encontrado.
 */
export const getExam = async (examId: string): Promise<Exam | null> => {
  const docRef = doc(db, "exams", examId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(), // Converte o Timestamp para Date
    } as Exam;
  } else {
    return null;
  }
};

/**
 * Salva o resultado de um simulado no Firestore.
 * @param resultData - Os dados do resultado.
 * @returns O ID do resultado salvo.
 */
export const saveResult = async (
  resultData: { examId: string; answers: { questionId: string; selectedAnswer?: number }[]; timeTaken: number }
): Promise<string> => {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Você precisa estar autenticado.');
  const token = await user.getIdToken();
  const response = await fetch('https://us-central1-simulado-concurso-ia.cloudfunctions.net/submitExamResult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: resultData }),
  });
  const payload: unknown = await response.json();
  if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Não foi possível salvar o resultado. Tente novamente.');
  }
  const data = (payload as { data: unknown }).data;
  if (!data || typeof data !== 'object' || !('resultId' in data) || typeof data.resultId !== 'string') {
    throw new Error('O servidor retornou um resultado inválido.');
  }
  return data.resultId;
};

/**
 * Busca um resultado específico no Firestore pelo seu ID.
 * @param resultId - O ID do resultado.
 * @returns Os dados do resultado, ou null se não for encontrado.
 */
export const getResult = async (resultId: string): Promise<Result | null> => {
  const docRef = doc(db, "results", resultId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      completedAt: (data.completedAt as Timestamp).toDate(),
    } as Result;
  } else {
    return null;
  }
};

/**
 * Busca todos os resultados de um usuário específico.
 * @param userId - O ID do usuário.
 * @returns Uma lista com os resultados do usuário.
 */
export const getResultsForUser = async (userId: string): Promise<Result[]> => {
  const q = query(
    resultsCollection,
    where("userId", "==", userId),
    orderBy("completedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      completedAt: (data.completedAt as Timestamp).toDate(),
    } as Result;
  });
};

/**
 * Deleta um resultado do Firestore.
 * @param resultId - O ID do resultado a ser deletado.
 */
export const deleteResult = async (resultId: string): Promise<void> => {
  const docRef = doc(db, "results", resultId);
  await deleteDoc(docRef);
};

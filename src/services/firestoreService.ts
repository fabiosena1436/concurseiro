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
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Exam, Question } from "../types/exam";
import type { Result } from "../types/result";

const examsCollection = collection(db, "exams");
const resultsCollection = collection(db, "results");
const questionsCollection = collection(db, "manualQuestions");

/**
 * Busca questões do banco de dados do Firestore com base nos critérios.
 * @param subject - A matéria das questões.
 * @param numQuestions - O número de questões a serem retornadas.
 * @param banca - A banca examinadora.
 * @param difficulty - O nível de dificuldade selecionado no formulário ('medio' ou 'superior').
 * @returns Uma lista de questões.
 */
export const getQuestionsFromFirestore = async (
  subject: string,
  numQuestions: number,
  banca: string,
  difficulty: 'medio' | 'superior'
): Promise<Question[]> => {
  try {
    // Mapeia a seleção do formulário para os valores no banco de dados.
    const difficultyQueryValues = difficulty === 'medio'
      ? ['facil', 'medio']
      : ['dificil'];

    const q = query(
      questionsCollection,
      where("subject", "==", subject),
      where("banca", "==", banca),
      where("difficulty", "in", difficultyQueryValues)
    );

    const querySnapshot = await getDocs(q);
    const allQuestions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'Banco de Questões', // Adiciona a origem da questão
    } as Question));

    // Embaralhar e cortar o número de questões
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numQuestions);

  } catch (error) {
    console.error("Erro ao buscar questões do Firestore:", error);
    return []; // Retorna vazio em caso de erro para o fluxo de fallback funcionar
  }
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
  resultData: Omit<Result, "id" | "completedAt">
): Promise<string> => {
  const docRef = await addDoc(resultsCollection, {
    ...resultData,
    completedAt: serverTimestamp(),
  });
  return docRef.id;
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

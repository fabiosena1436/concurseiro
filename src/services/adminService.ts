import { getFunctions, httpsCallable, HttpsCallable } from 'firebase/functions';

const functions = getFunctions();

interface ManualQuestionPayload {
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  banca: string;
  difficulty: string;
}

interface BatchQuestionPayload extends ManualQuestionPayload {}

interface AddQuestionResponse {
  id: string;
}

interface AddQuestionsBatchResponse {
  message: string;
}

interface SetAdminResponse {
  message: string;
}

const setAdminUser: HttpsCallable<{ email: string }, SetAdminResponse> = httpsCallable(functions, 'setAdmin');
const addQuestion: HttpsCallable<ManualQuestionPayload, AddQuestionResponse> = httpsCallable(functions, 'addQuestionManually');
const addQuestionsBatch: HttpsCallable<BatchQuestionPayload[], AddQuestionsBatchResponse> = httpsCallable(functions, 'addQuestionsBatch');

export const adminService = {
  setAdminUser,
  addQuestion,
  addQuestionsBatch,
};


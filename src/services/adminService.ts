
import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import type { Question } from '../types/exam';

// This is the shape of the data the form will send
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

// This is the shape of the data returned from the cloud function
interface ManualQuestionResponse extends Question {
    createdAt: any; // Firestore timestamp
    createdBy: 'admin';
    authorUid: string;
}

const addQuestionManually = httpsCallable<ManualQuestionPayload, { data: ManualQuestionResponse }> (functions, 'addQuestionManually');
const addQuestionsBatch = httpsCallable<{ questions: ManualQuestionPayload[] }, { data: { message: string } }>(functions, 'addQuestionsBatch');


export const adminService = {
  addQuestion: async (questionData: ManualQuestionPayload): Promise<{ data: ManualQuestionResponse }> => {
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }
    
    // The httpsCallable function automatically includes the user's auth token
    return addQuestionManually(questionData);
  },

  addQuestionsBatch: async (questionData: ManualQuestionPayload[]): Promise<{ data: { message: string } }> => {
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }
    return addQuestionsBatch({ questions: questionData });
  }
};

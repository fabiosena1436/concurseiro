import type { UserAnswer } from "./exam";

export type Result = {
  id: string;
  userId: string;
  examId: string;
  answers: UserAnswer[];
  score: number;
  timeTaken: number; // in seconds
  completedAt: Date;
}

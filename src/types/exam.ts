export type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  subject: string;
};

export type Exam = {
  id:string;
  title: string;
  creatorId: string;
  questions: Question[];
  createdAt: Date;
  banca?: string;
};

export type UserAnswer = {
  questionId: string;
  selectedAnswer: number | null;
  isCorrect: boolean;
};

export type Subject = 'portugues' | 'matematica' | 'informatica' | 'direito';

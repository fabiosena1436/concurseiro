export type QuestionSource = 'topic' | 'edital' | 'pdf';

export type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  subject: string;
};

export type Exam = {
  id: string;
  title: string;
  creatorId: string;
  questions: Question[];
  createdAt: Date;
  banca?: string;
  sourceType?: QuestionSource;
  sourceName?: string;
  sourcePageCount?: number;
};

export type UserAnswer = {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
};

export type Subject = 'portugues' | 'matematica' | 'informatica' | 'direito';

export type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  subject: string;
  source?: 'Banco de Questões' | 'Inteligência Artificial';
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
  selectedAnswer: number;
  isCorrect: boolean;
};

export type Subject = 'portugues' | 'matematica' | 'informatica' | 'direito';

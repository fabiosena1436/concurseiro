export type Paper = {
  id: string;
  title: string;
  year: number;
  banca: string;
  concurso: string;
  orgao: string;
  tipo: string;
  cargo: string;
  escolaridade: string;
  materias: string[];
  sourceUrl?: string;
  attribution?: string;
  notes?: string;
  pdfPath: string;
  answerKeyPath?: string;
  status: 'draft' | 'published';
  rightsConfirmed?: boolean;
  rightsConfirmedBy?: string;
  rightsConfirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BankQuestion = {
  id: string;
  paperId: string;
  sourceText: string;
  number?: string;
  page?: number;
  adapted: boolean;
  text: string;
  format: 'multiple' | 'true_false';
  options: string[];
  correctAnswer: number | null;
  explanation: string;
  observations?: string;
  correctionReason?: string;
  subject: string;
  topic: string;
  banca: string;
  year: number;
  concurso: string;
  tipo: string;
  orgao: string;
  cargo: string;
  escolaridade: string;
  status: 'draft' | 'published' | 'archived';
  warnings: string[];
  version: number;
  reviewedBy?: string;
  reviewedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type CatalogFilters = Partial<Pick<Paper, 'banca' | 'tipo' | 'orgao' | 'cargo' | 'escolaridade' | 'year'>> & { subject?: string; paperId?: string; search?: string };

export type Taxonomy = {bancas: string[]; concursos: string[]; orgaos: string[]; tipos: string[]; cargos: string[]; escolaridades: string[]; materias: string[]; assuntos: string[]};

export type BankAttempt = {
  id: string;
  userId: string;
  questionIds: string[];
  snapshot: BankQuestion[];
  answers: Record<string, number>;
  status: 'in_progress' | 'completed';
  score?: number;
  timeTaken?: number;
  createdAt?: string;
  completedAt?: string;
};
export type BankAttemptSummary = Pick<BankAttempt, 'id' | 'userId' | 'questionIds' | 'status' | 'score' | 'timeTaken' | 'createdAt' | 'completedAt'>;

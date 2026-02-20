// src/services/questionBank.ts

export interface BankQuestion {
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

export const questionBank: { [key: string]: BankQuestion[] } = {
  portugues: [
    {
      text: "Qual a forma correta do plural de 'cidadão'?",
      options: [
        { id: "a", text: "Cidadãos" },
        { id: "b", text: "Cidadões" },
        { id: "c", text: "Cidadães" },
      ],
      correctOptionId: "a",
      explanation: "A forma correta do plural de 'cidadão' é 'cidadãos'.",
    },
    {
      text: "Qual das palavras abaixo é um hiato?",
      options: [
        { id: "a", text: "Pai" },
        { id: "b", text: "Saúde" },
        { id: "c", text: "Mãe" },
      ],
      correctOptionId: "b",
      explanation: "Em 'sa-ú-de', as vogais 'a' e 'u' ficam em sílabas separadas, formando um hiato.",
    },
  ],
  matematica: [
    {
      text: "Quanto é 2 + 2 * 2?",
      options: [
        { id: "a", text: "8" },
        { id: "b", text: "6" },
        { id: "c", text: "4" },
      ],
      correctOptionId: "b",
      explanation: "Seguindo a ordem das operações, primeiro a multiplicação (2 * 2 = 4) e depois a soma (2 + 4 = 6).",
    },
    {
        text: "Qual é a raiz quadrada de 81?",
        options: [
          { id: "a", text: "8" },
          { id: "b", text: "9" },
          { id: "c", text: "7" },
        ],
        correctOptionId: "b",
        explanation: "A raiz quadrada de 81 é 9, pois 9 * 9 = 81.",
    }
  ],
  informatica: [
    {
      text: "O que significa a sigla 'CPU'?",
      options: [
        { id: "a", text: "Central Processing Unit" },
        { id: "b", text: "Computer Personal Unit" },
        { id: "c", text: "Central Power Unit" },
      ],
      correctOptionId: "a",
      explanation: "CPU significa Central Processing Unit, ou Unidade Central de Processamento em português.",
    },
  ],
  direito: [
    {
      text: "O que é Habeas Corpus?",
      options: [
        { id: "a", text: "Um recurso para proteger o direito de propriedade." },
        { id: "b", text: "Uma ação para garantir a liberdade de locomoção." },
        { id: "c", text: "Um imposto sobre grandes fortunas." },
      ],
      correctOptionId: "b",
      explanation: "Habeas Corpus é uma garantia constitucional que protege o direito de ir e vir (liberdade de locomoção).",
    },
  ],
};

export type Subject = keyof typeof questionBank;


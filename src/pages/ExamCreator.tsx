import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { createExam } from '../services/firestoreService';
import { generateQuestionsFromBank } from '../services/aiService';
import { type Subject } from '../types/exam';

const ExamCreatorContainer = styled.div`
  padding: ${(props) => props.theme.spacing.large};
  max-width: 600px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.medium};
`;

const Label = styled.label`
  font-size: 1.1rem;
  color: ${(props) => props.theme.colors.dark};
`;

const Select = styled.select`
  padding: ${(props) => props.theme.spacing.small};
  border-radius: 4px;
  border: 1px solid #ccc;
`;

const Input = styled.input`
  padding: ${(props) => props.theme.spacing.small};
  border-radius: 4px;
  border: 1px solid #ccc;
`;

const Button = styled.button`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.medium};
  border-radius: 8px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: ${(props) => props.theme.colors.secondary};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const bancas = [
    "Cespe/Cebraspe",
    "Fundação Getúlio Vargas (FGV)",
    "Fundação Cesgranrio",
    "Fundação Carlos Chagas (FCC)",
    "Outra"
];


export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject>('portugues');
  const [banca, setBanca] = useState<string>(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!auth.currentUser) {
      setError("Você precisa estar logado para criar um simulado.");
      return;
    }
    if (!subject) {
      setError("Por favor, selecione uma matéria.");
      return;
    }

    const finalBanca = banca === 'Outra' ? customBanca : banca;
    if (banca === 'Outra' && !customBanca) {
      setError("Por favor, digite o nome da banca.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Gerar questões usando o serviço
      const questionsToUse = await generateQuestionsFromBank(subject, numQuestions, finalBanca);

      if (questionsToUse.length === 0) {
        setError("Não há questões disponíveis para os critérios selecionados.");
        setIsLoading(false);
        return;
      }

      // 2. Criar o objeto do simulado
      const examData = {
        title: `Simulado de ${subject.charAt(0).toUpperCase() + subject.slice(1)}`,
        creatorId: auth.currentUser.uid,
        questions: questionsToUse,
        banca: finalBanca,
      };

      // 3. Salvar o simulado usando o serviço de firestore
      const examId = await createExam(examData);

      // 4. Redirecionar para a página da prova
      navigate(`/simulado/${examId}`);

    } catch (err: any) {
      console.error("Erro ao criar o simulado: ", err);
      setError(err.message || "Ocorreu um erro ao criar o simulado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ExamCreatorContainer>
      <Title>Criar Simulado</Title>
      <Form onSubmit={handleSubmit}>
        <Label htmlFor="subject">Matéria:</Label>
        <Select id="subject" value={subject} onChange={(e) => setSubject(e.target.value as Subject)} required>
          <option value="portugues">Português</option>
          <option value="matematica">Matemática</option>
          <option value="informatica">Informática</option>
          <option value="direito">Direito</option>
        </Select>

        <Label htmlFor="banca">Banca Examinadora:</Label>
        <Select id="banca" value={banca} onChange={(e) => setBanca(e.target.value)} required>
            {bancas.map(b => <option key={b} value={b}>{b}</option>)}
        </Select>

        {banca === 'Outra' && (
          <>
            <Label htmlFor="customBanca">Qual banca?</Label>
            <Input
              id="customBanca"
              type="text"
              value={customBanca}
              onChange={(e) => setCustomBanca(e.target.value)}
              placeholder="Digite o nome da banca"
              required
            />
          </>
        )}

        <Label htmlFor="numQuestions">Número de Questões:</Label>
        <Input
          id="numQuestions"
          type="number"
          value={numQuestions}
          onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
          min="1"
          max="50" // Definir um máximo genérico por agora
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Criando...' : 'Iniciar Simulado'}
        </Button>
      </Form>
    </ExamCreatorContainer>
  );
};
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getResult, getExam } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { type Result as ResultType } from '../types/result';
import { type Exam as ExamType, type Question } from '../types/exam';
import { Loader } from '../components/common/Loader';

const ResultsContainer = styled.div`
  padding: ${(props) => props.theme.spacing.large};
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const Summary = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: ${(props) => props.theme.spacing.large};
  margin-bottom: ${(props) => props.theme.spacing.large};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${(props) => props.theme.spacing.medium};
`;

const SummaryItem = styled.div`
  text-align: center;
  & > h3 {
    margin-bottom: ${(props) => props.theme.spacing.small};
    color: ${(props) => props.theme.colors.dark};
  }
  & > p {
    font-size: 1.2rem;
    font-weight: bold;
    color: ${(props) => props.theme.colors.primary};
  }
`;

const ReportContainer = styled.div``;

const ReportTitle = styled.h2`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.medium};
  border-bottom: 2px solid ${(props) => props.theme.colors.primary};
  padding-bottom: ${(props) => props.theme.spacing.small};
`;

const QuestionResult = styled.div<{ isCorrect: boolean }>`
  margin-bottom: ${(props) => props.theme.spacing.medium};
  padding: ${(props) => props.theme.spacing.medium};
  border: 1px solid ${(props) => (props.isCorrect ? props.theme.colors.success : props.theme.colors.danger)};
  border-left-width: 5px;
  border-radius: 8px;
  background-color: #fff;
`;

const QuestionText = styled.p`
  font-weight: bold;
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const AnswerText = styled.p<{ isCorrect?: boolean; isUserAnswer?: boolean }>`
  margin-bottom: ${(props) => props.theme.spacing.small};
  color: ${({ isCorrect, isUserAnswer, theme }) => {
    if (isUserAnswer) return isCorrect ? theme.colors.success : theme.colors.danger;
    return theme.colors.dark;
  }};
`;

const Explanation = styled.p`
  margin-top: ${(props) => props.theme.spacing.small};
  padding-top: ${(props) => props.theme.spacing.small};
  border-top: 1px solid #eee;
  font-style: italic;
  color: #555;
`;

const BackButton = styled(Link)`
  display: inline-block;
  margin-top: ${(props) => props.theme.spacing.large};
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.medium};
  border-radius: 8px;
  text-decoration: none;
  text-align: center;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${(props) => props.theme.colors.secondary};
  }
`;

export const Results: React.FC = () => {
  const { id: resultId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [result, setResult] = useState<ResultType | null>(null);
  const [exam, setExam] = useState<ExamType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId || !user) {
      navigate('/');
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const resultData = await getResult(resultId);
        if (!resultData || resultData.userId !== user.uid) {
          setError("Resultado não encontrado ou não autorizado.");
          return;
        }

        const examData = await getExam(resultData.examId);
        if (!examData) {
          setError("Simulado correspondente não encontrado.");
          return;
        }

        setResult(resultData);
        setExam(examData);

      } catch (err) {
        console.error("Erro ao buscar resultados:", err);
        setError("Não foi possível carregar os resultados.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();

  }, [resultId, user, navigate]);

  if (isLoading) {
    return <Loader>Carregando resultados...</Loader>;
  }

  if (error) {
    return <ResultsContainer><h1>{error}</h1></ResultsContainer>;
  }

  if (!result || !exam) {
    return null;
  }

  const findQuestionById = (id: string): Question | undefined => {
    return exam.questions.find(q => q.id === id);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <ResultsContainer>
      <Title>Resultados do Simulado: {exam.title}</Title>
      
      <Summary>
        <SummaryItem>
          <h3>Pontuação</h3>
          <p>{result.score.toFixed(1)}%</p>
        </SummaryItem>
        <SummaryItem>
          <h3>Acertos</h3>
          <p>{result.answers.filter(a => a.isCorrect).length} / {exam.questions.length}</p>
        </SummaryItem>
        <SummaryItem>
          <h3>Tempo Gasto</h3>
          <p>{formatTime(result.timeTaken)}</p>
        </SummaryItem>
         <SummaryItem>
          <h3>Data</h3>
          <p>{new Date(result.completedAt).toLocaleDateString()}</p>
        </SummaryItem>
      </Summary>

      <ReportContainer>
        <ReportTitle>Relatório Detalhado</ReportTitle>
        {result.answers.map((answer) => {
          const question = findQuestionById(answer.questionId);
          if (!question) return null;

          const userAnswerText = answer.selectedAnswer !== undefined ? question.options[answer.selectedAnswer] : "Não respondida";
          const correctAnswerText = question.options[question.correctAnswer];

          return (
            <QuestionResult key={question.id} isCorrect={answer.isCorrect}>
              <QuestionText>{question.question}</QuestionText>
              <AnswerText isUserAnswer isCorrect={answer.isCorrect}>Sua resposta: {userAnswerText}</AnswerText>
              {!answer.isCorrect && (
                <AnswerText>Resposta correta: {correctAnswerText}</AnswerText>
              )}
              {question.explanation && (
                <Explanation><strong>Explicação:</strong> {question.explanation}</Explanation>
              )}
            </QuestionResult>
          );
        })}
      </ReportContainer>

      <BackButton to="/dashboard">Voltar para o Dashboard</BackButton>
    </ResultsContainer>
  );
};


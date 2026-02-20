import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { getResultsForUser, getExam } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import type { Result } from '../types/result';
import { Loader } from '../components/common/Loader';

interface ResultWithExamTitle extends Result {
  examTitle: string;
}

const DashboardContainer = styled.div`
  padding: ${(props) => props.theme.spacing.large};
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const Section = styled.section`
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const SectionTitle = styled.h2`
  color: ${(props) => props.theme.colors.primary};
  margin-bottom: ${(props) => props.theme.spacing.medium};
  border-bottom: 2px solid ${(props) => props.theme.colors.primary};
  padding-bottom: ${(props) => props.theme.spacing.small};
`;

const ResultsList = styled.ul`
  list-style: none;
  padding: 0;
`;

const ResultItem = styled.li`
  background-color: #fff;
  margin-bottom: ${(props) => props.theme.spacing.medium};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${(props) => props.theme.spacing.medium};
    text-decoration: none;
    color: ${(props) => props.theme.colors.dark};
  }
`;

const ResultInfo = styled.div`
  flex-grow: 1;
`;

const ExamTitle = styled.span`
  font-weight: bold;
  font-size: 1.1rem;
`;

const ExamDate = styled.span`
  display: block;
  color: #6c757d;
  font-size: 0.9rem;
`;

const ResultScore = styled.div<{ score: number }>`
  font-size: 1.2rem;
  font-weight: bold;
  color: ${({ score, theme }) => {
    if (score >= 70) return theme.colors.success;
    if (score >= 50) return theme.colors.warning;
    return theme.colors.danger;
  }};
`;

const CreateExamButton = styled(Link)`
  display: inline-block;
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.medium};
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  text-align: center;
`;

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultWithExamTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    };

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userResults = await getResultsForUser(user.uid);
        
        // Para cada resultado, buscar o título do simulado correspondente
        const resultsWithTitles = await Promise.all(
          userResults.map(async (result) => {
            const exam = await getExam(result.examId);
            return {
              ...result,
              examTitle: exam?.title || 'Simulado Desconhecido',
            };
          })
        );
        
        setResults(resultsWithTitles);

      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        setError("Não foi possível carregar seu histórico de simulados.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  return (
    <DashboardContainer>
      <Title>Meu Desempenho</Title>

      <Section>
        <SectionTitle>Histórico de Simulados</SectionTitle>
        {isLoading && <Loader>Carregando histórico...</Loader>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {!isLoading && !error && (
          results.length > 0 ? (
            <ResultsList>
              {results.map(result => (
                <ResultItem key={result.id}>
                  <Link to={`/resultados/${result.id}`}>
                    <ResultInfo>
                      <ExamTitle>{result.examTitle}</ExamTitle>
                      <ExamDate>
                        Realizado em: {new Date(result.completedAt).toLocaleDateString()}
                      </ExamDate>
                    </ResultInfo>
                    <ResultScore score={result.score}>
                      {result.score.toFixed(1)}%
                    </ResultScore>
                  </Link>
                </ResultItem>
              ))}
            </ResultsList>
          ) : (
            <>
              <p>Você ainda não completou nenhum simulado.</p>
              <CreateExamButton to="/criar-simulado">Criar meu primeiro simulado</CreateExamButton>
            </>
          )
        )}
      </Section>
    </DashboardContainer>
  );
};

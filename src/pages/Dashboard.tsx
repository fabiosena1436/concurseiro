import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getResultsForUser, getExam } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import type { Result } from '../types/result';
import { Loader } from '../components/common/Loader';
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Paper,
  Button,
  Divider,
} from '@mui/material';

interface ResultWithExamTitle extends Result {
  examTitle: string;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return 'success.main';
  if (score >= 50) return 'warning.main';
  return 'error.main';
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultWithExamTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userResults = await getResultsForUser(user.uid);

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
        console.error('Erro ao buscar histórico:', err);
        setError('Não foi possível carregar seu histórico de simulados.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Meu Desempenho
      </Typography>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" color="primary" gutterBottom>
          Histórico de Simulados
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {isLoading && <Loader>Carregando histórico...</Loader>}
        {error && <Typography color="error">{error}</Typography>}

        {!isLoading && !error && (
          results.length > 0 ? (
            <List>
              {results.map((result, index) => (
                <ListItem
                  key={result.id}
                  divider={index < results.length - 1}
                  secondaryAction={
                    <Button
                      component={Link}
                      to={`/resultados/${result.id}`}
                      variant="outlined"
                    >
                      Ver
                    </Button>
                  }
                >
                  <ListItemText
                    primary={result.examTitle}
                    secondary={`Realizado em: ${new Date(
                      result.completedAt
                    ).toLocaleDateString()}`}
                  />
                  <Typography
                    variant="h6"
                    component="div"
                    color={getScoreColor(result.score)}
                  >
                    {result.score.toFixed(1)}%
                  </Typography>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography>
                Você ainda não completou nenhum simulado.
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                component={Link}
                to="/criar-simulado"
              >
                Criar meu primeiro simulado
              </Button>
            </Box>
          )
        )}
      </Paper>
    </Container>
  );
};

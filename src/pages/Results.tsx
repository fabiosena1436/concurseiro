import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getResult, getExam } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { type Result as ResultType } from '../types/result';
import { type Exam as ExamType, type Question } from '../types/exam';
import { Loader } from '../components/common/Loader';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Box,
  Card,
  CardContent,
  Button,
  Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export const Results: React.FC = () => {
  const { id: resultId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [result, setResult] = useState<ResultType | null>(null);
  const [exam, setExam] = useState<ExamType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
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

  }, [resultId, user, navigate, loading]);

  if (isLoading) {
    return <Loader>Carregando resultados...</Loader>;
  }

  if (error) {
    return <Container><Typography color="error">{error}</Typography></Container>;
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Resultados do Simulado: {exam.title}
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2} textAlign="center">
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="h6">Pontuação</Typography>
            <Typography variant="h4" color="primary">{result.score.toFixed(1)}%</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="h6">Acertos</Typography>
            <Typography variant="h4" color="primary">
              {result.answers.filter(a => a.isCorrect).length} / {exam.questions.length}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="h6">Tempo Gasto</Typography>
            <Typography variant="h4" color="primary">{formatTime(result.timeTaken)}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="h6">Data</Typography>
            <Typography variant="h4" color="primary">{new Date(result.completedAt).toLocaleDateString()}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        Relatório Detalhado
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      <Box>
        {result.answers.map((answer, index) => {
          const question = findQuestionById(answer.questionId);
          if (!question) return null;

          const userAnswerText = answer.selectedAnswer !== undefined ? question.options[answer.selectedAnswer] : "Não respondida";
          const correctAnswerText = question.options[question.correctAnswer];

          return (
            <Card key={question.id} sx={{ mb: 2, borderLeft: 5, borderColor: answer.isCorrect ? 'success.main' : 'error.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>{index + 1}. {question.question}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {answer.isCorrect ? <CheckCircleIcon color="success" sx={{ mr: 1 }} /> : <CancelIcon color="error" sx={{ mr: 1 }} />}
                  <Typography color={answer.isCorrect ? 'success.main' : 'error.main'}>
                    Sua resposta: {userAnswerText}
                  </Typography>
                </Box>
                {!answer.isCorrect && (
                  <Typography color="text.secondary">
                    Resposta correta: {correctAnswerText}
                  </Typography>
                )}
                {question.explanation && (
                  <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                    <strong>Explicação:</strong> {question.explanation}
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button component={Link} to="/dashboard" variant="outlined">
          Voltar para o Dashboard
        </Button>
        <Button component={Link} to={`/simulado/${result.examId}`} variant="contained">
          Responder Novamente
        </Button>
      </Box>
    </Container>
  );
};

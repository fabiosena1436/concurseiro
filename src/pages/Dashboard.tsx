import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResultsForUser, getExam, deleteResult } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import type { Result } from '../types/result';
import { Loader } from '../components/common/Loader';
import {
  Container,
  Typography,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Button,
  Divider,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip
  , Grid, Card, CardContent
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';


interface ResultWithExamTitle extends Result {
  examTitle: string;
  subjectScores: Record<string, { correct: number; total: number }>;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return 'success.main';
  if (score >= 50) return 'warning.main';
  return 'error.main';
};

// 1. FUNÇÃO PARA TRUNCAR TEXTO
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}...`;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ResultWithExamTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<string | null>(null);

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
            const subjectScores: Record<string, { correct: number; total: number }> = {};
            for (const answer of result.answers) {
              const subject = exam?.questions.find(question => question.id === answer.questionId)?.subject || 'Geral';
              const current = subjectScores[subject] ?? { correct: 0, total: 0 };
              subjectScores[subject] = { correct: current.correct + (answer.isCorrect ? 1 : 0), total: current.total + 1 };
            }
            return {
              ...result,
              examTitle: exam?.title || 'Simulado Desconhecido',
              subjectScores,
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

    void fetchHistory();
  }, [user]);
  
  const handleClickDelete = (resultId: string) => {
    setResultToDelete(resultId);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setResultToDelete(null);
  };

  const handleDelete = async () => {
    if (resultToDelete) {
      try {
        await deleteResult(resultToDelete);
        setResults(results.filter(result => result.id !== resultToDelete));
      } catch (err) {
        console.error('Erro ao deletar resultado:', err);
        setError('Não foi possível deletar o resultado.');
      } finally {
        handleCloseDialog();
      }
    }
  };

  const averageScore = results.length ? results.reduce((sum, result) => sum + result.score, 0) / results.length : 0;
  const latestResult = results[0];
  const subjectTotals: Record<string, { correct: number; total: number }> = {};
  for (const result of results) {
    for (const [subject, score] of Object.entries(result.subjectScores)) {
      const current = subjectTotals[subject] ?? { correct: 0, total: 0 };
      subjectTotals[subject] = { correct: current.correct + score.correct, total: current.total + score.total };
    }
  }
  const weakestSubjects = Object.entries(subjectTotals).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Meu Desempenho
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Simulados concluídos', value: String(results.length) },
          { label: 'Média de acertos', value: results.length ? `${averageScore.toFixed(1)}%` : '—' },
          { label: 'Última pontuação', value: latestResult ? `${latestResult.score.toFixed(1)}%` : '—' },
        ].map(metric => <Grid key={metric.label} size={{ xs: 12, sm: 4 }}><Card sx={{ height: '100%' }}><CardContent><Typography variant="body2" color="text.secondary">{metric.label}</Typography><Typography variant="h4" color="primary" sx={{ mt: 1 }}>{metric.value}</Typography></CardContent></Card></Grid>)}
      </Grid>
      <Button component={Link} to="/criar-simulado" variant="contained" sx={{ mb: 3 }}>Criar novo simulado</Button>

      {results.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}><CardContent>
              <Typography variant="h6" component="h2" gutterBottom>Evolução recente</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Pontuação das últimas {Math.min(results.length, 5)} tentativas, em ordem cronológica.</Typography>
              <Box sx={{ display: 'flex', alignItems: 'end', gap: 1.5, height: 150 }}>
                {results.slice(0, 5).reverse().map(result => <Box key={result.id} sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={700}>{result.score.toFixed(0)}%</Typography>
                  <Box role="img" aria-label={`${result.examTitle}: ${result.score.toFixed(0)} por cento`} sx={{ height: `${Math.max(result.score, 4) * 1.1}px`, minHeight: 6, bgcolor: getScoreColor(result.score), borderRadius: '5px 5px 0 0', mt: 0.5 }} />
                </Box>)}
              </Box>
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}><CardContent>
              <Typography variant="h6" component="h2" gutterBottom>Matérias para revisar</Typography>
              {weakestSubjects.slice(0, 3).map(([subject, score]) => <Box key={subject} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography>{subject}</Typography><Typography fontWeight={700}>{Math.round(score.correct / score.total * 100)}%</Typography></Box>
                <Box sx={{ bgcolor: 'primary.light', height: 8, borderRadius: 4 }}><Box sx={{ bgcolor: 'primary.main', height: 8, width: `${score.correct / score.total * 100}%`, borderRadius: 4 }} /></Box>
              </Box>)}
              <Typography variant="body2" color="text.secondary">Comece pela matéria com menor taxa de acertos.</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      <Paper elevation={3} sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
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
                <ListItemButton
                  key={result.id}
                  onClick={() => void navigate(`/resultados/${result.id}`)}
                  divider={index < results.length - 1}
                >
                  {/* 2. APLICAR FUNÇÃO NO TÍTULO E ADICIONAR TOOLTIP */}
                  <Tooltip title={result.examTitle} placement="top-start">
                    <ListItemText
                      primary={truncateText(result.examTitle, 70)}
                      secondary={`Realizado em: ${new Date(
                        result.completedAt
                      ).toLocaleDateString()}`}
                    />
                  </Tooltip>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography
                        variant="h6"
                        component="div"
                        color={getScoreColor(result.score)}
                        sx={{ mr: 2 }}
                      >
                        {result.score.toFixed(1)}%
                      </Typography>
                      <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleClickDelete(result.id);}}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                </ListItemButton>
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
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Confirmar exclusão"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Você tem certeza que deseja apagar este resultado? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={() => void handleDelete()} color="error">
            Apagar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

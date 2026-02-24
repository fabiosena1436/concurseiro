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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';


interface ResultWithExamTitle extends Result {
  examTitle: string;
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Meu Desempenho
      </Typography>

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
                  onClick={() => navigate(`/resultados/${result.id}`)}
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

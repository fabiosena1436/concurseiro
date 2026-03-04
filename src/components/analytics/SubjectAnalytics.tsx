
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getResultsForUser } from '../../services/firestoreService';
import { type Result } from '../../types/result';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography, CircularProgress, Paper, Button, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface SubjectPerformance {
  subject: string;
  correct: number;
  total: number;
  percentage: number;
}

const PerformanceChart: React.FC<{ data: SubjectPerformance[] }> = ({ data }) => (
    <ResponsiveContainer width="100%" height="100%">
        <BarChart
            data={data}
            margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
            }}
        >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subject" />
            <YAxis
                label={{ value: 'Acertos (%)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `${value}%`}
            />
            <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Aproveitamento']} />
            <Legend verticalAlign="top" wrapperStyle={{ lineHeight: '40px' }} />
            <Bar dataKey="percentage" name="Aproveitamento (%)" fill="#8884d8" />
        </BarChart>
    </ResponsiveContainer>
);

export const SubjectAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [performanceData, setPerformanceData] = useState<SubjectPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };


  useEffect(() => {
    const fetchAndProcessData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const results = await getResultsForUser(user.uid);
        
        if (results.length === 0) {
          setPerformanceData([]);
          setLoading(false);
          return;
        }

        const performanceMap = new Map<string, { correct: number; total: number }>();

        for (const result of results) {
          for (const question of result.questions) {
            const subject = question.subject || 'Outros';
            if (!performanceMap.has(subject)) {
              performanceMap.set(subject, { correct: 0, total: 0 });
            }
            const stats = performanceMap.get(subject)!;
            stats.total++;
            const answer = result.answers[question.id];
            if (answer !== undefined && answer === question.correctAnswer) {
              stats.correct++;
            }
          }
        }

        const data: SubjectPerformance[] = Array.from(performanceMap.entries()).map(([subject, stats]) => ({
          subject,
          ...stats,
          percentage: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        }));

        setPerformanceData(data);
      } catch (err) {
        console.error("Error fetching or processing performance data:", err);
        setError('Falha ao carregar a análise de desempenho.');
      } finally {
        setLoading(false);
      }
    };

    void fetchAndProcessData();
  }, [user]);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (performanceData.length === 0) {
    return <Typography>Ainda não há dados de desempenho para exibir. Faça um simulado!</Typography>;
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h2" gutterBottom>
                Desempenho por Matéria
            </Typography>
            <Button variant="outlined" onClick={handleClickOpen}>
                Ver em Tela Cheia
            </Button>
        </Box>
        <Box sx={{ height: 400 }}>
            <PerformanceChart data={performanceData} />
        </Box>

        <Dialog
            fullScreen
            open={open}
            onClose={handleClose}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Desempenho por Matéria (Tela Cheia)
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <PerformanceChart data={performanceData} />
            </DialogContent>
        </Dialog>
    </Paper>
  );
};

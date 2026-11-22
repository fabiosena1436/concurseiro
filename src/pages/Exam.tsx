import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, saveResult } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { type Exam as ExamType, type UserAnswer } from '../types/exam';
import { Loader } from '../components/common/Loader';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Grid,
  Chip,
  CircularProgress,
  Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert
} from '@mui/material';

export const Exam: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exam, setExam] = useState<ExamType | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hora
  const [showFeedback, setShowFeedback] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const submittingRef = useRef(false);
  const storageKey = `exam-progress:${user?.uid ?? 'guest'}:${examId ?? ''}`;

  useEffect(() => {
    if (!user) return;
    if (!examId) {
      void navigate('/');
      return;
    }

    const fetchExam = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const examData = await getExam(examId);
        if (examData) {
          setExam(examData);
          try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as { answers?: Record<string, number>; marked?: string[]; startedAt?: number } | null;
            if (saved?.startedAt && Number.isFinite(saved.startedAt)) {
              setStartTime(saved.startedAt);
              setUserAnswers(saved.answers ?? {});
              setMarkedForReview(saved.marked ?? []);
            } else {
              setStartTime(Date.now());
            }
          } catch {
            localStorage.removeItem(storageKey);
            setStartTime(Date.now());
          }
        } else {
          setError("Simulado não encontrado!");
        }
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar o simulado.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchExam();
  }, [examId, navigate, storageKey, user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, 3600 - Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    if (exam) localStorage.setItem(storageKey, JSON.stringify({ answers: userAnswers, marked: markedForReview, startedAt: startTime }));
  }, [exam, storageKey, userAnswers, markedForReview, startTime]);

  const handleAnswerChange = (questionId: string, optionIndex: number) => {
    if (showFeedback) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleCorrect = () => {
    setShowFeedback(true);
  }

  const handleNext = () => {
    if (exam && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowFeedback(false);
    }
  };

  const toggleMarkForReview = (questionId: string) => {
    setMarkedForReview(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleFinishExam = async () => {
    if (!exam || !user || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    const answers: UserAnswer[] = exam.questions.map(q => {
      const selectedAnswer = userAnswers[q.id];
      return {
        questionId: q.id,
        selectedAnswer: selectedAnswer ?? null,
        isCorrect: false,
      };
    });

    try {
      const resultId = await saveResult({
        examId: exam.id,
        answers,
        timeTaken,
      });
      localStorage.removeItem(storageKey);
      void navigate(`/resultados/${resultId}`);
    } catch (err) {
      console.error(err);
      setError("Falha ao salvar o resultado.");
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    if (exam && timeLeft === 0 && !isLoading) void handleFinishExam();
    // A entrega ocorre quando o tempo se esgota; o bloqueio por ref evita duplicidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, exam, isLoading]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => (v < 10 ? '0' + v : v)).join(':');
  };

  const currentQuestion = useMemo(() => exam?.questions[currentQuestionIndex], [exam, currentQuestionIndex]);

  if (isLoading) return <Loader>Carregando simulado...</Loader>;
  if (error && !exam) return <Container><Alert severity="error">{error}</Alert></Container>;
  if (!exam || !currentQuestion) return null;

  const selectedAnswer = userAnswers[currentQuestion.id];
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;


  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">{exam.title}</Typography>
        <Chip label={`Tempo: ${formatTime(timeLeft)}`} color="secondary" />
      </Box>

      <Card component={Paper} elevation={3}>
        <CardContent>
          <Typography variant="h6" component="p" sx={{ mb: 2 }}>
            {currentQuestionIndex + 1}. {currentQuestion.question}
          </Typography>
          <FormControl component="fieldset" disabled={showFeedback}>
            <RadioGroup
              name={currentQuestion.id}
              value={userAnswers[currentQuestion.id] ?? ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, parseInt(e.target.value))}
            >
              {currentQuestion.options.map((option, index) => (
                <FormControlLabel 
                  key={index} 
                  value={index} 
                  control={<Radio />} 
                  label={option}
                  sx={{
                    color: showFeedback && index === currentQuestion.correctAnswer ? 'success.main' : (showFeedback && index === selectedAnswer && !isCorrect ? 'error.main' : 'inherit'),
                  }}
                />
              ))}
            </RadioGroup>
          </FormControl>
           {showFeedback && (
              <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body1" color={isCorrect ? 'success.main' : 'error.main'}>
                  {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta.'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Explicação:</strong> {currentQuestion.explanation}
                </Typography>
              </Box>
            )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
        >
          Anterior
        </Button>
        <Button
          variant="outlined"
          color={markedForReview.includes(currentQuestion.id) ? 'secondary' : 'primary'}
          onClick={() => toggleMarkForReview(currentQuestion.id)}
        >
          {markedForReview.includes(currentQuestion.id) ? 'Desmarcar' : 'Marcar para Revisão'}
        </Button>
        {showFeedback ? (
            currentQuestionIndex < exam.questions.length - 1 ? (
              <Button variant="contained" onClick={handleNext}>
                Próxima
              </Button>
            ) : (
              <Button variant="contained" color="success" onClick={() => setConfirmFinish(true)} disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Finalizar Simulado'}
              </Button>
            )
        ) : (
          <Button variant="contained" onClick={handleCorrect} disabled={selectedAnswer === undefined}>
            Corrigir
          </Button>
        )}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="text.secondary">{Object.keys(userAnswers).length} de {exam.questions.length} respondidas · {markedForReview.length} para revisão</Typography>
        <Button onClick={() => setConfirmFinish(true)} disabled={isSubmitting}>Finalizar agora</Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>Navegação</Typography>
        <Grid container spacing={1}>
          {exam.questions.map((q, index) => (
            <Grid key={q.id}>
              <Chip
                label={`${index + 1}${markedForReview.includes(q.id) ? ' ★' : ''}`}
                clickable
                onClick={() => { setCurrentQuestionIndex(index); setShowFeedback(false); }}
                aria-label={`Questão ${index + 1}${markedForReview.includes(q.id) ? ', marcada para revisão' : ''}${userAnswers[q.id] !== undefined ? ', respondida' : ''}`}
                color={
                  userAnswers[q.id] !== undefined
                    ? 'primary'
                    : markedForReview.includes(q.id)
                    ? 'secondary'
                    : 'default'
                }
                variant={currentQuestionIndex === index ? 'filled' : 'outlined'}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Dialog open={confirmFinish} onClose={() => setConfirmFinish(false)}>
        <DialogTitle>Entregar simulado?</DialogTitle>
        <DialogContent><DialogContentText>
          Você respondeu {Object.keys(userAnswers).length} de {exam.questions.length} questões. {exam.questions.length - Object.keys(userAnswers).length > 0 ? `${exam.questions.length - Object.keys(userAnswers).length} ficarão sem resposta. ` : ''}Após entregar, você verá a correção completa.
        </DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setConfirmFinish(false)}>Continuar respondendo</Button><Button variant="contained" onClick={() => void handleFinishExam()} disabled={isSubmitting}>Entregar</Button></DialogActions>
      </Dialog>
    </Container>
  );
};

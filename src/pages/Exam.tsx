import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
  AlertTitle
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

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

  useEffect(() => {
    if (!examId) {
      navigate('/');
      return;
    }

    const fetchExam = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const examData = await getExam(examId);
        if (examData) {
          setExam(examData);
          setStartTime(Date.now());
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
  }, [examId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    if (!exam || !user) return;

    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    const answers: UserAnswer[] = exam.questions.map(q => {
      const selectedAnswer = userAnswers[q.id];
      return {
        questionId: q.id,
        selectedAnswer: selectedAnswer,
        isCorrect: selectedAnswer === q.correctAnswer,
      };
    });

    const score = (answers.filter(a => a.isCorrect).length / exam.questions.length) * 100;

    try {
      const resultId = await saveResult({
        userId: user.uid,
        examId: exam.id,
        answers,
        score: parseFloat(score.toFixed(2)),
        timeTaken,
      });
      navigate(`/resultados/${resultId}`);
    } catch (err) {
      console.error(err);
      setError("Falha ao salvar o resultado.");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => (v < 10 ? '0' + v : v)).join(':');
  };

  const currentQuestion = useMemo(() => exam?.questions[currentQuestionIndex], [exam, currentQuestionIndex]);

  if (isLoading) return <Loader>Carregando simulado...</Loader>;
  if (error) return <Container><Typography color="error">{error}</Typography></Container>;
  if (!exam || !currentQuestion) return null;

  const selectedAnswer = userAnswers[currentQuestion.id];
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
  const questionSource = exam.questions[0]?.source;


  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">{exam.title}</Typography>
        <Chip label={`Tempo: ${formatTime(timeLeft)}`} color="secondary" />
      </Box>

      {questionSource && (
        <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3 }}>
          <AlertTitle>Origem das Questões</AlertTitle>
          Este simulado foi gerado utilizando: <strong>{questionSource}</strong>.
        </Alert>
      )}

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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
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
              <Button variant="contained" color="success" onClick={() => void handleFinishExam()} disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Finalizar Simulado'}
              </Button>
            )
        ) : (
          <Button variant="contained" onClick={handleCorrect} disabled={selectedAnswer === undefined}>
            Corrigir
          </Button>
        )}
      </Box>

      <Paper elevation={2} sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>Navegação</Typography>
        <Grid container spacing={1}>
          {exam.questions.map((q, index) => (
            <Grid key={q.id}>
              <Chip
                label={index + 1}
                clickable
                onClick={() => setCurrentQuestionIndex(index)}
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
    </Container>
  );
};

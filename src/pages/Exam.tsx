import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, saveResult } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { type Exam as ExamType, type Question, type UserAnswer } from '../types/exam';
import { Loader } from '../components/common/Loader'; // Um novo componente que você pode criar

const ExamContainer = styled.div`
  padding: ${(props) => props.theme.spacing.large};
  max-width: 900px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const ExamHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const Timer = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
`;

const QuestionCard = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: ${(props) => props.theme.spacing.large};
`;

const QuestionText = styled.p`
  font-size: 1.2rem;
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.small};
`;

const OptionLabel = styled.label<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.small};
  cursor: pointer;
  padding: ${(props) => props.theme.spacing.medium};
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: ${(props) => (props.isSelected ? '#e7f3ff' : 'transparent')};
  border-color: ${(props) => (props.isSelected ? props.theme.colors.primary : '#ddd')};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(props) => props.theme.colors.secondary};
  }
`;

const Navigation = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${(props) => props.theme.spacing.large};
`;

const NavButton = styled.button`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.small} ${(props) => props.theme.spacing.medium};
  border-radius: 4px;
  cursor: pointer;
  border: none;

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const FinishButton = styled(NavButton)`
  background-color: ${(props) => props.theme.colors.success};
  &:hover { background-color: #218838; }
`;

const MarkReviewButton = styled(NavButton)`
  background-color: ${(props) => props.theme.colors.warning};
   &:hover { background-color: #e0a800; }
`;

const QuestionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: ${(props) => props.theme.spacing.small};
  margin-top: ${(props) => props.theme.spacing.large};
`;

const QuestionGridItem = styled.div<{ status: 'answered' | 'marked' | 'unvisited' }>`
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background-color: ${({ status, theme }) => {
    if (status === 'answered') return theme.colors.success;
    if (status === 'marked') return theme.colors.warning;
    return 'white';
  }};
  color: ${({ status }) => (status === 'unvisited' ? 'black' : 'white')};
`;


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

    fetchExam();
  }, [examId, navigate]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAnswerChange = (questionId: string, optionIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = () => {
    if (exam && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
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
  if (error) return <ExamContainer><h1>{error}</h1></ExamContainer>;
  if (!exam || !currentQuestion) return null;

  return (
    <ExamContainer>
      <ExamHeader>
        <Title>{exam.title}</Title>
        <Timer>Tempo: {formatTime(timeLeft)}</Timer>
      </ExamHeader>

      <QuestionCard>
        <QuestionText>{currentQuestionIndex + 1}. {currentQuestion.question}</QuestionText>
        <OptionsContainer>
          {currentQuestion.options.map((option, index) => (
            <OptionLabel key={index} isSelected={userAnswers[currentQuestion.id] === index}>
              <input
                type="radio"
                name={currentQuestion.id}
                value={index}
                checked={userAnswers[currentQuestion.id] === index}
                onChange={() => handleAnswerChange(currentQuestion.id, index)}
                style={{ display: 'none' }}
              />
              <span>{option}</span>
            </OptionLabel>
          ))}
        </OptionsContainer>
      </QuestionCard>

      <Navigation>
        <NavButton onClick={handlePrev} disabled={currentQuestionIndex === 0}>
          Anterior
        </NavButton>
        <MarkReviewButton onClick={() => toggleMarkForReview(currentQuestion.id)}>
          {markedForReview.includes(currentQuestion.id) ? 'Desmarcar' : 'Marcar para Revisão'}
        </MarkReviewButton>
        {currentQuestionIndex < exam.questions.length - 1 ? (
          <NavButton onClick={handleNext}>
            Próxima
          </NavButton>
        ) : (
          <FinishButton onClick={handleFinishExam} disabled={isSubmitting}>
            {isSubmitting ? 'Finalizando...' : 'Finalizar Simulado'}
          </FinishButton>
        )}
      </Navigation>

      <QuestionGrid>
        {exam.questions.map((q, index) => (
          <QuestionGridItem 
            key={q.id}
            onClick={() => setCurrentQuestionIndex(index)}
            status={
              userAnswers[q.id] !== undefined 
                ? 'answered' 
                : markedForReview.includes(q.id) 
                ? 'marked' 
                : 'unvisited'
            }
          >
            {index + 1}
          </QuestionGridItem>
        ))}
      </QuestionGrid>
    </ExamContainer>
  );
};


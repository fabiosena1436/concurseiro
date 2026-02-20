import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { createExam } from '../services/firestoreService';
import { generateQuestionsFromBank } from '../services/aiService';
import { type Subject } from '../types/exam';
import {
  Container,
  Typography,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert
} from '@mui/material';

const bancas = [
    "Cespe/Cebraspe",
    "Fundação Getúlio Vargas (FGV)",
    "Fundação Cesgranrio",
    "Fundação Carlos Chagas (FCC)",
    "Outra"
];

export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject>('portugues');
  const [banca, setBanca] = useState<string>(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!auth.currentUser) {
      setError("Você precisa estar logado para criar um simulado.");
      return;
    }
    if (!subject) {
      setError("Por favor, selecione uma matéria.");
      return;
    }

    const finalBanca = banca === 'Outra' ? customBanca : banca;
    if (banca === 'Outra' && !customBanca) {
      setError("Por favor, digite o nome da banca.");
      return;
    }

    setIsLoading(true);

    try {
      const questionsToUse = await generateQuestionsFromBank(subject, numQuestions, finalBanca);

      if (questionsToUse.length === 0) {
        setError("Não há questões disponíveis para os critérios selecionados.");
        setIsLoading(false);
        return;
      }

      const examData = {
        title: `Simulado de ${subject.charAt(0).toUpperCase() + subject.slice(1)}`,
        creatorId: auth.currentUser.uid,
        questions: questionsToUse,
        banca: finalBanca,
      };

      const examId = await createExam(examData);

      navigate(`/simulado/${examId}`);

    } catch (err: any) {
      console.error("Erro ao criar o simulado: ", err);
      setError(err.message || "Ocorreu um erro ao criar o simulado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Criar Simulado
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel id="subject-label">Matéria</InputLabel>
          <Select
            labelId="subject-label"
            id="subject"
            value={subject}
            label="Matéria"
            onChange={(e) => setSubject(e.target.value as Subject)}
            required
          >
            <MenuItem value="portugues">Português</MenuItem>
            <MenuItem value="matematica">Matemática</MenuItem>
            <MenuItem value="informatica">Informática</MenuItem>
            <MenuItem value="direito">Direito</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel id="banca-label">Banca Examinadora</InputLabel>
          <Select
            labelId="banca-label"
            id="banca"
            value={banca}
            label="Banca Examinadora"
            onChange={(e) => setBanca(e.target.value)}
            required
          >
            {bancas.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>

        {banca === 'Outra' && (
          <TextField
            fullWidth
            margin="normal"
            id="customBanca"
            label="Qual banca?"
            value={customBanca}
            onChange={(e) => setCustomBanca(e.target.value)}
            placeholder="Digite o nome da banca"
            required
          />
        )}

        <TextField
          fullWidth
          margin="normal"
          id="numQuestions"
          label="Número de Questões"
          type="number"
          value={numQuestions}
          onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
          InputProps={{ inputProps: { min: 1, max: 50 } }}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Iniciar Simulado'}
        </Button>
      </Box>
    </Container>
  );
};
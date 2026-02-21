import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { createExam } from '../services/firestoreService';
import { generateQuestionsFromBank } from '../services/aiService';
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
  Alert,
  FormControlLabel,
  Checkbox
} from '@mui/material';

const bancas = [
    "Cespe/Cebraspe",
    "Fundação Getúlio Vargas (FGV)",
    "Fundação Cesgranrio",
    "Fundação Carlos Chagas (FCC)",
    "Outra"
];

const subjects: string[] = [
    "portugues",
    "matematica",
    "informatica",
    "direito",
    "outra"
];


export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<string>('portugues');
  const [customSubject, setCustomSubject] = useState('');
  const [banca, setBanca] = useState<string>(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [editalContent, setEditalContent] = useState('');
  const [useEditalContent, setUseEditalContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!auth.currentUser) {
      setError("Você precisa estar logado para criar um simulado.");
      return;
    }
    
    const finalSubject = useEditalContent ? "Edital" : (subject === 'outra' ? customSubject : subject);
    if (!finalSubject && !useEditalContent) {
      setError("Por favor, selecione ou digite uma matéria.");
      return;
    }

    if (useEditalContent && !editalContent) {
      setError("Por favor, cole o conteúdo do edital.");
      return;
    }

    const finalBanca = banca === 'Outra' ? customBanca : banca;
    if (banca === 'Outra' && !customBanca) {
      setError("Por favor, digite o nome da banca.");
      return;
    }

    setIsLoading(true);

    try {
      const questionsToUse = await generateQuestionsFromBank(finalSubject, numQuestions, finalBanca, editalContent);

      if (questionsToUse.length === 0) {
        setError("Não há questões disponíveis para os critérios selecionados.");
        setIsLoading(false);
        return;
      }

      const examData = {
        title: `Simulado de ${useEditalContent ? "Edital" : finalSubject.charAt(0).toUpperCase() + finalSubject.slice(1)}`,
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
        <FormControlLabel
          control={<Checkbox checked={useEditalContent} onChange={(e) => setUseEditalContent(e.target.checked)} />}
          label="Usar Conteúdo do Edital"
        />

        {useEditalContent ? (
          <TextField
            fullWidth
            margin="normal"
            id="editalContent"
            label="Conteúdo do Edital"
            multiline
            rows={6}
            value={editalContent}
            onChange={(e) => setEditalContent(e.target.value)}
            placeholder="Cole aqui o conteúdo do edital para gerar questões específicas."
          />
        ) : (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel id="subject-label">Matéria</InputLabel>
              <Select
                labelId="subject-label"
                id="subject"
                value={subject}
                label="Matéria"
                onChange={(e) => setSubject(e.target.value)}
                required
              >
                {subjects.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
              </Select>
            </FormControl>

            {subject === 'outra' && (
              <TextField
                fullWidth
                margin="normal"
                id="customSubject"
                label="Qual matéria?"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Digite o nome da matéria"
                required
              />
            )}
          </>
        )}

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
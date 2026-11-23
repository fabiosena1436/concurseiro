import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
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
  ToggleButton, ToggleButtonGroup, Paper, Stack
} from '@mui/material';

const bancas = [
    "Cespe/Cebraspe",
    "Fundação Getúlio Vargas (FGV)",
    "Fundação Cesgranrio",
    "Fundação Carlos Chagas (FCC)",
    "Vunesp",
    "KLC",
    "Outra"
];

const subjects: string[] = [
    "Português",
    "Matemática",
    "Informática",
    "Direito",
    "Outra"
];

const contentHash = (value: string): string => {
  let hash = 0;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(16);
};


export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [specificContent, setSpecificContent] = useState(''); // Estado para conteúdo específico
  const [banca, setBanca] = useState<string>(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const numQuestions = 10; // Fixo em 10 questões
  const [difficulty, setDifficulty] = useState<'fundamental' | 'medio' | 'superior'>('medio');
  const [useEditalContent, setUseEditalContent] = useState(false);
  const [editalContent, setEditalContent] = useState('');
  const [editalTitle, setEditalTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!auth.currentUser) {
      setError("Você precisa estar logado para criar um simulado.");
      return;
    }

    if (useEditalContent) {
      if (!editalTitle.trim()) {
        setError("Por favor, dê um nome ao seu simulado a partir do edital.");
        return;
      }
      if (!editalContent.trim()) {
        setError("Por favor, cole o conteúdo do edital para gerar questões.");
        return;
      }
    }
    
    const finalSubject = useEditalContent ? editalTitle.trim() : (subject === 'Outra' ? customSubject.trim() : subject);
    if (!finalSubject) {
      setError("Por favor, forneça uma matéria ou um título para o edital.");
      return;
    }

    const bancaDisplay = banca === 'Outra' ? customBanca.trim() : banca;
    if (!bancaDisplay) {
        setError("Por favor, forneça o nome da banca.");
        return;
    }
    const bancaApi = banca === 'Outra' ? 'Outra' : banca;

    setIsLoading(true);

    try {
      const subjectForApi = useEditalContent ? `Questões sobre o edital: ${finalSubject}` : finalSubject;
      
      const storageKey = `generatedQuestions_${auth.currentUser.uid}_${contentHash([subjectForApi, bancaApi, difficulty, specificContent, editalContent].join('|'))}`;
      const existingQuestionsRaw = localStorage.getItem(storageKey);
      let existingQuestions: { question: string }[] = [];
      try {
        const parsed: unknown = existingQuestionsRaw ? JSON.parse(existingQuestionsRaw) : [];
        if (Array.isArray(parsed)) existingQuestions = (parsed as unknown[]).filter((item): item is { question: string } => typeof item === 'object' && item !== null && 'question' in item && typeof item.question === 'string');
      } catch { localStorage.removeItem(storageKey); }

      const examTitle = useEditalContent ? finalSubject : `Simulado de ${finalSubject}`;
      const generated = await generateQuestionsFromBank(
        subjectForApi, 
        numQuestions, 
        bancaApi,
        difficulty, 
        useEditalContent ? editalContent : undefined,
        existingQuestions,
        !useEditalContent ? specificContent : undefined,
        examTitle,
        bancaDisplay
      );
      const questionsToUse = generated.questions;

      if (questionsToUse.length === 0) throw new Error('Nenhuma questão foi gerada. Tente novamente.');

      const newQuestionTexts = questionsToUse.map(q => ({ question: q.question }));
      const allQuestionsToStore = [...existingQuestions, ...newQuestionTexts].slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(allQuestionsToStore));
      
      void navigate(`/simulado/${generated.examId}`);

    } catch (err) {
      console.error("Erro ao criar o simulado: ", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
      setError(`Falha ao criar o simulado: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Criar Simulado
      </Typography>
      <Box component="form" onSubmit={(event) => { void handleSubmit(event); }} sx={{ mt: 3 }}>
        <Typography fontWeight={700} gutterBottom>Como você quer estudar?</Typography>
        <ToggleButtonGroup exclusive fullWidth value={useEditalContent ? 'edital' : 'materia'} onChange={(_, value: 'edital' | 'materia' | null) => { if (value) setUseEditalContent(value === 'edital'); }} aria-label="Modo de criação" sx={{ mb: 2 }}>
          <ToggleButton value="materia">Por matéria</ToggleButton>
          <ToggleButton value="edital">Por edital</ToggleButton>
        </ToggleButtonGroup>

        {useEditalContent ? (
          <>
            <TextField
              fullWidth
              margin="normal"
              id="editalTitle"
              label="Nome para o Simulado (Edital)"
              value={editalTitle}
              onChange={(e) => setEditalTitle(e.target.value)}
              placeholder="Ex: Simulado PM-SP"
              required={useEditalContent}
            />
            <TextField
              fullWidth
              margin="normal"
              id="editalContent"
              label="Conteúdo do Edital"
              multiline
              rows={6}
              value={editalContent}
              onChange={(e) => setEditalContent(e.target.value)}
              placeholder="Cole aqui a parte do edital com o conteúdo programático."
              required={useEditalContent}
            />
            <Typography variant="body2" color="text.secondary">O gerador usa até os primeiros 4.000 caracteres do conteúdo colado.</Typography>
          </>
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
              >
                {subjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>

            {subject === 'Outra' && (
              <TextField
                fullWidth
                margin="normal"
                id="customSubject"
                label="Qual matéria?"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Digite o nome da matéria"
                required={subject === 'Outra'}
              />
            )}
            
            <TextField
              fullWidth
              margin="normal"
              id="specificContent"
              label="Conteúdo Específico (Opcional)"
              value={specificContent}
              onChange={(e) => setSpecificContent(e.target.value)}
              placeholder="Ex: Linux, Crase, Juros Simples"
            />
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
            placeholder="Digite o nome da banca (ex: Vunesp)"
            required={banca === 'Outra'}
          />
        )}

        <FormControl fullWidth margin="normal">
          <InputLabel id="difficulty-label">Nível de Dificuldade</InputLabel>
          <Select
            labelId="difficulty-label"
            id="difficulty"
            value={difficulty}
            label="Nível de Dificuldade"
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <MenuItem value="fundamental">Nível Fundamental</MenuItem>
            <MenuItem value="medio">Nível Médio</MenuItem>
            <MenuItem value="superior">Nível Superior</MenuItem>
          </Select>
        </FormControl>
        
        <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'primary.light' }}>
          <Typography fontWeight={700}>Seu simulado</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}><Typography variant="body2">10 questões</Typography><Typography variant="body2">· Até 60 minutos</Typography><Typography variant="body2">· Até 3 gerações gratuitas por conta</Typography></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Questões criadas por IA podem conter erros. Confira a explicação e a fonte antes de usá-las como referência oficial.</Typography>
        </Paper>
        {isLoading && <Alert severity="info" sx={{ mt: 2 }}>Gerando questões e preparando seu simulado. Isso pode levar alguns instantes.</Alert>}
        {error && <Alert severity="error" role="alert" sx={{ mt: 2 }}>{error}</Alert>}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Gerar Simulado com IA'}
        </Button>
      </Box>
    </Container>
  );
};

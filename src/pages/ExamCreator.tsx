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


export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [specificContent, setSpecificContent] = useState(''); // Estado para conteúdo específico
  const [banca, setBanca] = useState<string>(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
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
      
      const storageKey = `generatedQuestions_${subjectForApi}_${bancaApi}_${difficulty}`;
      const existingQuestionsRaw = localStorage.getItem(storageKey);
      const existingQuestions = existingQuestionsRaw ? JSON.parse(existingQuestionsRaw) : [];

      console.log("Enviando para a API:", {
        subjectForApi,
        numQuestions,
        bancaApi,
        difficulty,
        editalContent: useEditalContent ? editalContent : undefined,
        specificContent: !useEditalContent ? specificContent : undefined,
        existingQuestions,
      });

      const questionsToUse = await generateQuestionsFromBank(
        subjectForApi, 
        numQuestions, 
        bancaApi,
        difficulty, 
        useEditalContent ? editalContent : undefined,
        existingQuestions,
        !useEditalContent ? specificContent : undefined
      );

      console.log("Resposta da API:", questionsToUse);

      if (questionsToUse.length === 0 || questionsToUse[0]?.id.startsWith('error-')) {
        setError(questionsToUse[0]?.question || "Não foi possível gerar questões com os critérios fornecidos. Tente novamente.");
        setIsLoading(false);
        return;
      }

      const newQuestionTexts = questionsToUse.map(q => ({ question: q.question }));
      const allQuestionsToStore = [...existingQuestions, ...newQuestionTexts];
      localStorage.setItem(storageKey, JSON.stringify(allQuestionsToStore));
      
      const examTitle = useEditalContent ? finalSubject : `Simulado de ${finalSubject}`;

      const examData = {
        title: examTitle,
        creatorId: auth.currentUser.uid,
        questions: questionsToUse,
        banca: bancaDisplay,
      };

      const examId = await createExam(examData);
      navigate(`/simulado/${examId}`);

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
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <FormControlLabel
          control={<Checkbox checked={useEditalContent} onChange={(e) => setUseEditalContent(e.target.checked)} />}
          label="Gerar questões a partir do conteúdo do edital"
        />

        {useEditalContent ? (
          <>
            <TextField
              fullWidth
              margin="normal"
              id="editalTitle"
              label="Nome para o Simulado (Edital)"
              value={editalTitle}
              onChange={(e) => setEditalTitle(e.target.value)}
              placeholder="Ex: Simulado PM-SP 2024"
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
            onChange={(e) => setDifficulty(e.target.value as 'fundamental' | 'medio' | 'superior')}
          >
            <MenuItem value="fundamental">Nível Fundamental</MenuItem>
            <MenuItem value="medio">Nível Médio</MenuItem>
            <MenuItem value="superior">Nível Superior</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          margin="normal"
          id="numQuestions"
          label="Número de Questões"
          type="number"
          value={numQuestions}
          onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value, 10)))}
          InputProps={{ inputProps: { min: 1, max: 20 } }}
        />
        
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

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
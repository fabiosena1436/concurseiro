import React, { useState } from 'react';
import { adminService } from '../services/adminService';
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
  Tabs,
  Tab,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';

// The shape of question data the backend function expects
interface ManualQuestionPayload {
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  banca: string;
  difficulty: string;
}

const AdminPage: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'batch' | 'user'>('single');
  
  // State for single question form
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [banca, setBanca] = useState('Outra');
  const [difficulty, setDifficulty] = useState('medio');

  // State for batch form
  const [jsonContent, setJsonContent] = useState('');
  
  // State for admin management
  const [email, setEmail] = useState('');

  // Common state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModeChange = (event: React.SyntheticEvent, newMode: 'single' | 'batch' | 'user') => {
    setMode(newMode);
    setFeedback(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const clearSingleForm = () => {
    setSubject('');
    setTopic('');
    setQuestionText('');
    setOptions(['', '', '', '', '']);
    setCorrectAnswer(0);
    setExplanation('');
    setBanca('Outra');
    setDifficulty('medio');
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    if (!subject || !topic || !questionText || options.some(opt => !opt) || !explanation) {
      setFeedback({ type: 'error', message: 'Todos os campos são obrigatórios.' });
      setIsSubmitting(false);
      return;
    }

    try {
      await adminService.addQuestion({
        subject,
        topic,
        question: questionText,
        options,
        correctAnswer,
        explanation,
        banca,
        difficulty,
      });

      setFeedback({ type: 'success', message: 'Questão adicionada com sucesso!' });
      clearSingleForm();
    } catch (error) {
      console.error("Error adding question:", error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      setFeedback({ type: 'error', message: `Falha ao adicionar a questão: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    
    if (!jsonContent.trim()) {
        setFeedback({ type: 'error', message: 'O campo JSON não pode estar vazio.' });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const parsedData = JSON.parse(jsonContent);
        
        if (!Array.isArray(parsedData) || parsedData.length === 0) {
            throw new Error("O JSON deve ser um array de questões e não pode estar vazio.");
        }

        const result = await adminService.addQuestionsBatch({questions: parsedData});
        setFeedback({ type: 'success', message: result.data.message });
        setJsonContent('');
    } catch (error) {
        console.error("Error batch adding questions:", error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro de formato no JSON.';
        setFeedback({ type: 'error', message: `Falha ao adicionar questões: ${errorMessage}` });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleSetAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    if (!email) {
      setFeedback({ type: 'error', message: 'O e-mail é obrigatório.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await adminService.setAdminUser({email});
      setFeedback({ type: 'success', message: result.data.message });
      setEmail('');
    } catch (error) {
      console.error("Error setting admin:", error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      setFeedback({ type: 'error', message: `Falha ao definir admin: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const jsonPlaceholder = `[
  {
    "subject": "Direito Administrativo",
    "topic": "Atos Administrativos",
    "question": "Qual atributo do ato administrativo representa a presunção de legitimidade?",
    "options": ["Autoexecutoriedade", "Tipicidade", "Presunção de Legitimidade", "Imperatividade", "Motivação"],
    "correctAnswer": 2,
    "explanation": "A presunção de legitimidade (ou veracidade) significa que, até prova em contrário, o ato administrativo foi emitido em conformidade com a lei.",
    "banca": "FGV",
    "difficulty": "medio"
  }
]`;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Painel do Administrador
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mode} onChange={handleModeChange} aria-label="Modos de administração">
          <Tab label="Adicionar Questão" value="single" />
          <Tab label="Adicionar em Lote" value="batch" />
          <Tab label="Gerenciar Admins" value="user" />
        </Tabs>
      </Box>

      {mode === 'single' && (
        <Box component="form" onSubmit={(e) => void handleSingleSubmit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Adicionar uma única questão ao banco de dados.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { sm: '1fr 1fr' }, gap: 2 }}>
                <TextField id="subject" label="Matéria" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Direito Constitucional" required />
                <TextField id="topic" label="Tópico" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Art. 5º" required />
                
                <FormControl fullWidth>
                    <InputLabel id="banca-label">Banca Examinadora</InputLabel>
                    <Select labelId="banca-label" id="banca" value={banca} label="Banca Examinadora" onChange={(e) => setBanca(e.target.value)}>
                        <MenuItem value="Cespe/Cebraspe">Cespe/Cebraspe</MenuItem>
                        <MenuItem value="Fundação Getúlio Vargas (FGV)">Fundação Getúlio Vargas (FGV)</MenuItem>
                        <MenuItem value="Fundação Cesgranrio">Fundação Cesgranrio</MenuItem>
                        <MenuItem value="Fundação Carlos Chagas (FCC)">Fundação Carlos Chagas (FCC)</MenuItem>
                        <MenuItem value="Outra">Outra</MenuItem>
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel id="difficulty-label">Nível de Dificuldade</InputLabel>
                    <Select labelId="difficulty-label" id="difficulty" value={difficulty} label="Nível de Dificuldade" onChange={(e) => setDifficulty(e.target.value)}>
                        <MenuItem value="facil">Fácil</MenuItem>
                        <MenuItem value="medio">Médio</MenuItem>
                        <MenuItem value="dificil">Difícil</MenuItem>
                    </Select>
                </FormControl>
            </Box>
            
            <TextField id="questionText" label="Enunciado da Questão" value={questionText} onChange={(e) => setQuestionText(e.target.value)} multiline rows={4} placeholder="Digite o enunciado completo da questão..." required />

            <FormControl component="fieldset">
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Alternativas (Marque a correta)</Typography>
                <RadioGroup name="correctAnswer" value={correctAnswer} onChange={(e) => setCorrectAnswer(parseInt(e.target.value, 10))}>
                    {options.map((option, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <FormControlLabel value={index} control={<Radio />} label={`Alternativa ${String.fromCharCode(65 + index)}`} sx={{ mr: 2 }} />
                            <TextField fullWidth size="small" value={option} onChange={(e) => handleOptionChange(index, e.target.value)} required />
                        </Box>
                    ))}
                </RadioGroup>
            </FormControl>

            <TextField id="explanation" label="Justificativa da Resposta Correta" value={explanation} onChange={(e) => setExplanation(e.target.value)} multiline rows={3} placeholder="Explique por que a alternativa selecionada é a correta." required />
            
            {feedback && <Alert severity={feedback.type}>{feedback.message}</Alert>}

            <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ mt: 2, py: 1.5 }}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Salvar Questão no Banco'}
            </Button>
        </Box>
      )}

      {mode === 'batch' && (
        <Box component="form" onSubmit={(e) => void handleBatchSubmit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                Cole o array de questões em formato JSON abaixo. Use o mesmo formato esperado pela adição manual.
            </Typography>
            <TextField
                id="jsonContent"
                label="Conteúdo JSON das Questões"
                multiline
                rows={20}
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder={jsonPlaceholder}
                required
                InputProps={{ sx: { '& textarea': { fontFamily: 'monospace', fontSize: '0.9rem' } } }}
            />

            {feedback && <Alert severity={feedback.type}>{feedback.message}</Alert>}

            <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ mt: 2, py: 1.5 }}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Salvar Questões em Lote'}
            </Button>
        </Box>
      )}

      {mode === 'user' && (
        <Box component="form" onSubmit={(e) => void handleSetAdminSubmit(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                Digite o e-mail do usuário que você deseja tornar um administrador. O usuário precisará sair e fazer login novamente para que a alteração tenha efeito.
            </Typography>
            <TextField
                id="email"
                label="E-mail do Usuário"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />

            {feedback && <Alert severity={feedback.type}>{feedback.message}</Alert>}

            <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ mt: 2, py: 1.5 }}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Tornar Administrador'}
            </Button>
        </Box>
      )}
    </Container>
  );
};

export default AdminPage;


import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { createExam } from '../services/firestoreService';
import { generateQuestionsFromBank } from '../services/aiService';
import type { QuestionSource } from '../types/exam';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const bancas = [
  'Cespe/Cebraspe',
  'Fundação Getúlio Vargas (FGV)',
  'Fundação Cesgranrio',
  'Fundação Carlos Chagas (FCC)',
  'Vunesp',
  'KLC',
  'Outra',
];

const subjects = ['Português', 'Matemática', 'Informática', 'Direito', 'Outra'];
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
const MAX_EXISTING_QUESTIONS = 40;

const formatPdfSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
};
const numQuestions = 10;

const sourceOptions: Array<{
  value: QuestionSource;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'topic',
    title: 'Por matéria',
    description: 'Use o conhecimento da IA sobre um assunto.',
    icon: <MenuBookOutlinedIcon />,
  },
  {
    value: 'edital',
    title: 'Por edital',
    description: 'Cole o conteúdo programático do seu edital.',
    icon: <DescriptionOutlinedIcon />,
  },
  {
    value: 'pdf',
    title: 'Por PDF da aula',
    description: 'Crie questões baseadas somente no seu material.',
    icon: <PictureAsPdfOutlinedIcon />,
  },
];

const getPdfTitle = (fileName: string): string => fileName.replace(/\.pdf$/i, '').trim();

const getStorageKey = (
  sourceType: QuestionSource,
  subject: string,
  banca: string,
  difficulty: string,
  pdfFile?: File | null,
): string => {
  const pdfIdentity = pdfFile
    ? `${pdfFile.name}-${pdfFile.size}-${pdfFile.lastModified}`
    : '';
  return `generatedQuestions_${sourceType}_${subject}_${banca}_${difficulty}_${pdfIdentity}`;
};

export const ExamCreator: React.FC = () => {
  const navigate = useNavigate();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pdfReadRequestRef = useRef(0);
  const [sourceType, setSourceType] = useState<QuestionSource>('topic');
  const [subject, setSubject] = useState(subjects[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [specificContent, setSpecificContent] = useState('');
  const [banca, setBanca] = useState(bancas[0]);
  const [customBanca, setCustomBanca] = useState('');
  const [difficulty, setDifficulty] = useState<'fundamental' | 'medio' | 'superior'>('medio');
  const [editalContent, setEditalContent] = useState('');
  const [editalTitle, setEditalTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPagesWithText, setPdfPagesWithText] = useState(0);
  const [pdfProgress, setPdfProgress] = useState({ currentPage: 0, totalPages: 0 });
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceType(event.target.value as QuestionSource);
    setError(null);
  };

  const handlePdfSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const requestId = pdfReadRequestRef.current + 1;
    pdfReadRequestRef.current = requestId;
    setPdfFile(file);
    setPdfText('');
    setPdfPageCount(0);
    setPdfPagesWithText(0);
    setPdfError(null);
    setError(null);
    setPdfTitle((currentTitle) => currentTitle || getPdfTitle(file.name));
    setIsReadingPdf(true);
    setPdfProgress({ currentPage: 0, totalPages: 0 });

    try {
      const { extractTextFromPdf } = await import('../services/pdfService');
      const extraction = await extractTextFromPdf(file, (progress) => {
        if (requestId === pdfReadRequestRef.current) {
          setPdfProgress(progress);
        }
      });
      if (requestId !== pdfReadRequestRef.current) {
        return;
      }
      setPdfText(extraction.text);
      setPdfPageCount(extraction.pageCount);
      setPdfPagesWithText(extraction.pagesWithText);
    } catch (extractionError: unknown) {
      if (requestId !== pdfReadRequestRef.current) {
        return;
      }
      setPdfFile(null);
      setPdfTitle('');
      setPdfError(extractionError instanceof Error ? extractionError.message : 'Não foi possível ler o PDF.');
    } finally {
      if (requestId === pdfReadRequestRef.current) {
        setIsReadingPdf(false);
      }
    }
  };

  const handleRemovePdf = () => {
    pdfReadRequestRef.current += 1;
    setPdfFile(null);
    setPdfText('');
    setPdfTitle('');
    setPdfPageCount(0);
    setPdfPagesWithText(0);
    setPdfProgress({ currentPage: 0, totalPages: 0 });
    setPdfError(null);
    setError(null);
  };

  const readExistingQuestions = (storageKey: string): Array<{ question: string }> => {
    const isStoredQuestion = (value: unknown): value is { question: string } => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }

      const candidate = value as { question?: unknown };
      return typeof candidate.question === 'string';
    };

    try {
      const storedQuestions = localStorage.getItem(storageKey);
      if (!storedQuestions) {
        return [];
      }

      const parsedQuestions: unknown = JSON.parse(storedQuestions);
      if (!Array.isArray(parsedQuestions)) {
        return [];
      }

      return parsedQuestions.filter(isStoredQuestion).slice(-MAX_EXISTING_QUESTIONS);
    } catch {
      return [];
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!auth.currentUser) {
      setError('Você precisa estar logado para criar um simulado.');
      return;
    }

    if (sourceType === 'pdf') {
      if (!pdfFile || !pdfText) {
        setError('Selecione um PDF com texto pesquisável antes de gerar as questões.');
        return;
      }

      if (!pdfTitle.trim()) {
        setError('Dê um nome para este material antes de gerar as questões.');
        return;
      }
    }

    if (sourceType === 'edital') {
      if (!editalTitle.trim()) {
        setError('Por favor, dê um nome ao seu simulado a partir do edital.');
        return;
      }
      if (!editalContent.trim()) {
        setError('Por favor, cole o conteúdo do edital para gerar questões.');
        return;
      }
    }

    const finalSubject = sourceType === 'pdf'
      ? pdfTitle.trim()
      : sourceType === 'edital'
        ? editalTitle.trim()
        : subject === 'Outra'
          ? customSubject.trim()
          : subject;

    if (!finalSubject) {
      setError('Por favor, forneça uma matéria ou um título para o material.');
      return;
    }

    const bancaForApi = banca === 'Outra' ? customBanca.trim() : banca;
    if (!bancaForApi) {
      setError('Por favor, forneça o nome da banca.');
      return;
    }

    setIsLoading(true);

    try {
      const subjectForApi = sourceType === 'pdf'
        ? `Conteúdo do PDF: ${finalSubject}`
        : sourceType === 'edital'
          ? `Questões sobre o edital: ${finalSubject}`
          : finalSubject;
      const storageKey = getStorageKey(sourceType, finalSubject, bancaForApi, difficulty, pdfFile);
      const existingQuestions = readExistingQuestions(storageKey);

      const questionsToUse = await generateQuestionsFromBank({
        subject: subjectForApi,
        numQuestions,
        banca: bancaForApi,
        difficulty,
        sourceType,
        editalContent: sourceType === 'edital' ? editalContent : undefined,
        pdfContent: sourceType === 'pdf' ? pdfText : undefined,
        pdfFileName: sourceType === 'pdf' ? pdfFile?.name : undefined,
        existingQuestions,
        specificContent: sourceType === 'topic' ? specificContent : undefined,
      });

      if (questionsToUse.length === 0) {
        throw new Error('A inteligência artificial não retornou questões para este material.');
      }

      try {
        const newQuestionTexts = questionsToUse.map((question) => ({ question: question.question }));
        localStorage.setItem(storageKey, JSON.stringify([...existingQuestions, ...newQuestionTexts]));
      } catch (storageError) {
        console.warn('Não foi possível salvar o histórico local de questões repetidas.', storageError);
      }

      const examTitle = sourceType === 'pdf'
        ? `Estudo: ${finalSubject}`
        : sourceType === 'edital'
          ? finalSubject
          : `Simulado de ${finalSubject}`;

      const examData = {
        title: examTitle,
        creatorId: auth.currentUser.uid,
        questions: questionsToUse,
        banca: bancaForApi,
        sourceType,
        sourceName: sourceType === 'pdf' ? pdfFile?.name || finalSubject : finalSubject,
        ...(sourceType === 'pdf' ? { sourcePageCount: pdfPageCount } : {}),
      };

      const examId = await createExam(examData);
      void navigate(`/simulado/${examId}`);
    } catch (generationError: unknown) {
      console.error('Erro ao criar o simulado:', generationError);
      setError(generationError instanceof Error ? generationError.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#f7f9fc', minHeight: '100%', py: { xs: 3, md: 6 } }}>
      <Box maxWidth="md" sx={{ mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
            Estúdio de questões
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mt: 0.5, mb: 1, fontSize: { xs: '2rem', md: '2.75rem' } }}>
            Crie um simulado sob medida
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 680 }}>
            Escolha de onde a inteligência artificial deve tirar o conteúdo. Ao usar um PDF, as questões e explicações serão construídas somente a partir do texto do seu material.
          </Typography>
        </Box>

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              1. Escolha a fonte do estudo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A fonte selecionada define o que a IA poderá usar como base.
            </Typography>
            <RadioGroup value={sourceType} onChange={handleSourceChange} aria-label="Fonte das questões">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                {sourceOptions.map((option) => {
                  const selected = sourceType === option.value;
                  return (
                    <Box
                      key={option.value}
                      sx={{
                        border: '1px solid',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'primary.50' : 'background.paper',
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                    >
                      <FormControlLabel
                        value={option.value}
                        control={<Radio />}
                        sx={{ m: 0, p: 1.5, width: '100%', alignItems: 'flex-start' }}
                        label={
                          <Box sx={{ pl: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: selected ? 'primary.main' : 'text.primary' }}>
                              {option.icon}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{option.title}</Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.35 }}>
                              {option.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  );
                })}
              </Box>
            </RadioGroup>
          </CardContent>
        </Card>

        <Box component="form" onSubmit={(event) => void handleSubmit(event)}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                2. Configure o conteúdo
              </Typography>

              {sourceType === 'topic' && (
                <>
                  <FormControl fullWidth margin="normal" sx={{ mt: 0 }}>
                    <InputLabel id="subject-label">Matéria</InputLabel>
                    <Select
                      labelId="subject-label"
                      id="subject"
                      value={subject}
                      label="Matéria"
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      {subjects.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                    </Select>
                  </FormControl>

                  {subject === 'Outra' && (
                    <TextField
                      fullWidth
                      margin="normal"
                      id="customSubject"
                      label="Qual matéria?"
                      value={customSubject}
                      onChange={(event) => setCustomSubject(event.target.value)}
                      placeholder="Digite o nome da matéria"
                      required
                    />
                  )}

                  <TextField
                    fullWidth
                    margin="normal"
                    id="specificContent"
                    label="Conteúdo específico (opcional)"
                    value={specificContent}
                    onChange={(event) => setSpecificContent(event.target.value)}
                    placeholder="Ex.: Linux, crase ou juros simples"
                    helperText="Refine o assunto para deixar o simulado mais direcionado."
                  />
                </>
              )}

              {sourceType === 'edital' && (
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    id="editalTitle"
                    label="Nome do simulado"
                    value={editalTitle}
                    onChange={(event) => setEditalTitle(event.target.value)}
                    placeholder="Ex.: Simulado PM-SP 2024"
                    required
                  />
                  <TextField
                    fullWidth
                    id="editalContent"
                    label="Conteúdo do edital"
                    multiline
                    rows={7}
                    value={editalContent}
                    onChange={(event) => setEditalContent(event.target.value)}
                    placeholder="Cole aqui a parte do edital com o conteúdo programático."
                    required
                  />
                </Stack>
              )}

              {sourceType === 'pdf' && (
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    id="pdfTitle"
                    label="Nome do material"
                    value={pdfTitle}
                    onChange={(event) => setPdfTitle(event.target.value)}
                    placeholder="Ex.: Direito Constitucional — Aula 01"
                    helperText="Esse nome será usado no seu histórico de estudos."
                    required
                  />
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: pdfFile ? 'success.main' : 'primary.main',
                      borderRadius: 2,
                      p: { xs: 2, sm: 3 },
                      bgcolor: pdfFile ? 'success.50' : 'primary.50',
                    }}
                  >
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      hidden
                      onChange={(event) => void handlePdfSelected(event)}
                    />
                    {!pdfFile ? (
                      <Box sx={{ textAlign: 'center' }}>
                        <PictureAsPdfOutlinedIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Adicione o PDF da sua aula
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          PDF com texto selecionável, até {MAX_PDF_PAGES} páginas e {formatPdfSize(MAX_PDF_SIZE_BYTES)}.
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<UploadFileOutlinedIcon />}
                          onClick={() => pdfInputRef.current?.click()}
                        >
                          Selecionar PDF
                        </Button>
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleOutlineIcon color="success" />
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pdfFile.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatPdfSize(pdfFile.size)}
                            </Typography>
                          </Box>
                          <Button color="error" size="small" startIcon={<DeleteOutlineIcon />} onClick={handleRemovePdf}>
                            Remover
                          </Button>
                        </Box>
                        {isReadingPdf && (
                          <Box>
                            <LinearProgress
                              variant={pdfProgress.totalPages ? 'determinate' : 'indeterminate'}
                              value={pdfProgress.totalPages ? (pdfProgress.currentPage / pdfProgress.totalPages) * 100 : undefined}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Lendo página {pdfProgress.currentPage || 1} de {pdfProgress.totalPages || '...'}…
                            </Typography>
                          </Box>
                        )}
                        {!isReadingPdf && pdfText && (
                          <Box>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                              <Chip size="small" label={`${pdfPageCount} páginas`} />
                              <Chip size="small" label={`${pdfPagesWithText} páginas com texto`} color="success" variant="outlined" />
                              <Chip size="small" label={`${pdfText.length.toLocaleString('pt-BR')} caracteres`} variant="outlined" />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Texto extraído com sucesso. Ele será enviado à IA sem salvar o arquivo na plataforma.
                            </Typography>
                            {pdfPagesWithText < pdfPageCount && (
                              <Alert severity="warning" sx={{ mt: 1 }}>
                                Algumas páginas não têm texto selecionável e não entrarão na geração. Para aproveitar o material inteiro, use OCR.
                              </Alert>
                            )}
                          </Box>
                        )}
                      </Stack>
                    )}
                  </Box>
                  {pdfError && <Alert severity="error">{pdfError}</Alert>}
                  <Alert severity="info" icon={<InfoOutlinedIcon />}>
                    <Typography variant="body2">
                      <strong>Como funciona:</strong> o PDF é lido no seu navegador e somente o texto extraído é usado para criar as questões. A IA não usará conhecimento externo como fonte do conteúdo deste simulado.
                    </Typography>
                  </Alert>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                3. Defina o estilo
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="banca-label">{sourceType === 'pdf' ? 'Estilo das questões' : 'Banca examinadora'}</InputLabel>
                  <Select
                    labelId="banca-label"
                    id="banca"
                    value={banca}
                    label={sourceType === 'pdf' ? 'Estilo das questões' : 'Banca examinadora'}
                    onChange={(event) => setBanca(event.target.value)}
                  >
                    {bancas.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="difficulty-label">Nível de dificuldade</InputLabel>
                  <Select
                    labelId="difficulty-label"
                    id="difficulty"
                    value={difficulty}
                    label="Nível de dificuldade"
                    onChange={(event) => setDifficulty(event.target.value)}
                  >
                    <MenuItem value="fundamental">Nível fundamental</MenuItem>
                    <MenuItem value="medio">Nível médio</MenuItem>
                    <MenuItem value="superior">Nível superior</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {banca === 'Outra' && (
                <TextField
                  fullWidth
                  margin="normal"
                  id="customBanca"
                  label="Qual estilo ou banca?"
                  value={customBanca}
                  onChange={(event) => setCustomBanca(event.target.value)}
                  placeholder="Digite o nome da banca ou escolha 'múltipla escolha'"
                  required
                />
              )}

              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <AutoAwesomeIcon fontSize="small" color="primary" />
                <Typography variant="body2">
                  Serão geradas {numQuestions} questões novas, com alternativas e explicações para revisar o conteúdo.
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button
            type="submit"
            fullWidth
            size="large"
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={isLoading || isReadingPdf}
            sx={{ py: 1.5, borderRadius: 2, fontWeight: 700, mb: 2 }}
          >
            {isLoading ? 'Gerando questões…' : sourceType === 'pdf' ? 'Gerar questões do PDF' : 'Gerar simulado com IA'}
          </Button>

          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Revise as questões e explicações antes de usá-las como material definitivo de estudo.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

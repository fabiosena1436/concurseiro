import {useEffect, useState} from 'react';
import {Link, useNavigate, useSearchParams, useParams} from 'react-router-dom';
import {Alert, Box, Button, Card, CardContent, Container, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography} from '@mui/material';
import {countQuestions, finishAttempt, getAttempt, listAttempts, listQuestions, saveAttempt, startFilteredAttempt} from '../services/catalogService';
import {useAuth} from '../hooks/useAuth';
import type {BankAttempt, BankAttemptSummary, BankQuestion, CatalogFilters} from '../types/catalog';

export function QuestionCatalog() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<CatalogFilters>(params.get('paperId') ? {paperId: params.get('paperId')!} : {});
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [quantity, setQuantity] = useState(10);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const {user} = useAuth();
  const navigate = useNavigate();
  const search = async (next?: string, selected = filters) => {setBusy(true); setError(''); try {const [page, total] = await Promise.all([listQuestions(selected, next), countQuestions(selected)]); setItems(prev => next ? [...prev, ...page.items] : page.items); setCursor(page.nextCursor); setCount(total.count);} catch(e) {setError(e instanceof Error ? e.message : 'Falha na busca.');} finally {setBusy(false);}};
  useEffect(() => {void search(); /* initial query */}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (key: keyof CatalogFilters, label: string) => <TextField label={label} size="small" value={filters[key] ?? ''} onChange={e => setFilters({...filters, [key]: e.target.value})} />;
  const start = async () => {if (!user) {void navigate('/login'); return;} setBusy(true); setError(''); try {const result = await startFilteredAttempt(filters, Math.min(quantity, count)); void navigate(`/treinos/${result.id}`);} catch(e) {setError(e instanceof Error ? e.message : 'Não foi possível iniciar.'); setBusy(false);}};
  return <Container maxWidth="lg" sx={{py: 4}}><Typography variant="h4" component="h1" gutterBottom>Banco de questões revisadas</Typography><Typography color="text.secondary" sx={{mb: 3}}>Questões de provas reais, revisadas antes da publicação.</Typography>
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{mb: 2}}>{field('banca','Banca')}{field('tipo','Tipo')}{field('orgao','Órgão')}{field('cargo','Cargo')}{field('subject','Matéria')}{field('escolaridade','Escolaridade')}<TextField label="Ano" type="number" size="small" value={filters.year ?? ''} onChange={e => setFilters({...filters, year: e.target.value ? Number(e.target.value) : undefined})}/>{field('paperId','ID da prova')}</Stack>
    <Stack direction="row" gap={1} sx={{mb: 2}}><Button variant="contained" onClick={() => void search()} disabled={busy}>Buscar</Button><Button onClick={() => {setFilters({}); void search(undefined, {});}}>Limpar filtros</Button></Stack>
    {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}<Typography sx={{mb: 2}}>{count} questões disponíveis</Typography>
    {count > 0 && <Stack direction="row" gap={1} alignItems="center" sx={{mb: 3}}><TextField type="number" label="Quantidade no treino" size="small" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} inputProps={{min: 1, max: 50}}/><Button variant="contained" disabled={busy} onClick={() => void start()}>Iniciar treino</Button></Stack>}
    {!busy && !items.length && !error && <Alert severity="info">Nenhuma questão encontrada. Ajuste ou limpe os filtros.</Alert>}
    <Stack gap={2}>{items.map(q => <Card key={q.id}><CardContent><Typography variant="body2" color="text.secondary">{q.banca} · {q.year} · {q.subject} · {q.topic}</Typography><Typography variant="h6" sx={{my: 1}}>{q.text}</Typography><Button component={Link} to={`/questoes/${q.id}`}>Estudar questão</Button></CardContent></Card>)}</Stack>{cursor && <Button sx={{mt: 2}} disabled={busy} onClick={() => void search(cursor)}>Carregar mais</Button>}
  </Container>;
}

export function BankQuestionDetails() {
  const {id = ''} = useParams();
  const [q, setQ] = useState<BankQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {void import('../services/catalogService').then(s => s.getQuestion(id)).then(setQ).catch(e => setError(String(e)));}, [id]);
  return <Container maxWidth="md" sx={{py: 4}}>{error && <Alert severity="error">{error}</Alert>}{q && <><Typography variant="h4" component="h1">Questão {q.number || ''}</Typography><Typography color="text.secondary">{q.subject} · {q.topic} · {q.banca} · {q.year}</Typography><Typography variant="h6" sx={{my: 3}}>{q.text}</Typography><RadioGroup value={selected ?? ''} onChange={e => setSelected(Number(e.target.value))}>{q.options.map((option, i) => <FormControlLabel key={i} value={i} control={<Radio/>} label={`${String.fromCharCode(65+i)}. ${option}`} disabled={revealed}/>)}</RadioGroup><Button variant="contained" onClick={() => setRevealed(true)} sx={{mt: 2}}>Revelar correção</Button>{revealed && <Alert severity={selected === q.correctAnswer ? 'success' : 'info'} sx={{mt: 2}}>Gabarito: {String.fromCharCode(65 + (q.correctAnswer ?? 0))}. {q.options[q.correctAnswer ?? 0]}<br/>{q.explanation}</Alert>}<Box sx={{mt: 2}}><Button component={Link} to={`/provas/${q.paperId}`}>Ver prova de origem</Button>{q.adapted && <Typography variant="body2">Questão adaptada da fonte.</Typography>}</Box></>}</Container>;
}

export function BankTraining() {
  const {id = ''} = useParams();
  const [attempt, setAttempt] = useState<BankAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {void getAttempt(id).then(a => {setAttempt(a); setAnswers(a.answers || {});}).catch(e => setError(String(e)));}, [id]);
  useEffect(() => {if (!attempt || attempt.status !== 'in_progress') return; const timer = window.setTimeout(() => {void saveAttempt(id, answers).catch(e => setError(String(e)));}, 600); return () => window.clearTimeout(timer);}, [answers, attempt, id]);
  const finish = async () => {setBusy(true); try {await finishAttempt(id, answers); setAttempt(await getAttempt(id));} catch(e) {setError(String(e));} finally {setBusy(false);}};
  if (!attempt) return <Container sx={{py: 4}}>{error || 'Carregando treino...'}</Container>;
  const q = attempt.snapshot[index];
  return <Container maxWidth="md" sx={{py: 4}}><Typography variant="h4" component="h1">{attempt.status === 'completed' ? 'Resultado do treino' : 'Treino de questões'}</Typography>{error && <Alert severity="error">{error}</Alert>}{attempt.status === 'completed' && <Alert severity="success" sx={{my: 2}}>Acertos: {attempt.score?.toFixed(1)}%. Suas respostas e o gabarito desta tentativa foram preservados.</Alert>}
    <Typography sx={{my: 2}}>Questão {index + 1} de {attempt.snapshot.length} · {q.subject} · {q.topic}</Typography><Typography variant="h6">{q.text}</Typography><RadioGroup value={answers[q.id] ?? ''} onChange={e => setAnswers({...answers, [q.id]: Number(e.target.value)})}>{q.options.map((option, i) => <FormControlLabel key={i} value={i} control={<Radio/>} disabled={attempt.status === 'completed'} label={`${String.fromCharCode(65+i)}. ${option}`}/>)}</RadioGroup>
    {attempt.status === 'completed' && <Alert severity={answers[q.id] === q.correctAnswer ? 'success' : 'info'} sx={{mt: 2}}>Gabarito: {q.options[q.correctAnswer ?? 0]}. {q.explanation}<br/><Link to={`/provas/${q.paperId}`}>Ver prova de origem</Link></Alert>}
    <Stack direction="row" gap={1} sx={{mt: 3}}><Button disabled={index === 0} onClick={() => setIndex(index-1)}>Anterior</Button><Button disabled={index >= attempt.snapshot.length-1} onClick={() => setIndex(index+1)}>Próxima</Button>{attempt.status === 'in_progress' && <Button variant="contained" disabled={busy} onClick={() => void finish()}>Concluir treino</Button>}</Stack>
  </Container>;
}

export function BankHistory() {
  const [items, setItems] = useState<BankAttemptSummary[]>([]); const [error, setError] = useState(''); const [cursor, setCursor] = useState<string | null>(null);
  const load = (next?: string) => {void listAttempts(next).then(x => {setItems(prev => next ? [...prev, ...x.items] : x.items); setCursor(x.nextCursor);}).catch(e => setError(String(e)));};
  useEffect(() => {load();}, []);
  return <Container maxWidth="md" sx={{py: 4}}><Typography variant="h4" component="h1" gutterBottom>Histórico de treinos</Typography>{error && <Alert severity="error">{error}</Alert>}{!items.length && !error && <Typography>Nenhum treino iniciado.</Typography>}<Stack gap={1}>{items.map(a => <Card key={a.id}><CardContent><Typography>{a.questionIds.length} questões · {a.status === 'completed' ? `${a.score?.toFixed(1)}% de acertos` : 'Em andamento'}</Typography><Typography variant="body2">{a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR') : ''}</Typography><Button component={Link} to={`/treinos/${a.id}`}>{a.status === 'completed' ? 'Revisar' : 'Retomar'}</Button></CardContent></Card>)}</Stack>{cursor && <Button sx={{mt: 2}} onClick={() => load(cursor)}>Carregar mais</Button>}</Container>;
}


import {useEffect, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography} from '@mui/material';
import {getPaper, listPapers, pdfUrl} from '../services/catalogService';
import type {CatalogFilters, Paper} from '../types/catalog';

const empty: CatalogFilters = {};
export function PaperCatalog() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<CatalogFilters>(() => ({...empty, search: params.get('search') || undefined}));
  const [items, setItems] = useState<Paper[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = async (next?: string) => {
    setBusy(true); setError('');
    try {const page = await listPapers(filters, next); setItems(prev => next ? [...prev, ...page.items] : page.items); setCursor(page.nextCursor);}
    catch (e) {setError(e instanceof Error ? e.message : 'Falha na consulta.');}
    finally {setBusy(false);}
  };
  useEffect(() => {void search(); /* initial query */}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (key: keyof CatalogFilters, label: string) => <TextField label={label} size="small" value={filters[key] ?? ''} onChange={e => setFilters({...filters, [key]: key === 'year' && e.target.value ? Number(e.target.value) : e.target.value})} />;
  return <Container maxWidth="lg" sx={{py: 4}}>
    <Typography variant="h4" component="h1" gutterBottom>Provas anteriores</Typography>
    <Typography color="text.secondary" sx={{mb: 3}}>Encontre PDFs de provas reais cadastradas e confira sua origem.</Typography>
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{mb: 2}}>{field('search','Palavra do título')}{field('banca','Banca')}{field('tipo','Tipo de concurso')}{field('orgao','Órgão')}{field('cargo','Cargo')}{field('subject','Matéria')}{field('escolaridade','Escolaridade')}<TextField label="Ano" type="number" size="small" value={filters.year ?? ''} onChange={e => setFilters({...filters, year: e.target.value ? Number(e.target.value) : undefined})} /></Stack>
    <Stack direction="row" gap={1} sx={{mb: 3}}><Button variant="contained" onClick={() => void search()} disabled={busy}>Buscar</Button><Button onClick={() => {setFilters({}); setBusy(true); void listPapers().then(page => {setItems(page.items); setCursor(page.nextCursor); setError('');}).catch(e => setError(String(e))).finally(() => setBusy(false));}}>Limpar filtros</Button></Stack>
    {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
    {!busy && !items.length && !error && <Alert severity="info">Nenhuma prova encontrada. Ajuste os filtros ou limpe a busca.</Alert>}
    <Stack gap={2}>{items.map(p => <Card key={p.id}><CardContent><Typography variant="h6">{p.title} ({p.year})</Typography><Typography color="text.secondary">{p.banca} · {p.orgao} · {p.cargo} · {p.escolaridade}</Typography><Typography variant="body2">{p.materias.join(', ')}</Typography><Button component={Link} to={`/provas/${p.id}`} sx={{mt: 1}}>Ver prova</Button></CardContent></Card>)}</Stack>
    {cursor && <Button sx={{mt: 2}} onClick={() => void search(cursor)} disabled={busy}>Carregar mais</Button>}
  </Container>;
}

export function PaperDetails() {
  const {id = ''} = useParams();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [url, setUrl] = useState('');
  const [answerUrl, setAnswerUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {void getPaper(id).then(p => {setPaper(p); setUrl(pdfUrl(p.pdfPath)); if (p.answerKeyPath) setAnswerUrl(pdfUrl(p.answerKeyPath));}).catch(e => setError(e instanceof Error ? e.message : 'Prova indisponível.'));}, [id]);
  return <Container maxWidth="md" sx={{py: 4}}>{error && <Alert severity="error">{error}</Alert>}{paper && <><Typography variant="h4" component="h1">{paper.title} ({paper.year})</Typography><Typography sx={{mt: 2}}>Banca: {paper.banca} · Concurso: {paper.concurso} · Órgão: {paper.orgao}</Typography><Typography>Tipo: {paper.tipo} · Cargo: {paper.cargo} · Escolaridade: {paper.escolaridade}</Typography><Typography>Matérias: {paper.materias.join(', ')}</Typography>{paper.notes && <Typography sx={{mt: 2}}>{paper.notes}</Typography>}<Stack direction="row" gap={1} flexWrap="wrap" sx={{my: 3}}>{url && <Button href={url} target="_blank" rel="noopener noreferrer" variant="contained">Abrir PDF</Button>}{answerUrl && <Button href={answerUrl} target="_blank" rel="noopener noreferrer">Abrir gabarito</Button>}<Button component={Link} to={`/questoes?paperId=${paper.id}`}>Ver questões desta prova</Button></Stack>{paper.sourceUrl && <Typography>Fonte: <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer">{paper.sourceUrl}</a></Typography>}{paper.attribution && <Box sx={{mt: 1}}>{paper.attribution}</Box>}</>}</Container>;
}


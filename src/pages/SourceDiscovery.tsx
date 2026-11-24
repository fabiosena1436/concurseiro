import {useEffect, useState} from 'react';
import {Alert, Button, Card, CardContent, Checkbox, FormControlLabel, Link, Stack, TextField, Typography} from '@mui/material';
import {getDiscoverySettings, importSourceCandidates, listSourceCandidates, listTelegramInbox, reviewSourceCandidate, runDiscoverySearch, saveDiscoverySettings} from '../services/catalogService';
import type {DiscoverySettings, Paper, SourceCandidate, TelegramInboxItem} from '../types/catalog';

type CandidateInput = Pick<SourceCandidate, 'title' | 'year' | 'banca' | 'orgao' | 'cargo' | 'url'>;

function parseRows(raw: string): CandidateInput[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length > 100) throw new Error('Importe no máximo 100 linhas por lote.');
  return lines.map((line, index) => {
    const [title, yearText, banca, orgao, cargo, url] = line.split('\t').map(x => x.trim());
    const year = Number(yearText);
    if (!title || !banca || !url || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) throw new Error(`Linha ${index + 1}: informe título, ano, banca e URL. Use tabulações entre as colunas.`);
    return {title, year, banca, orgao: orgao || '', cargo: cargo || '', url};
  });
}

export function SourceDiscovery({onSelect}: {onSelect: (paper: Paper) => void}) {
  const [raw, setRaw] = useState('');
  const [items, setItems] = useState<SourceCandidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState('');
  const [settings, setSettings] = useState<DiscoverySettings>({enabled: false, terms: []});
  const [topics, setTopics] = useState('');
  const [telegramItems, setTelegramItems] = useState<TelegramInboxItem[]>([]);
  const load = async (next?: string) => {
    const page = await listSourceCandidates(next);
    setItems(previous => next ? [...previous, ...page.items] : page.items);
    setCursor(page.nextCursor);
  };
  useEffect(() => {
    void load().catch(e => setError(String(e)));
    void getDiscoverySettings().then(saved => {setSettings(saved); setTopics(saved.terms.join('\n'));}).catch(e => setError(String(e)));
    void listTelegramInbox().then(page => setTelegramItems(page.items)).catch(e => setError(String(e)));
  }, []);
  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try {await job(); await load();} catch (e) {setError(e instanceof Error ? e.message : String(e));} finally {setBusy(false);}
  };
  const select = (candidate: SourceCandidate) => {
    onSelect({id: crypto.randomUUID(), title: candidate.title, year: candidate.year, banca: candidate.banca, concurso: candidate.title, orgao: candidate.orgao, tipo: '', cargo: candidate.cargo, escolaridade: '', materias: [], pdfPath: '', sourceUrl: candidate.url, attribution: `Fonte: ${new URL(candidate.url).hostname}`, status: 'draft', rightsConfirmed: false});
  };
  return <Stack gap={2}>
    <Typography variant="h6">Fontes para análise</Typography>
    <Typography color="text.secondary">Cole links de órgãos, bancas ou acervos com autorização de uso. Esta fila guarda somente metadados e links. Nenhuma questão ou PDF é publicado automaticamente.</Typography>
    <Card variant="outlined"><CardContent><Stack gap={2}><Typography variant="h6">Busca na rede</Typography><Typography color="text.secondary">A IA pesquisa páginas de órgãos públicos e bancas oficiais. Os resultados entram na fila como candidatos; título, ano, banca e direitos precisam ser conferidos. A busca pode consumir cota da API Gemini.</Typography><TextField label="Cargo, banca ou concurso" value={term} onChange={e => setTerm(e.target.value)} fullWidth/><Button disabled={busy || term.trim().length < 3} onClick={() => void run(async () => {const result = await runDiscoverySearch(term); setMessage(`${result.found} links oficiais encontrados; ${result.added} novos na fila.`);})}>Pesquisar agora</Button><Typography fontWeight={700}>Pesquisa diária automática</Typography><TextField label="Temas de interesse, um por linha (até 5)" value={topics} onChange={e => setTopics(e.target.value)} multiline minRows={3} fullWidth/><FormControlLabel control={<Checkbox checked={settings.enabled} onChange={e => setSettings({...settings, enabled: e.target.checked})}/>} label="Ativar busca diária às 8h (horário de Brasília)"/><Button disabled={busy} onClick={() => void run(async () => {const terms = topics.split('\n').map(x => x.trim()).filter(Boolean); const saved = await saveDiscoverySettings(settings.enabled, terms); setSettings(saved); setMessage('Preferências de busca salvas.');})}>Salvar pesquisa automática</Button>{settings.lastRunAt && <Typography variant="body2">Última execução: {new Date(settings.lastRunAt).toLocaleString('pt-BR')}</Typography>}</Stack></CardContent></Card>
    <Alert severity="info">Formato: título ⇥ ano ⇥ banca ⇥ órgão ⇥ cargo ⇥ URL HTTPS. Uma prova por linha, até 100. Copie colunas de uma planilha para gerar as tabulações.</Alert>
    <TextField label="Fontes em lote" multiline minRows={5} value={raw} onChange={e => setRaw(e.target.value)} placeholder={'Analista Administrativo\t2025\tBanca Exemplo\tÓrgão Exemplo\tAnalista\thttps://exemplo.gov.br/prova.pdf'} fullWidth/>
    <Button variant="contained" disabled={busy || !raw.trim()} onClick={() => void run(async () => {const result = await importSourceCandidates(parseRows(raw)); setMessage(`${result.added} novas fontes; ${result.existing} já cadastradas.`); setRaw('');})}>Adicionar à fila</Button>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    <Typography variant="subtitle1" fontWeight={700}>Fila de revisão</Typography>
    {items.map(candidate => <Card key={candidate.id} variant="outlined"><CardContent><Typography fontWeight={700}>{candidate.title} · {candidate.year}</Typography><Typography color="text.secondary" variant="body2">{candidate.banca} · {candidate.orgao} · {candidate.cargo} · {candidate.status}</Typography><Link href={candidate.url} target="_blank" rel="noopener noreferrer" sx={{overflowWrap: 'anywhere'}}>{candidate.url}</Link><Stack direction="row" gap={1} flexWrap="wrap" sx={{mt: 1}}><Button disabled={busy} onClick={() => void run(async () => {await reviewSourceCandidate(candidate.id, 'accepted'); select(candidate);})}>Analisar e cadastrar</Button><Button disabled={busy} color="error" onClick={() => void run(async () => {await reviewSourceCandidate(candidate.id, 'rejected');})}>Descartar</Button>{candidate.status !== 'pending' && <Button disabled={busy} onClick={() => void run(async () => {await reviewSourceCandidate(candidate.id, 'pending');})}>Reabrir</Button>}</Stack></CardContent></Card>)}
    {cursor && <Button disabled={busy} onClick={() => void load(cursor).catch(e => setError(String(e)))}>Carregar mais</Button>}
    <Typography variant="h6">Recebidos pelo Telegram</Typography><Typography color="text.secondary">O bot registra mensagens e metadados de anexos enviados por usuários autorizados. Confira a origem no Telegram antes de cadastrar ou publicar.</Typography>
    {telegramItems.length === 0 && <Typography variant="body2">Nenhuma mensagem recebida pelo bot.</Typography>}
    {telegramItems.map(item => <Card key={item.id} variant="outlined"><CardContent><Typography fontWeight={700}>{item.fileName || 'Mensagem com links'} · {new Date(item.receivedAt).toLocaleString('pt-BR')}</Typography><Typography variant="body2" sx={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{item.text || 'Anexo sem legenda'}</Typography><Typography variant="caption" color="text.secondary">Chat {item.chatId} · mensagem {item.messageId} · {item.mimeType || 'texto'}</Typography></CardContent></Card>)}
  </Stack>;
}

import {useState} from 'react';
import {Box, Button, Card, CardContent, Chip, Container, Grid, Stack, TextField, Typography} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {useAuth} from '../hooks/useAuth';

const paths = [
  {icon: <FactCheckOutlinedIcon/>, title: 'Resolver questões', description: 'Filtre por banca, ano, matéria, órgão e cargo.', to: '/questoes', action: 'Explorar questões'},
  {icon: <AutoStoriesOutlinedIcon/>, title: 'Estudar por prova', description: 'Encontre cadernos anteriores e consulte a fonte.', to: '/provas', action: 'Ver provas'},
  {icon: <InsightsOutlinedIcon/>, title: 'Acompanhar evolução', description: 'Revise tentativas e identifique onde melhorar.', to: '/treinos', action: 'Meus treinos'},
];

export const Home = () => {
  const {user} = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const search = () => {void navigate(`/provas${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`);};
  return <>
    <Box sx={{bgcolor: '#f4f7fb', backgroundImage: 'radial-gradient(circle at 84% 15%, #d9eaf8 0, transparent 33%), radial-gradient(circle at 5% 80%, #e8f3eb 0, transparent 28%)', pt: {xs: 6, md: 10}, pb: {xs: 7, md: 11}}}>
      <Container maxWidth="lg"><Grid container spacing={5} alignItems="center">
        <Grid size={{xs: 12, md: 7}}><Chip label="Seu espaço para conquistar a aprovação" sx={{bgcolor: '#dcefe8', color: '#126a52', fontWeight: 800, mb: 3}}/>
          <Typography component="h1" sx={{fontSize: {xs: '2.7rem', md: '4.6rem'}, fontWeight: 850, letterSpacing: '-0.055em', lineHeight: 1.04, color: '#122b43', maxWidth: 720}}>Estude com direção. <Box component="span" sx={{color: '#147a62'}}>Pratique com confiança.</Box></Typography>
          <Typography sx={{fontSize: {xs: '1.05rem', md: '1.2rem'}, color: '#52677a', mt: 3, maxWidth: 620}}>Provas anteriores, questões revisadas e treinos em um só lugar. Escolha o que estudar e acompanhe seu progresso.</Typography>
          <Stack direction={{xs: 'column', sm: 'row'}} gap={1.5} sx={{mt: 4}}><Button component={Link} to="/questoes" variant="contained" size="large" sx={{bgcolor: '#147a62', '&:hover': {bgcolor: '#0d604d'}}}>Começar pelas questões</Button><Button component={Link} to="/provas" variant="outlined" size="large" sx={{borderColor: '#147a62', color: '#126a52'}}>Explorar provas</Button></Stack>
          <Typography variant="body2" sx={{mt: 2.5, color: '#617587'}}>Questões do banco passam por revisão. Simulados criados por IA são identificados separadamente.</Typography>
        </Grid>
        <Grid size={{xs: 12, md: 5}}><Card sx={{border: '1px solid #dce8ee', borderRadius: 4, boxShadow: '0 24px 64px #183b5520', overflow: 'hidden'}}><Box sx={{bgcolor: '#163c51', color: 'white', p: 3}}><Typography variant="overline" sx={{color: '#a7dbc8', fontWeight: 800}}>Encontre seu ponto de partida</Typography><Typography variant="h5" fontWeight={800}>Qual prova você procura?</Typography></Box><CardContent sx={{p: 3}}><Stack gap={2}><TextField label="Cargo, órgão ou palavra do título" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {if (e.key === 'Enter') search();}} fullWidth/><Button startIcon={<SearchRoundedIcon/>} variant="contained" onClick={search} sx={{bgcolor: '#147a62', '&:hover': {bgcolor: '#0d604d'}}}>Buscar provas</Button><Typography variant="body2" color="text.secondary">Prefere praticar por assunto? Use os filtros do banco de questões.</Typography><Button component={Link} to="/questoes" sx={{alignSelf: 'flex-start'}}>Abrir filtros de questões →</Button></Stack></CardContent></Card></Grid>
      </Grid></Container>
    </Box>
    <Container maxWidth="lg" sx={{py: {xs: 6, md: 9}}}><Typography variant="overline" sx={{color: '#147a62', fontWeight: 800}}>UM JEITO MAIS CLARO DE ESTUDAR</Typography><Typography variant="h4" component="h2" sx={{mt: 1, mb: 1}}>Seu estudo, do seu jeito</Typography><Typography color="text.secondary" sx={{mb: 4}}>Entre pelo conteúdo que importa para o seu concurso.</Typography><Grid container spacing={3}>{paths.map(path => <Grid key={path.title} size={{xs: 12, md: 4}}><Card sx={{height: '100%', border: '1px solid #e0e9ed', boxShadow: 'none', borderRadius: 3}}><CardContent sx={{p: 3}}><Box sx={{width: 48, height: 48, display: 'grid', placeItems: 'center', color: '#147a62', bgcolor: '#e8f5ef', borderRadius: 2, mb: 2}}>{path.icon}</Box><Typography variant="h6" fontWeight={800}>{path.title}</Typography><Typography color="text.secondary" sx={{minHeight: 54, mt: 1}}>{path.description}</Typography><Button component={Link} to={path.to === '/treinos' && !user ? '/login' : path.to} sx={{px: 0, mt: 1, color: '#126a52'}}>{path.action} →</Button></CardContent></Card></Grid>)}</Grid></Container>
    <Box sx={{bgcolor: '#eaf2f3', py: 6}}><Container maxWidth="lg"><Stack direction={{xs: 'column', md: 'row'}} justifyContent="space-between" alignItems={{md: 'center'}} gap={3}><Box><Typography variant="h5" fontWeight={800}>Monte um treino para o seu objetivo</Typography><Typography color="text.secondary">Escolha os filtros e pratique com as questões disponíveis.</Typography></Box><Button component={Link} to="/questoes" variant="contained" sx={{bgcolor: '#163c51'}}>Escolher questões</Button></Stack></Container></Box>
  </>;
};

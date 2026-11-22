import { Box, Button, Card, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { useAuth } from '../hooks/useAuth';

const steps = [
  { icon: <EditNoteOutlinedIcon fontSize="large" />, title: 'Escolha seu foco', text: 'Selecione matéria, banca e nível ou cole o conteúdo de um edital.' },
  { icon: <AutoStoriesOutlinedIcon fontSize="large" />, title: 'Pratique com 10 questões', text: 'Responda no seu ritmo e confira as explicações geradas por IA.' },
  { icon: <InsightsOutlinedIcon fontSize="large" />, title: 'Aprenda com o resultado', text: 'Revise seus erros e acompanhe as tentativas no seu painel.' },
];

export const Home = () => {
  const { user } = useAuth();
  return (
    <>
      <Box sx={{ background: 'linear-gradient(125deg, #102f71 0%, #1746a2 60%, #2973bb 100%)', color: 'white', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label="Estudo orientado por prática" sx={{ mb: 3, bgcolor: '#ffffff22', color: 'white', fontWeight: 700 }} />
              <Typography component="h1" variant="h1" sx={{ fontSize: { xs: '2.6rem', md: '4.4rem' }, lineHeight: 1.08, mb: 3 }}>
                Prepare-se para o próximo concurso com mais foco.
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.92, maxWidth: 640, mb: 4, fontWeight: 400 }}>
                Crie simulados de 10 questões por matéria ou edital, pratique e entenda onde melhorar. As questões são geradas por inteligência artificial e devem ser conferidas antes de uso como referência oficial.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={Link} to={user ? '/criar-simulado' : '/signup'} variant="contained" size="large" sx={{ bgcolor: 'white', color: 'primary.dark', '&:hover': { bgcolor: '#e8efff' } }}>
                  {user ? 'Criar meu simulado' : 'Começar gratuitamente'}
                </Button>
                <Button component={Link} to={user ? '/dashboard' : '/about'} variant="outlined" size="large" sx={{ color: 'white', borderColor: '#ffffff99', '&:hover': { borderColor: 'white' } }}>
                  {user ? 'Ver meu desempenho' : 'Como funciona'}
                </Button>
              </Stack>
              <Typography variant="body2" sx={{ mt: 3, opacity: 0.85 }}>Até 3 gerações gratuitas por conta. O desbloqueio é solicitado pelo suporte.</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ p: { xs: 1, md: 2 }, boxShadow: '0 28px 65px #061b4b55' }}>
                <CardContent>
                  <Typography variant="overline" color="primary" fontWeight={800}>Seu próximo passo</Typography>
                  <Typography variant="h4" sx={{ mt: 1, mb: 2 }}>Um plano de prática simples</Typography>
                  <Stack spacing={2}>
                    {steps.map((step, index) => (
                      <Box key={step.title} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 1.5, bgcolor: index === 0 ? 'primary.light' : 'background.default', borderRadius: 2 }}>
                        <Box sx={{ color: 'primary.main' }}>{step.icon}</Box>
                        <Box><Typography fontWeight={700}>{step.title}</Typography><Typography variant="body2" color="text.secondary">{step.text}</Typography></Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Typography variant="h4" component="h2" sx={{ mb: 1 }}>Como seu estudo avança</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>Do conteúdo escolhido à revisão dos pontos que merecem atenção.</Typography>
        <Grid container spacing={3}>
          {steps.map(step => <Grid key={step.title} size={{ xs: 12, md: 4 }}><Card sx={{ height: '100%', boxShadow: '0 8px 28px #17243b0d' }}><CardContent sx={{ p: 3 }}><Box color="primary.main" mb={2}>{step.icon}</Box><Typography variant="h6" fontWeight={700} gutterBottom>{step.title}</Typography><Typography color="text.secondary">{step.text}</Typography></CardContent></Card></Grid>)}
        </Grid>
      </Container>
    </>
  );
};

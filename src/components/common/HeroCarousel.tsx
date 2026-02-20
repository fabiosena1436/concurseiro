import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';
import { Paper, Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

const items = [
  {
    name: 'Crie Simulados Personalizados',
    description: 'Utilize nossa inteligência artificial para gerar simulados focados nos seus concursos e matérias de interesse.',
    image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    link: '/criar-simulado',
    linkText: 'Criar Simulado'
  },
  {
    name: 'Analise seu Desempenho',
    description: 'Acompanhe seu progresso com relatórios detalhados, identificando seus pontos fortes e fracos.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    link: '/dashboard',
    linkText: 'Ver Desempenho'
  },
  {
    name: 'Pratique com Questões Reais',
    description: 'Nosso banco de questões é constantemente atualizado com provas de concursos de todo o país.',
    image: 'https://images.unsplash.com/photo-1588072432904-84382e2c2b77?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    link: '/#',
    linkText: 'Começar a Praticar'
  }
];

const HeroCarousel: React.FC = () => {
  return (
    <Carousel
      showThumbs={false}
      showStatus={false}
      infiniteLoop
      autoPlay
      interval={5000}
    >
      {items.map((item, i) => (
        <Paper
          key={i}
          sx={{
            position: 'relative',
            height: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${item.image})`
          }}
        >
          <Box textAlign="center" sx={{ maxWidth: 'md', px: 3 }}>
            <Typography variant="h3" component="h2" gutterBottom>
              {item.name}
            </Typography>
            <Typography variant="h6" sx={{ mb: 3 }}>
              {item.description}
            </Typography>
            <Button
              variant="contained"
              size="large"
              component={Link}
              to={item.link}
            >
              {item.linkText}
            </Button>
          </Box>
        </Paper>
      ))}
    </Carousel>
  );
};

export default HeroCarousel;

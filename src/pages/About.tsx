import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

export const About: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Sobre Nós
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Bem-vindo ao <strong>Simulado Concurso</strong>, a sua plataforma definitiva para a preparação de concursos públicos. Nossa missão é fornecer as ferramentas mais eficazes e inovadoras para ajudar você a alcançar a aprovação dos seus sonhos.
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Com a ajuda da inteligência artificial, oferecemos simulados personalizados que se adaptam às suas necessidades de estudo, focando nas matérias e bancas examinadoras do seu interesse. Acreditamos que a prática leva à perfeição, e é por isso que nosso banco de questões é vasto e está sempre sendo atualizado.
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4 }}>
          Nossa Visão
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Queremos ser a referência número um em preparação para concursos no Brasil, democratizando o acesso a um estudo de qualidade e ajudando a transformar a vida de milhares de pessoas através da educação e da tecnologia.
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4 }}>
          Fale Conosco
        </Typography>
        <Typography variant="body1">
          Tem alguma dúvida, sugestão ou feedback? Adoraríamos ouvir de você! Entre em contato conosco através do e-mail: <a href="mailto:contato@simuladoconcurso.com">contato@simuladoconcurso.com</a>.
        </Typography>
      </Paper>
    </Container>
  );
};
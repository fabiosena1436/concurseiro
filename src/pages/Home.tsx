import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../hooks/useAuth';

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 70vh;
  padding: ${(props) => props.theme.spacing.large};
`;

const Title = styled.h1`
  font-size: 2.5rem;
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #6c757d;
  margin-bottom: ${(props) => props.theme.spacing.large};
  max-width: 600px;
`;

const CtaButton = styled(Link)`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.medium} ${(props) => props.theme.spacing.xlarge};
  border-radius: 8px;
  font-size: 1.2rem;
  text-decoration: none;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: ${(props) => props.theme.colors.secondary};
  }
`;

export const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <HomeContainer>
      <Title>Sua plataforma completa para simulados de concurso</Title>
      <Subtitle>
        Crie simulados personalizados com inteligência artificial, pratique com questões reais e
        analise seu desempenho para alcançar a aprovação.
      </Subtitle>
      <CtaButton to={user ? "/dashboard" : "/login"}>
        {user ? 'Acessar meu painel' : 'Começar a praticar'}
      </CtaButton>
    </HomeContainer>
  );
};
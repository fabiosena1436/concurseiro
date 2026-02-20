import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common/Loader';

const AuthContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${(props) => props.theme.spacing.large};
  min-height: 80vh;
`;

const AuthBox = styled.div`
  width: 100%;
  max-width: 400px;
  padding: ${(props) => props.theme.spacing.large};
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
`;

const Title = styled.h1`
  color: ${(props) => props.theme.colors.dark};
  margin-bottom: ${(props) => props.theme.spacing.large};
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.medium};
`;

const Input = styled.input`
  padding: ${(props) => props.theme.spacing.medium};
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1rem;
`;

const Button = styled.button`
  background-color: ${(props) => props.theme.colors.primary};
  color: ${(props) => props.theme.colors.white};
  padding: ${(props) => props.theme.spacing.medium};
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${(props) => props.theme.colors.secondary};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.p`
  color: ${(props) => props.theme.colors.danger};
  text-align: center;
`;

const RedirectLink = styled.p`
  text-align: center;
  margin-top: ${(props) => props.theme.spacing.medium};

  a {
    color: ${(props) => props.theme.colors.primary};
    text-decoration: none;
    font-weight: bold;
  }
`;

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (!loading && user) {
            navigate('/dashboard');
        }
    }, [user, loading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError("Credenciais inválidas. Verifique seu e-mail e senha.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <Loader>Carregando...</Loader>;
    }

    return (
        <AuthContainer>
            <AuthBox>
                <Title>Entrar</Title>
                <Form onSubmit={handleLogin}>
                    <Input
                        type="email"
                        placeholder="Seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    {error && <ErrorMessage>{error}</ErrorMessage>}
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </Button>
                </Form>
                <RedirectLink>
                    Não tem uma conta? <Link to="/signup">Cadastre-se</Link>
                </RedirectLink>
            </AuthBox>
        </AuthContainer>
    );
};


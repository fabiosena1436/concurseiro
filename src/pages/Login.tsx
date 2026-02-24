import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common/Loader';
import { Container, Box, Typography, TextField, Button, Link as MuiLink } from '@mui/material';

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
        } catch (err) {
            if (err instanceof Error) {
              setError("Credenciais inválidas. Verifique seu e-mail e senha.");
            }
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <Loader>Carregando...</Loader>;
    }

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography component="h1" variant="h5">
                    Entrar
                </Typography>
                <Box component="form" onSubmit={(e) => void handleLogin(e)} sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Seu e-mail"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Sua senha"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && (
                        <Typography color="error" align="center">
                            {error}
                        </Typography>
                    )}
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </Button>
                    <Typography align="center">
                        Não tem uma conta?{' '}
                        <MuiLink component={Link} to="/signup" variant="body2">
                            Cadastre-se
                        </MuiLink>
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

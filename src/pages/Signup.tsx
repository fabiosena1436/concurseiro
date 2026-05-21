import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common/Loader';
import { Container, Box, Typography, TextField, Button, Link as MuiLink } from '@mui/material';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [name, setName] = useState('');
    const [socialName, setSocialName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (!loading && user) {
            navigate('/dashboard');
        }
    }, [user, loading, navigate]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            if (firebaseUser) {
                await setDoc(doc(db, "users", firebaseUser.uid), {
                    uid: firebaseUser.uid,
                    name,
                    socialName,
                    phone,
                    email: firebaseUser.email,
                    generationCount: 0,
                    isUnlocked: false,
                });
            }
            navigate('/dashboard');
        } catch (err: unknown) {
            if (typeof err === 'object' && err !== null && 'code' in err) {
                const firebaseError = err as { code: string };
                if (firebaseError.code === 'auth/email-already-in-use') {
                    setError("Este e-mail já está em uso.");
                } else if (firebaseError.code === 'auth/weak-password') {
                    setError("A senha deve ter pelo menos 6 caracteres.");
                } else {
                    setError("Ocorreu um erro ao criar a conta.");
                }
            } else {
                setError("Ocorreu um erro ao criar a conta.");
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
                    Criar Conta
                </Typography>
                <Box component="form" onSubmit={(e) => void handleSignup(e)} sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="name"
                        label="Nome Completo"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="socialName"
                        label="Nome Social"
                        name="socialName"
                        autoComplete="nickname"
                        value={socialName}
                        onChange={(e) => setSocialName(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="phone"
                        label="Telefone"
                        name="phone"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
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
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="confirmPassword"
                        label="Confirme sua senha"
                        type="password"
                        id="confirmPassword"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {isSubmitting ? 'Criando...' : 'Criar Conta'}
                    </Button>
                    <Typography align="center">
                        Já tem uma conta?{' '}
                        <MuiLink component={Link} to="/login" variant="body2">
                            Faça login
                        </MuiLink>
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../services/firebase';

export const Header: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/');
    }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            Simulado Concurso
          </Link>
        </Typography>
        <Box>
          <Button color="inherit" component={Link} to="/">
            Início
          </Button>
          <Button color="inherit" component={Link} to="/about">
            Sobre
          </Button>
          {user && (
            <Button color="inherit" component={Link} to="/dashboard">
              Dashboard
            </Button>
          )}
          <Button color="inherit" component={Link} to="/criar-simulado">
            Criar Simulado
          </Button>
          {user ? (
            <>
              <Button color="inherit">{user.email}</Button>
              <Button color="inherit" onClick={handleLogout}>
                Sair
              </Button>
            </>
          ) : (
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

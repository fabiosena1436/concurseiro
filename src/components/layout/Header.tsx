import { AppBar, Toolbar, Typography, Button, Box, useMediaQuery, IconButton, Drawer, List, ListItem, ListItemText, ListItemButton } from '@mui/material';
import React,
{
  useState
} from 'react';
import {
  Link,
  useNavigate
} from 'react-router-dom';
import {
  useAuth
} from '../../hooks/useAuth';
import {
  auth
} from '../../services/firebase';
import MenuIcon from '@mui/icons-material/Menu';
import {
  useTheme
} from '@mui/material/styles';


export const Header: React.FC = () => {
  const {
    user,
    userData
  } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  }

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = (
    <>
      <ListItemButton component={Link} to="/" onClick={handleDrawerToggle}>
        <ListItemText primary="Início" />
      </ListItemButton>
      <ListItemButton component={Link} to="/about" onClick={handleDrawerToggle}>
        <ListItemText primary="Sobre" />
      </ListItemButton>
      {user && (
        <ListItemButton component={Link} to="/dashboard" onClick={handleDrawerToggle}>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
      )}
      <ListItemButton component={Link} to="/criar-simulado" onClick={handleDrawerToggle}>
        <ListItemText primary="Criar Simulado" />
      </ListItemButton>
      {user ? (
        <>
          <ListItem>
            <ListItemText primary={userData?.socialName || user.email} />
          </ListItem>
          <ListItemButton onClick={() => { handleLogout(); handleDrawerToggle(); }}>
            <ListItemText primary="Sair" />
          </ListItemButton>
        </>
      ) : (
        <ListItemButton component={Link} to="/login" onClick={handleDrawerToggle}>
          <ListItemText primary="Login" />
        </ListItemButton>
      )}
    </>
  );

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            Simulado Concurso
          </Link>
        </Typography>
        {isMobile ? (
          <>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={handleDrawerToggle}
            >
              <Box
                sx={{ width: 250 }}
                role="presentation"
                onClick={handleDrawerToggle}
                onKeyDown={handleDrawerToggle}
              >
                <List>
                  {menuItems}
                </List>
              </Box>
            </Drawer>
          </>
        ) : (
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
                <Button color="inherit">{userData?.socialName || user.email}</Button>
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
        )}
      </Toolbar>
    </AppBar>
  );
};

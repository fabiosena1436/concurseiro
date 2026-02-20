import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../services/firebase';

const HeaderContainer = styled.header`
  background-color: ${(props) => props.theme.colors.dark};
  padding: ${(props) => props.theme.spacing.medium};
  color: ${(props) => props.theme.colors.white};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: bold;
`;

const Nav = styled.nav`
  display: flex;
  gap: ${(props) => props.theme.spacing.medium};
  align-items: center;
`;

const NavLink = styled(Link)`
  color: ${(props) => props.theme.colors.white};
  &:hover {
    text-decoration: underline;
  }
`;

const LogoutButton = styled.button`
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: underline;
`;

export const Header: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/');
    }

  return (
    <HeaderContainer>
      <Logo to="/">Simulado Concurso</Logo>
      <Nav>
        <NavLink to="/">Início</NavLink>
        {user && <NavLink to="/dashboard">Dashboard</NavLink>}
        <NavLink to="/criar-simulado">Criar Simulado</NavLink>
        {user ? (
            <>
                <span>{user.email}</span>
                <LogoutButton onClick={handleLogout}>Sair</LogoutButton>
            </>
        ) : (
            <NavLink to="/login">Login</NavLink>
        )}
      </Nav>
    </HeaderContainer>
  );
};

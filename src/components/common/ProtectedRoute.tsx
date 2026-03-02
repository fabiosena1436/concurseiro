import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader } from '../common/Loader';

interface ProtectedRouteProps {
  adminRequired?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ adminRequired = false }) => {
    const { user, isAdmin, loading } = useAuth();

    if (loading) {
        return <Loader />;
    }

    if (!user) {
        // Se não estiver logado, redireciona para a página de login
        return <Navigate to="/login" />;
    }

    if (adminRequired && !isAdmin) {
        // Se a rota exige admin e o usuário não é admin, redireciona para o dashboard
        return <Navigate to="/dashboard" />;
    }

    // Se passou por todas as verificações, permite o acesso à rota
    return <Outlet />;
};

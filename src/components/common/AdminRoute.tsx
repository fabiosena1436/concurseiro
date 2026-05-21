import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader } from './Loader';

export const AdminRoute: React.FC = () => {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return <Loader />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    // Verifica se é o email do admin ou se tem a flag isAdmin
    const isAdmin = user.email === 'fabiosena1436@gmail.com' || userData?.isAdmin;

    if (!isAdmin) {
        return <Navigate to="/dashboard" />;
    }

    return <Outlet />;
};

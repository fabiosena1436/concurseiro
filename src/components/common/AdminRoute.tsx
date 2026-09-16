import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader } from './Loader';

export const AdminRoute: React.FC = () => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return <Loader />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (!isAdmin) {
        return <Navigate to="/dashboard" />;
    }

    return <Outlet />;
};

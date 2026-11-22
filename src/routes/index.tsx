import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import App from "../App";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { AdminRoute } from "../components/common/AdminRoute";
import { Loader } from "../components/common/Loader";

const Home = lazy(() => import('../pages/Home').then(module => ({ default: module.Home })));
const Dashboard = lazy(() => import('../pages/Dashboard').then(module => ({ default: module.Dashboard })));
const ExamCreator = lazy(() => import('../pages/ExamCreator').then(module => ({ default: module.ExamCreator })));
const Exam = lazy(() => import('../pages/Exam').then(module => ({ default: module.Exam })));
const Results = lazy(() => import('../pages/Results').then(module => ({ default: module.Results })));
const Login = lazy(() => import('../pages/Login').then(module => ({ default: module.Login })));
const Signup = lazy(() => import('../pages/Signup').then(module => ({ default: module.Signup })));
const About = lazy(() => import('../pages/About').then(module => ({ default: module.About })));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const Support = lazy(() => import('../pages/Support').then(module => ({ default: module.Support })));
const page = (element: React.ReactNode) => <Suspense fallback={<Loader>Carregando página...</Loader>}>{element}</Suspense>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: page(<Home />),
      },
      {
        path: "/about",
        element: page(<About />),
      },
      {
        path: "/login",
        element: page(<Login />),
      },
      {
        path: "/signup",
        element: page(<Signup />),
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/dashboard",
            element: page(<Dashboard />),
          },
          {
            path: "/criar-simulado",
            element: page(<ExamCreator />),
          },
          {
            path: "/simulado/:id",
            element: page(<Exam />),
          },
          {
            path: "/resultados/:id",
            element: page(<Results />),
          },
          {
            path: "/suporte",
            element: page(<Support />),
          },
        ]
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: page(<AdminDashboard />),
          }
        ]
      }
    ],
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  }
});

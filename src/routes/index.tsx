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
const PaperCatalog = lazy(() => import('../pages/PaperCatalog').then(module => ({default: module.PaperCatalog})));
const PaperDetails = lazy(() => import('../pages/PaperCatalog').then(module => ({default: module.PaperDetails})));
const QuestionCatalog = lazy(() => import('../pages/QuestionCatalog').then(module => ({default: module.QuestionCatalog})));
const BankQuestionDetails = lazy(() => import('../pages/QuestionCatalog').then(module => ({default: module.BankQuestionDetails})));
const BankTraining = lazy(() => import('../pages/QuestionCatalog').then(module => ({default: module.BankTraining})));
const BankHistory = lazy(() => import('../pages/QuestionCatalog').then(module => ({default: module.BankHistory})));
const AdminCatalog = lazy(() => import('../pages/AdminCatalog').then(module => ({default: module.AdminCatalog})));
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
      {path: "/provas", element: page(<PaperCatalog />)},
      {path: "/provas/:id", element: page(<PaperDetails />)},
      {path: "/questoes", element: page(<QuestionCatalog />)},
      {path: "/questoes/:id", element: page(<BankQuestionDetails />)},
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
          {path: "/treinos/:id", element: page(<BankTraining />)},
          {path: "/treinos", element: page(<BankHistory />)},
        ]
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: page(<AdminDashboard />),
          },
          {path: "/admin/acervo", element: page(<AdminCatalog />)},
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

import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import { Home } from "../pages/Home";
import { Dashboard } from "../pages/Dashboard";
import { ExamCreator } from "../pages/ExamCreator";
import { Exam } from "../pages/Exam";
import { Results } from "../pages/Results";
import { Login } from "../pages/Login";
import { Signup } from "../pages/Signup";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { AdminRoute } from "../components/common/AdminRoute";
import { About } from "../pages/About";
import { AdminDashboard } from "../pages/AdminDashboard";
import { Support } from "../pages/Support";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/signup",
        element: <Signup />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/dashboard",
            element: <Dashboard />,
          },
          {
            path: "/criar-simulado",
            element: <ExamCreator />,
          },
          {
            path: "/simulado/:id",
            element: <Exam />,
          },
          {
            path: "/resultados/:id",
            element: <Results />,
          },
          {
            path: "/suporte",
            element: <Support />,
          },
        ]
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: <AdminDashboard />,
          }
        ]
      }
    ],
  },
]);
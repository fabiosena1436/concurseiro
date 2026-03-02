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
import { About } from "../pages/About";
import AdminPage from "../pages/Admin"; // Import the new Admin page

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
        // This group protects routes that require authentication
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
        ]
      },
      {
        // This group protects routes that require admin privileges
        // We will enhance ProtectedRoute to check for an 'admin' role
        element: <ProtectedRoute adminRequired={true} />,
        children: [
          {
            path: "/admin",
            element: <AdminPage />,
          },
        ]
      }
    ],
  },
]);
import { createBrowserRouter } from "react-router";
import { Layout, RequireAuth } from "./Layout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { WorldListPage, WorldPage } from "./pages/WorldPages";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <WorldListPage /> },
          { path: "/worlds/:worldId", element: <WorldPage /> },
        ],
      },
    ],
  },
]);

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectDetail from "./pages/ProspectDetail";
import Search from "./pages/Search";
import ColdCall from "./pages/ColdCall";
import Planning from "./pages/Planning";
import Settings from "./pages/Settings";

function PrivateRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoutes />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prospects" element={<Prospects />} />
            <Route path="/prospects/nouveau" element={<ProspectDetail />} />
            <Route path="/prospects/:id" element={<ProspectDetail />} />
            <Route path="/recherche" element={<Search />} />
            <Route path="/cold-call" element={<ColdCall />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/reglages" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

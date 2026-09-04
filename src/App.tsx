import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ClientLayout from './layouts/ClientLayout';
import CompanyLayout from './layouts/CompanyLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import StorePage from './pages/client/StorePage';
import CartPage from './pages/client/CartPage';
import OrdersPage from './pages/client/OrdersPage';
import TicketsPage from './pages/client/TicketsPage';
import ChatPage from './pages/client/ChatPage';
import FinancialPage from './pages/client/FinancialPage';
import { DashboardPage, CatalogPage, ClientsPage, CompanyOrdersPage, TeamPage, CompanyTicketsPage, CompanyChatPage } from './pages/company/CompanyPages';
import CompaniesPage from './pages/superadmin/CompaniesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Cliente */}
            <Route element={<ProtectedRoute allowedRoles={['cliente']} />}>
              <Route element={<ClientLayout />}>
                <Route path="/loja" element={<StorePage />} />
                <Route path="/carrinho" element={<CartPage />} />
                <Route path="/pedidos" element={<OrdersPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/financeiro" element={<FinancialPage />} />
              </Route>
            </Route>

            {/* Empresa */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<CompanyLayout />}>
                <Route path="/empresa" element={<DashboardPage />} />
                <Route path="/empresa/catalogo" element={<CatalogPage />} />
                <Route path="/empresa/clientes" element={<ClientsPage />} />
                <Route path="/empresa/pedidos" element={<CompanyOrdersPage />} />
                <Route path="/empresa/equipe" element={<TeamPage />} />
                <Route path="/empresa/tickets" element={<CompanyTicketsPage />} />
                <Route path="/empresa/chat" element={<CompanyChatPage />} />
              </Route>
            </Route>

            {/* Super Admin */}
            <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
              <Route element={<SuperAdminLayout />}>
                <Route path="/superadmin" element={<CompaniesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

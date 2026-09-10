import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ClientLayout from './layouts/ClientLayout';
import CompanyLayout from './layouts/CompanyLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import StorePage from './pages/client/StorePage';
import ProductPage from './pages/client/ProductPage'; // ✅ página de produto (e-commerce)
import CartPage from './pages/client/CartPage';
import OrdersPage from './pages/client/OrdersPage';
import TicketsPage from './pages/client/TicketsPage';
import ChatPage from './pages/client/ChatPage';
import FinancialPage from './pages/client/FinancialPage';
// CatalogPage é um arquivo próprio — NÃO é exportado por CompanyPages.
import CatalogPage from './pages/company/CatalogPage';
import CategoriesPage from './pages/company/CategoriesPage';
import PricingPage from './pages/company/PricingPage';
import QuantityDiscountsPage from './pages/company/QuantityDiscountsPage'; // ✅ descontos por quantidade
import CompanyFinancialPage from './pages/company/CompanyFinancialPage';
import CompaniesPage from './pages/superadmin/CompaniesPage';
import {
  DashboardPage, ClientsPage, CompanyOrdersPage, TeamPage,
  CompanyTicketsPage, CompanyChatPage,
} from './pages/company/CompanyPages';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Cliente (customer_id !== null) */}
            <Route element={<ProtectedRoute profiles={['cliente']} />}>
              <Route element={<ClientLayout />}>
                <Route path="/loja" element={<StorePage />} />
                <Route path="/loja/produto/:id" element={<ProductPage />} />
                <Route path="/carrinho" element={<CartPage />} />
                <Route path="/pedidos" element={<OrdersPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/financeiro" element={<FinancialPage />} />
              </Route>
            </Route>

            {/* Empresa (tenant_id !== null && customer_id === null) */}
            <Route element={<ProtectedRoute profiles={['empresa']} />}>
              <Route element={<CompanyLayout />}>
                <Route path="/empresa" element={<DashboardPage />} />
                <Route path="/empresa/catalogo" element={<CatalogPage />} />
                <Route path="/empresa/categorias" element={<CategoriesPage />} />
                <Route path="/empresa/clientes" element={<ClientsPage />} />
                <Route path="/empresa/pedidos" element={<CompanyOrdersPage />} />
                <Route path="/empresa/equipe" element={<TeamPage />} />
                <Route path="/empresa/tickets" element={<CompanyTicketsPage />} />
                <Route path="/empresa/chat" element={<CompanyChatPage />} />
                <Route path="/empresa/precos" element={<PricingPage />} />
                <Route path="/empresa/descontos" element={<QuantityDiscountsPage />} />
                <Route path="/empresa/financeiro" element={<CompanyFinancialPage />} />
              </Route>
            </Route>

            {/* Super Admin (is_super_admin === true) */}
            <Route element={<ProtectedRoute profiles={['superadmin']} />}>
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
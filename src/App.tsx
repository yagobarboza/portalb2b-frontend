import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import { PERMISSIONS } from './lib/constants';
import LoginPage from './pages/LoginPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
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
// ✅ Página dedicada de EDIÇÃO de produto (estilo Tray/VTEX/Nuvemshop).
import ProductEditPage from './pages/company/ProductEditPage';
import CategoriesPage from './pages/company/CategoriesPage';
import PricingPage from './pages/company/PricingPage';
import QuantityDiscountsPage from './pages/company/QuantityDiscountsPage'; // ✅ descontos por quantidade
// ✅ Regras de Compra da empresa (mínimo em valor e/ou quantidade).
import PurchaseRulesPage from './pages/company/PurchaseRulesPage';
import CompanyFinancialPage from './pages/company/CompanyFinancialPage';
// ✅ Integrações ERP (agente do cliente → chave de API → ingestão de estoque).
// ✅ Pagamentos & Assinatura (billing Asaas) — admin da empresa.
import CompanyBillingPage from './pages/company/CompanyBillingPage';
import CompaniesPage from './pages/superadmin/CompaniesPage';
// ✅ Situação financeira de TODAS as empresas + criação de cobranças (Super Admin).
import BillingAdminPage from './pages/superadmin/BillingAdminPage';
// ✅ Configurações do PERFIL (contém o MFA) — acessível a todos os perfis
// logados, via menu do usuário (avatar), DENTRO do layout de cada perfil.
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import {
  DashboardPage, ClientsPage, CompanyOrdersPage, TeamPage,
  CompanyTicketsPage, CompanyChatPage,
} from './pages/company/CompanyPages';

const IntegrationsPage = lazy(() => import('./features/integrations/pages/IntegrationsPage'));
const IntegrationDetailPage = lazy(() => import('./features/integrations/pages/IntegrationDetailPage'));
const integrationFallback = <div className="p-8 text-sm text-muted-foreground">Carregando integrações…</div>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

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
                {/* ✅ Configurações do perfil (cliente) */}
                <Route path="/perfil" element={<ProfileSettingsPage />} />
              </Route>
            </Route>

            {/* Empresa (tenant_id !== null && customer_id === null) */}
            <Route element={<ProtectedRoute profiles={['empresa']} />}>
              <Route element={<CompanyLayout />}>
                <Route path="/empresa" element={<DashboardPage />} />
                <Route path="/empresa/catalogo" element={<CatalogPage />} />
                {/* ✅ Edição dedicada de produto — link vindo do botão "Editar"
                    do catálogo. O backend (CATALOG_MANAGE + tenant) é a autoridade. */}
                <Route path="/empresa/produtos/:id" element={<ProductEditPage />} />
                <Route path="/empresa/categorias" element={<CategoriesPage />} />
                <Route path="/empresa/clientes" element={<ClientsPage />} />
                <Route path="/empresa/pedidos" element={<CompanyOrdersPage />} />
                <Route path="/empresa/equipe" element={<TeamPage />} />
                <Route path="/empresa/tickets" element={<CompanyTicketsPage />} />
                <Route path="/empresa/chat" element={<CompanyChatPage />} />
                <Route path="/empresa/precos" element={<PricingPage />} />
                <Route path="/empresa/descontos" element={<QuantityDiscountsPage />} />
                {/* ✅ Regras de Compra da empresa */}
                <Route path="/empresa/regras" element={<PurchaseRulesPage />} />
                <Route path="/empresa/financeiro" element={<CompanyFinancialPage />} />
                {/* ✅ Integrações ERP — cria integração, gera/revoga a chave do
                    agente e consulta as execuções. Só usuários da empresa. */}
                <Route element={<ProtectedRoute requiredPermission={PERMISSIONS.INTEGRATION_READ} />}>
                  <Route path="/empresa/integracoes" element={<Suspense fallback={integrationFallback}><IntegrationsPage /></Suspense>} />
                  <Route path="/empresa/integracoes/:id" element={<Suspense fallback={integrationFallback}><IntegrationDetailPage /></Suspense>} />
                </Route>
                {/* ✅ Pagamentos & Assinatura (billing Asaas) — admin da empresa. */}
                <Route path="/empresa/pagamentos" element={<CompanyBillingPage />} />
                {/* ✅ Configurações do perfil (empresa) — caminho PRÓPRIO,
                    dentro do CompanyLayout. FIX: antes era /perfil duplicada,
                    que caía no bloco cliente (first-match) e redirecionava. */}
                <Route path="/empresa/perfil" element={<ProfileSettingsPage />} />
              </Route>
            </Route>

            {/* Super Admin (is_super_admin === true) */}
            <Route element={<ProtectedRoute profiles={['superadmin']} />}>
              <Route element={<SuperAdminLayout />}>
                <Route path="/superadmin" element={<CompaniesPage />} />
                {/* ✅ Situação financeira global + criação de cobranças/assinaturas */}
                <Route path="/superadmin/pagamentos" element={<BillingAdminPage />} />
                {/* ✅ Configurações do perfil (super admin) */}
                <Route path="/superadmin/perfil" element={<ProfileSettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

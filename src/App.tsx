import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// ── Code-splitting (B12): cada rota carrega seu chunk sob demanda.
// Reduz o bundle inicial e melhora o TTI. Fallback = spinner discreto.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ClientLayout = lazy(() => import('./layouts/ClientLayout'));
const CompanyLayout = lazy(() => import('./layouts/CompanyLayout'));
const SuperAdminLayout = lazy(() => import('./layouts/SuperAdminLayout'));

const StorePage = lazy(() => import('./pages/client/StorePage'));
const CartPage = lazy(() => import('./pages/client/CartPage'));
const OrdersPage = lazy(() => import('./pages/client/OrdersPage'));
const TicketsPage = lazy(() => import('./pages/client/TicketsPage'));
const ChatPage = lazy(() => import('./pages/client/ChatPage'));
const FinancialPage = lazy(() => import('./pages/client/FinancialPage'));

// CompanyPages exporta componentes nomeados → mapeia para default.
const DashboardPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.DashboardPage })),
);
const ClientsPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.ClientsPage })),
);
const CompanyOrdersPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.CompanyOrdersPage })),
);
const TeamPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.TeamPage })),
);
const CompanyTicketsPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.CompanyTicketsPage })),
);
const CompanyChatPage = lazy(() =>
  import('./pages/company/CompanyPages').then((m) => ({ default: m.CompanyChatPage })),
);
const CatalogPage = lazy(() => import('./pages/company/CatalogPage'));
const CompanyFinancialPage = lazy(() => import('./pages/company/CompanyFinancialPage'));
const CompaniesPage = lazy(() => import('./pages/superadmin/CompaniesPage'));

// Fallback de carregamento para Suspense (discreto, sem flash).
function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Cliente (customer_id !== null) */}
              <Route element={<ProtectedRoute profiles={['cliente']} />}>
                <Route element={<ClientLayout />}>
                  <Route path="/loja" element={<StorePage />} />
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
                  <Route path="/empresa/clientes" element={<ClientsPage />} />
                  <Route path="/empresa/pedidos" element={<CompanyOrdersPage />} />
                  <Route path="/empresa/equipe" element={<TeamPage />} />
                  <Route path="/empresa/tickets" element={<CompanyTicketsPage />} />
                  <Route path="/empresa/chat" element={<CompanyChatPage />} />
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
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
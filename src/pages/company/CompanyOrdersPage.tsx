import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Check, X, MoreHorizontal, FileText, FileSpreadsheet, Download, Search, Package, DollarSign, Clock, CheckCircle, XCircle, BarChart3, Filter } from 'lucide-react';
import { mockOrders, mockCustomers } from '../../data/mock';
import { formatCurrency, formatDate } from '../../lib/format';
import { exportOrdersReportPDF, exportOrdersReportXLSX } from '../../lib/export';
import type { OrderStatus } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const statusLabel: Record<OrderStatus, string> = { submitted: 'Aguardando análise', approved: 'Aprovado', shipped: 'Enviado', cancelled: 'Cancelado' };
const statusClass: Record<OrderStatus, string> = { submitted: 'bg-amber-100 text-amber-800', approved: 'bg-blue-100 text-blue-800', shipped: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-800' };

export default function CompanyOrdersPage() {
  const [orders, setOrders] = useState(mockOrders);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const update = (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o));
    toast.success(status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado');
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      const matchCustomer = filterCustomer === 'all' || o.customerId === filterCustomer;
      const matchSearch = !search ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase());
      const orderDate = new Date(o.createdAt);
      const matchFrom = !dateFrom || orderDate >= new Date(dateFrom);
      const matchTo = !dateTo || orderDate <= new Date(dateTo + 'T23:59:59');
      return matchStatus && matchCustomer && matchSearch && matchFrom && matchTo;
    });
  }, [orders, filterStatus, filterCustomer, search, dateFrom, dateTo]);

  const totalOrders = filtered.length;
  const pending = filtered.filter((o) => o.status === 'submitted').length;
  const approved = filtered.filter((o) => o.status === 'approved').length;
  const denied = filtered.filter((o) => o.status === 'cancelled').length;
  const totalValue = filtered.reduce((s, o) => s + o.total, 0);
  const totalItems = filtered.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0);

  const hasActiveFilters = filterStatus !== 'all' || filterCustomer !== 'all' || dateFrom || dateTo || search;

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterCustomer('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum pedido para exportar');
      return;
    }
    exportOrdersReportPDF(filtered, 'Distribuidora TechMax', {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: filterStatus,
      customer: filterCustomer !== 'all' ? mockCustomers.find((c) => c.id === filterCustomer)?.name : undefined,
      search: search || undefined,
    });
    toast.success('Relatório PDF gerado');
  };

  const handleExportXLSX = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum pedido para exportar');
      return;
    }
    exportOrdersReportXLSX(filtered);
    toast.success('Relatório XLSX gerado');
  };

  const kpis = [
    { label: 'Total de pedidos', value: String(totalOrders), icon: Package, tone: 'text-blue-600 bg-blue-100' },
    { label: 'Aguardando aprovação', value: String(pending), icon: Clock, tone: 'text-amber-600 bg-amber-100' },
    { label: 'Aprovados', value: String(approved), icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Negados', value: String(denied), icon: XCircle, tone: 'text-red-600 bg-red-100' },
    { label: 'Valor total', value: formatCurrency(totalValue), icon: DollarSign, tone: 'text-violet-600 bg-violet-100' },
    { label: 'Itens vendidos', value: String(totalItems), icon: BarChart3, tone: 'text-indigo-600 bg-indigo-100' },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Pedidos</h1>
          <p className="mt-1 text-muted-foreground">Consulte, filtre e exporte os pedidos realizados na plataforma.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg p-2 ${k.tone}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou cliente..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-full sm:w-40" placeholder="Data inicial" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-full sm:w-40" placeholder="Data final" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | OrderStatus)}>
              <SelectTrigger size="sm" className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="submitted">Aguardando análise</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="shipped">Enviado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger size="sm" className="w-full sm:w-44">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {mockCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <Filter className="w-3.5 h-3.5 mr-1.5" />Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhum pedido encontrado</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Ajuste os filtros para ver mais resultados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-semibold">#{o.id.replace('order-', '')}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  <TableCell className="text-center">{o.items.reduce((q, i) => q + i.qty, 0)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(o.total)}</TableCell>
                  <TableCell><Badge className={statusClass[o.status]}>{statusLabel[o.status]}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    {o.status === 'submitted' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => update(o.id, 'approved')}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => update(o.id, 'cancelled')}><X className="mr-1 h-3.5 w-3.5" />Rejeitar</Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

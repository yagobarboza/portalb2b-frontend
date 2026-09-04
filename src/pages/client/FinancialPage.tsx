import { mockFinancialRecords } from '../../data/mock';
import type { FinancialStatus } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Clock, Lock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/format';

function statusBadge(status: FinancialStatus) {
  const map: Record<FinancialStatus, { label: string; className: string }> = {
    aberto: { label: 'Em aberto', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    pago: { label: 'Pago', className: 'bg-green-100 text-green-800 border-green-200' },
    vencido: { label: 'Vencido', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

export default function FinancialPage() {
  const records = mockFinancialRecords.filter((r) => r.customerId === 'cust-1');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Acompanhe suas faturas e pagamentos</p>
      </div>

      {/* EM BREVE Banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl">
        {/* Blurred background preview */}
        <div className="blur-sm opacity-40 pointer-events-none select-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extrato Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.description}</TableCell>
                      <TableCell>{formatDate(r.dueDate)}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(r.amount)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Overlay Banner */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px] rounded-2xl">
          <div className="text-center px-8 py-12">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-full text-lg font-bold mb-4 shadow-lg">
              <Clock className="w-5 h-5" />
              EM BREVE
            </div>
            <p className="text-muted-foreground max-w-sm mt-2">
              O módulo financeiro está em desenvolvimento. Em breve você poderá visualizar faturas,
              emitir boletos e acompanhar pagamentos diretamente por aqui.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards (also blurred) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 blur-sm opacity-40 pointer-events-none select-none">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total em Aberto</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(records.filter(r => r.status === 'aberto').reduce((s, r) => s + r.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Pago</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(records.filter(r => r.status === 'pago').reduce((s, r) => s + r.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Vencido</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(records.filter(r => r.status === 'vencido').reduce((s, r) => s + r.amount, 0))}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Lock } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { FinancialAccount, FinancialAccountPage, FinancialAccountStatus } from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '../../components/ui/tabs';
import { formatCurrency, formatDate } from '../../lib/format';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<FinancialAccountStatus, string> = {
  open: 'Em Aberto',
  paid: 'Liquidado',
  overdue: 'Vencido',
};

const STATUS_BADGE: Record<FinancialAccountStatus, 'default' | 'secondary' | 'destructive'> = {
  open: 'default',
  paid: 'secondary',
  overdue: 'destructive',
};

export default function FinancialPage() {
  const [tab, setTab] = useState<FinancialAccountStatus>('open');
  const [records, setRecords] = useState<FinancialAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<FinancialAccountPage>(`/financial/accounts/${tab}`, {
        page: 1,
        page_size: PAGE_SIZE,
      });
      setRecords(data.items);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar os títulos financeiros.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Financeiro</h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe seus títulos a pagar e a receber ({total} no total).
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FinancialAccountStatus)}>
        <TabsList className="mb-4">
          <TabsTrigger value="open">Em Aberto</TabsTrigger>
          <TabsTrigger value="paid">Liquidados</TabsTrigger>
          <TabsTrigger value="overdue">Vencidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {STATUS_LABELS[tab]} <span className="font-normal text-muted-foreground">({total})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="py-10 text-center text-muted-foreground">Carregando…</p>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Lock className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold text-muted-foreground">Nenhum título</h3>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    Nenhum título financeiro nesta categoria.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.document}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(r.value)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(r.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Dados atualizados em tempo real a partir da sua conta.
      </p>
    </div>
  );
}
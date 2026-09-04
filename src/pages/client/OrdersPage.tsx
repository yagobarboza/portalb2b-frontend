import { useState } from 'react';
import { mockOrders } from '../../data/mock';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Separator } from '../../components/ui/separator';
import { Package, ChevronDown, ChevronRight, FileText, FileSpreadsheet, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/format';
import { exportOrderPDF, exportOrderXLSX } from '../../lib/export';
import type { OrderStatus } from '../../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    submitted: { label: 'Aguardando Aprovação', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    approved: { label: 'Aprovado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    shipped: { label: 'Enviado/Entregue', className: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const { className } = map[status];
  return (
    <Badge variant="outline" className={className}>
      {map[status].label}
    </Badge>
  );
}

export default function ClientOrdersPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const clientOrders = mockOrders
    .filter((o) => o.customerId === 'cust-1')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meus Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o status dos seus pedidos
          </p>
        </div>
      </div>

      {clientOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum pedido encontrado</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Seus pedidos aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientOrders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm">#{order.id.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      {statusBadge(order.status)}
                      <div className="hidden sm:block">
                        <p className="text-sm text-muted-foreground">
                          {order.items.length} ite{order.items.length !== 1 ? 'ns' : 'm'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">{formatCurrency(order.total)}</span>
                      {expandedId === order.id ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === order.id && (
                  <div className="border-t px-4 py-3 bg-muted/20">
                    {order.note && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-xs font-medium text-amber-800">Observação: {order.note}</p>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Produto</TableHead>
                          <TableHead className="text-xs text-center">Qtd</TableHead>
                          <TableHead className="text-xs text-right">Unit.</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="text-sm py-2">{item.productName}</TableCell>
                            <TableCell className="text-sm py-2 text-center">{item.qty}</TableCell>
                            <TableCell className="text-sm py-2 text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-sm py-2 text-right font-medium">{formatCurrency(item.unitPrice * item.qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Exportar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => exportOrderPDF(order, 'TechnoOffice Ltda')}>
                            <FileText className="w-4 h-4 mr-2" />
                            Baixar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportOrderXLSX(order)}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Baixar XLSX
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="font-bold">Total: {formatCurrency(order.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

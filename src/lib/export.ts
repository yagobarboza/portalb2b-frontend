/**
 * Utilitários de exportação (Blocos 4/7).
 * Gera relatórios de pedidos em Excel (SheetJS/XLSX) e PDF (jsPDF).
 *
 * ✅ Purga do mock (Bloco 12):
 * - Nenhum dado fictício — as funções recebem os dados REAIS da API.
 * - Resolução de SKU/nome de produto via mapa fornecido pelo chamador
 *   (nunca importa de src/data/mock).
 */
import XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate } from './format';
import type { Order } from '@/types/api';

/** Rótulos PT-BR dos status de pedido (espelho do backend). */
const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Enviado',
  received: 'Recebido',
  under_review: 'Em Análise',
  awaiting_customer: 'Aguardando Cliente',
  approved: 'Aprovado',
  processing: 'Em Processamento',
  invoiced: 'Faturado',
  shipped: 'Enviado / Trânsito',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

/** Converte id/número do pedido para exibição (remove prefixo legado "order-"). */
export function orderNumber(idOrNumber: string): string {
  return idOrNumber.replace(/^order-/, '');
}

/**
 * Resolve o SKU de um produto a partir de um mapa (id → produto).
 * Sem mapa, retorna o próprio id (fallback seguro — nunca quebra o relatório).
 */
export function productSku(
  productId: string,
  products: Array<{ id: string; sku: string }> = []
): string {
  return products.find((p) => p.id === productId)?.sku ?? productId;
}

/**
 * Resolve o NOME de um produto a partir de um mapa (id → produto).
 * Sem mapa, retorna o próprio id (fallback seguro).
 */
export function productName(
  productId: string,
  products: Array<{ id: string; name: string }> = []
): string {
  return products.find((p) => p.id === productId)?.name ?? productId;
}

/** Exporta UM pedido em Excel (.xlsx). */
export function exportOrderXLSX(
  order: Order,
  products: Array<{ id: string; name: string; sku: string }> = []
): void {
  const rows = order.items.map((item) => ({
    'Produto': productName(item.product_id, products),
    'SKU': productSku(item.product_id, products),
    'Quantidade': item.quantity,
    'Unitário': item.unit_price,
    'Subtotal': item.subtotal,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  XLSX.writeFile(wb, `pedido-${order.number}.xlsx`);
}

export interface OrderReportFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string;
  customer?: string;
  search?: string;
}

/** Exporta o relatório de pedidos em Excel (.xlsx). */
export function exportOrdersReportXLSX(orders: Order[]): void {
  const rows = orders.map((o) => ({
    'Número do Pedido': orderNumber(o.number),
    'Cliente': o.customer_id,
    'Data': formatDate(o.created_at),
    'Itens': o.items.reduce((q, i) => q + i.quantity, 0),
    'Valor': o.total,
    'Status': STATUS_LABELS[o.status] || o.status,
    'Atualizado em': formatDate(o.created_at),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, 'relatorio-pedidos.xlsx');
}

/** Exporta o relatório de pedidos em PDF (jsPDF). */
export function exportOrdersReportPDF(
  orders: Order[],
  filters: OrderReportFilters = {}
): void {
  const doc = new jsPDF();

  // Cabeçalho
  doc.setFontSize(16);
  doc.text('Relatório de Pedidos', 14, 20);
  doc.setFontSize(8);

  // Resumo dos filtros
  let y = 38;
  const period = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom ? formatDate(filters.dateFrom) : 'Início'} até ${filters.dateTo ? formatDate(filters.dateTo) : 'Hoje'}`
    : 'Todos os períodos';
  doc.text(`Período: ${period}`, 14, y); y += 5;
  doc.text(
    `Status: ${filters.status && filters.status !== 'all' ? (STATUS_LABELS[filters.status] || filters.status) : 'Todos'}`,
    14, y,
  ); y += 5;
  doc.text(`Cliente: ${filters.customer && filters.customer !== 'all' ? filters.customer : 'Todos'}`, 14, y); y += 5;
  if (filters.search) {
    doc.text(`Busca: ${filters.search}`, 14, y); y += 5;
  }
  y += 4;

  // Tabela
  doc.setFontSize(8);
  doc.text('Nº', 14, y); doc.text('Cliente', 34, y); doc.text('Data', 70, y);
  doc.text('Valor', 110, y); doc.text('Status', 140, y);
  y += 5;
  const approved = orders.filter((o) => o.status === 'completed').length;
  const denied = orders.filter((o) => o.status === 'cancelled').length;
  const totalValue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalItems = orders.reduce((q, o) => q + o.items.reduce((qi, i) => qi + i.quantity, 0), 0);
  for (const o of orders) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(orderNumber(o.number), 14, y);
    doc.text(o.customer_id, 34, y);
    doc.text(formatDate(o.created_at), 70, y);
    doc.text(formatCurrency(o.total), 110, y);
    doc.text(STATUS_LABELS[o.status] || o.status, 140, y);
    y += 5;
  }

  // Rodapé resumo
  y += 6;
  doc.text(`Total de pedidos: ${orders.length}`, 14, y); y += 5;
  doc.text(`Concluídos: ${approved}`, 14, y); y += 5;
  doc.text(`Negados: ${denied}`, 14, y); y += 5;
  doc.text(`Valor total: ${formatCurrency(totalValue)}`, 14, y); y += 5;
  doc.text(`Quantidade total de itens: ${totalItems}`, 14, y);

  doc.save('relatorio-pedidos.pdf');
}
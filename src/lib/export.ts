import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Order } from '../types';
import { mockProducts } from '../data/mock';
import { formatCurrency, formatDate, formatDateTime } from './format';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Aguardando Aprovação',
  approved: 'Aprovado',
  shipped: 'Enviado/Entregue',
  cancelled: 'Cancelado',
};

function orderNumber(id: string): string {
  return `#${id.replace('order-', '').toUpperCase()}`;
}

export function exportOrderPDF(order: Order, companyName: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Relatório de Pedido', 14, 27);

  doc.setDrawColor(220);
  doc.line(14, 31, pageWidth - 14, 31);

  // Order info
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(orderNumber(order.id), 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Data de emissão: ${formatDate(order.createdAt)}`, 14, 46);
  doc.text(`Cliente: ${order.customerName}`, 14, 52);
  doc.text(`Status: ${STATUS_LABELS[order.status] || order.status}`, 14, 58);
  if (order.note) {
    doc.text(`Observação: ${order.note}`, 14, 64);
  }

  // Items table
  autoTable(doc, {
    startY: order.note ? 70 : 64,
    head: [['SKU', 'Produto', 'Qtd', 'Preço Unit.', 'Subtotal']],
    body: order.items.map((item) => [
      mockProducts.find((product) => product.id === item.productId)?.sku || item.productId,
      item.productName,
      String(item.qty),
      formatCurrency(item.unitPrice),
      formatCurrency(item.unitPrice * item.qty),
    ]),
    headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Total
  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(order.total)}`, pageWidth - 14, afterTable + 10, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`pedido-${order.id.replace('order-', '')}.pdf`);
}

export function exportOrderXLSX(order: Order) {
  const rows = order.items.map((item) => ({
    'Número do Pedido': orderNumber(order.id),
    'Data': formatDate(order.createdAt),
    'Cliente': order.customerName,
    'Produto': item.productName,
    'SKU': mockProducts.find((product) => product.id === item.productId)?.sku || item.productId,
    'Quantidade': item.qty,
    'Preço Unitário': item.unitPrice,
    'Subtotal': item.unitPrice * item.qty,
    'Status': STATUS_LABELS[order.status] || order.status,
    'Total Geral': order.total,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 36 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  XLSX.writeFile(wb, `pedido-${order.id.replace('order-', '')}.xlsx`);
}

export function exportOrdersReportPDF(
  orders: Order[],
  companyName: string,
  filters: { dateFrom?: string; dateTo?: string; status?: string; customer?: string; search?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Relatório de Pedidos', 14, 27);

  doc.setDrawColor(220);
  doc.line(14, 31, pageWidth - 14, 31);

  // Filters summary
  doc.setTextColor(0);
  doc.setFontSize(8);
  let y = 38;
  const period = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom ? formatDate(filters.dateFrom) : 'Início'} até ${filters.dateTo ? formatDate(filters.dateTo) : 'Hoje'}`
    : 'Todos os períodos';
  doc.text(`Período: ${period}`, 14, y); y += 5;
  doc.text(`Status: ${filters.status && filters.status !== 'all' ? STATUS_LABELS[filters.status] || filters.status : 'Todos'}`, 14, y); y += 5;
  doc.text(`Cliente: ${filters.customer && filters.customer !== 'all' ? filters.customer : 'Todos'}`, 14, y); y += 5;
  if (filters.search) {
    doc.text(`Busca: ${filters.search}`, 14, y); y += 5;
  }

  // Indicators
  const total = orders.length;
  const pending = orders.filter((o) => o.status === 'submitted').length;
  const approved = orders.filter((o) => o.status === 'approved').length;
  const denied = orders.filter((o) => o.status === 'cancelled').length;
  const totalValue = orders.reduce((s, o) => s + o.total, 0);
  const totalItems = orders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  y += 2;
  doc.text('Indicadores', 14, y); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Total de pedidos: ${total}`, 14, y); y += 5;
  doc.text(`Aguardando aprovação: ${pending}`, 14, y); y += 5;
  doc.text(`Aprovados: ${approved}`, 14, y); y += 5;
  doc.text(`Negados: ${denied}`, 14, y); y += 5;
  doc.text(`Valor total: ${formatCurrency(totalValue)}`, 14, y); y += 5;
  doc.text(`Quantidade total de itens: ${totalItems}`, 14, y); y += 5;

  // Orders table
  autoTable(doc, {
    startY: y + 2,
    head: [['Pedido', 'Cliente', 'Data', 'Itens', 'Valor', 'Status']],
    body: orders.map((o) => [
      orderNumber(o.id),
      o.customerName,
      formatDate(o.createdAt),
      String(o.items.reduce((q, i) => q + i.qty, 0)),
      formatCurrency(o.total),
      STATUS_LABELS[o.status] || o.status,
    ]),
    headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, 14, doc.internal.pageSize.getHeight() - 10);

  doc.save('relatorio-pedidos.pdf');
}

export function exportOrdersReportXLSX(orders: Order[]) {
  const rows = orders.map((o) => ({
    'Número do Pedido': orderNumber(o.id),
    'Cliente': o.customerName,
    'Data': formatDate(o.createdAt),
    'Itens': o.items.reduce((q, i) => q + i.qty, 0),
    'Valor': o.total,
    'Status': STATUS_LABELS[o.status] || o.status,
    'Atualizado em': formatDate(o.updatedAt),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, 'relatorio-pedidos.xlsx');
}

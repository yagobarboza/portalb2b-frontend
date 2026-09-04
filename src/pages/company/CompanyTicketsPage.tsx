import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Send,
  Search,
  Briefcase,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  ArrowLeft,
  UserCog,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Ticket as TicketIcon,
  Building2,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileVideo,
  X,
  Download,
  Filter,
  Inbox,
} from 'lucide-react';
import { mockTickets, mockTeamMembers, mockCustomers } from '../../data/mock';
import { formatDateTime, formatDate } from '../../lib/format';
import type { Ticket, TicketMessage, Sector, TicketStatus, TicketPriority, TicketAttachment } from '../../types';
import { SECTORS, SECTOR_LABELS } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Textarea } from '../../components/ui/textarea';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const sectorIcons: Record<Sector, typeof TicketIcon> = {
  comercial: Briefcase,
  financeiro: CreditCard,
  suporte: LifeBuoy,
  garantia: ShieldCheck,
};

const statusConfig: Record<TicketStatus, { label: string; className: string; dot: string }> = {
  aberto: { label: 'Aberto', className: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  em_andamento: { label: 'Em Atendimento', className: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  aguardando_cliente: { label: 'Aguardando Cliente', className: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  resolvido: { label: 'Resolvido', className: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  fechado: { label: 'Fechado', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

const priorityConfig: Record<TicketPriority, string> = {
  baixa: 'bg-slate-100 text-slate-700 border-slate-200',
  média: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-200',
  urgente: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_ORDER: TicketStatus[] = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado'];

function attachmentIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return FileVideo;
  return FileText;
}

function AttachmentList({ attachments }: { attachments?: TicketAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((att) => {
        const Icon = attachmentIcon(att.type);
        return (
          <div key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium max-w-32 truncate">{att.name}</span>
            <a href={att.url} download={att.name} className="text-muted-foreground hover:text-foreground">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        );
      })}
    </div>
  );
}

function EmailThread({ ticket }: { ticket: Ticket }) {
  return (
    <div className="space-y-0">
      {ticket.messages.map((msg, idx) => (
        <div key={msg.id} className="border-b last:border-b-0">
          <div className="flex items-start gap-3 px-6 py-3.5 bg-muted/40">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${msg.authorRole === 'suporte' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'}`}>
              {msg.author.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-base">{msg.author}</span>
                <span className="text-xs text-muted-foreground">
                  {msg.authorRole === 'suporte' ? 'Equipe de Suporte' : 'Cliente'}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(msg.createdAt)}</span>
              </div>
              {idx === 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  De: {ticket.customerName} · Setor: {SECTOR_LABELS[ticket.sector]}
                </p>
              )}
              {idx > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">Em resposta ao ticket original</p>
              )}
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            <AttachmentList attachments={msg.attachments} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function CompanyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<TicketAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filterSector, setFilterSector] = useState<Sector | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TicketPriority | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = tickets.filter((t) => {
    const matchSector = filterSector === 'all' || t.sector === filterSector;
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchAssignee = filterAssignee === 'all' || (filterAssignee === 'unassigned' ? !t.assignedTo : t.assignedTo === filterAssignee);
    const matchCustomer = filterCustomer === 'all' || t.customerId === filterCustomer;
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    return matchSector && matchStatus && matchPriority && matchAssignee && matchCustomer && matchSearch;
  });

  const filesToAttachments = (files: FileList): TicketAttachment[] =>
    Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      type: f.type || 'application/octet-stream',
      url: URL.createObjectURL(f),
    }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setPendingFiles((prev) => [...prev, ...filesToAttachments(e.target.files!)]);
    }
    e.target.value = '';
  };

  const handleSend = () => {
    if ((!message.trim() && pendingFiles.length === 0) || !selected) return;
    const msg: TicketMessage = {
      id: `tm-${Date.now()}`,
      author: 'Maria Santos',
      authorRole: 'suporte',
      content: message.trim(),
      createdAt: new Date().toISOString(),
      attachments: pendingFiles.length ? pendingFiles : undefined,
    };
    setTickets((prev) =>
      prev.map((t) =>
        t.id === selected.id
          ? { ...t, messages: [...t.messages, msg], updatedAt: new Date().toISOString() }
          : t
      )
    );
    setSelected((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
    setMessage('');
    setPendingFiles([]);
    toast.success('Resposta enviada');
  };

  const updateStatus = (id: string, status: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    const labels: Record<TicketStatus, string> = {
      aberto: 'reaberto',
      em_andamento: 'em atendimento',
      aguardando_cliente: 'aguardando cliente',
      resolvido: 'resolvido',
      fechado: 'fechado',
    };
    toast.success(`Ticket marcado como ${labels[status]}`);
  };

  const assignTicket = (id: string, memberId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, assignedTo: memberId } : t))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, assignedTo: memberId } : prev));
    const member = mockTeamMembers.find((m) => m.id === memberId);
    toast.success(`Ticket atribuído a ${member?.name}`);
  };

  const transferSector = (id: string, sector: Sector) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, sector, updatedAt: new Date().toISOString() } : t))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, sector } : prev));
    toast.success(`Ticket transferido para ${SECTOR_LABELS[sector]}`);
  };

  const assignedMember = selected ? mockTeamMembers.find((m) => m.id === selected.assignedTo) : null;
  const customer = selected ? mockCustomers.find((c) => c.id === selected.customerId) : null;

  const clearFilters = () => {
    setFilterSector('all');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterAssignee('all');
    setFilterCustomer('all');
    setSearch('');
  };

  const hasActiveFilters =
    filterSector !== 'all' || filterStatus !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || filterCustomer !== 'all' || search !== '';

  // ── Detail View ──
  if (selected) {
    const SectorIcon = sectorIcons[selected.sector];
    return (
      <div className="max-w-5xl mx-auto">
        <div className="border rounded-t-lg bg-background">
          <div className="flex items-center gap-3 px-6 py-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-muted-foreground">#{selected.id.replace('ticket-', 'TKT-')}</span>
                <SectorIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-bold truncate">{selected.title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={statusConfig[selected.status].className}>{statusConfig[selected.status].label}</Badge>
                <Badge variant="outline" className={priorityConfig[selected.priority]}>
                  Prioridade: {selected.priority}
                </Badge>
                <Badge variant="secondary">{SECTOR_LABELS[selected.sector]}</Badge>
                {assignedMember && (
                  <Badge variant="outline" className="text-[10px]">
                    <UserCog className="w-3 h-3 mr-1" />
                    {assignedMember.name}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(selected.createdAt)}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Alterar status</p>
                <DropdownMenuItem onClick={() => updateStatus(selected.id, 'aberto')}>Aberto</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(selected.id, 'em_andamento')}>Em Atendimento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(selected.id, 'aguardando_cliente')}>Aguardando Cliente</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(selected.id, 'resolvido')}>Resolvido</DropdownMenuItem>
                {selected.status === 'fechado' ? (
                  <DropdownMenuItem onClick={() => updateStatus(selected.id, 'aberto')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reabrir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => updateStatus(selected.id, 'fechado')} className="text-destructive">
                    <XCircle className="w-4 h-4 mr-2" />
                    Encerrar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Transferir para</p>
                {SECTORS.filter((s) => s !== selected.sector).map((s) => {
                  const Icon = sectorIcons[s];
                  return (
                    <DropdownMenuItem key={s} onClick={() => transferSector(selected.id, s)}>
                      <Icon className="w-4 h-4 mr-2" />
                      {SECTOR_LABELS[s]}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Atribuir a</p>
                {mockTeamMembers.filter((m) => m.active).map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => assignTicket(selected.id, m.id)}>
                    <UserCog className="w-4 h-4 mr-2" />
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          <Card className="rounded-t-none border-t-0 flex flex-col h-[calc(100vh-20rem)]">
            <ScrollArea className="flex-1">
              <EmailThread ticket={selected} />
            </ScrollArea>

            {selected.status !== 'fechado' ? (
              <div className="border-t">
                {pendingFiles.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {pendingFiles.map((att) => {
                      const Icon = attachmentIcon(att.type);
                      return (
                        <div key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-medium max-w-32 truncate">{att.name}</span>
                          <button onClick={() => setPendingFiles((prev) => prev.filter((p) => p.id !== att.id))} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Paperclip className="w-4 h-4 mr-1.5" />
                      Anexar arquivo
                    </Button>
                    <Button onClick={handleSend} disabled={!message.trim() && pendingFiles.length === 0} size="sm">
                      <Send className="w-4 h-4 mr-1.5" />
                      Enviar resposta
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ticket encerrado</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => updateStatus(selected.id, 'aberto')}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reabrir
                </Button>
              </div>
            )}
          </Card>

          {customer && (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Informações do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.cnpj}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs">{customer.email}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs">{customer.phone}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs">{customer.city}/{customer.state}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status do cliente</p>
                  <Badge className={customer.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}>
                    {customer.status}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                  {assignedMember ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                        {assignedMember.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{assignedMember.name}</p>
                        <p className="text-[10px] text-muted-foreground">{assignedMember.role}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">Não atribuído</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── List View (Help Desk) ──
  return (
    <div>
      <PageHeading title="Central de Chamados" description="Gerencie solicitações e chamados de suporte dos clientes." />

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {STATUS_ORDER.map((status) => {
          const count = tickets.filter((t) => t.status === status).length;
          const cfg = statusConfig[status];
          return (
            <Card key={status} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}>
              <CardContent className={`p-4 ${filterStatus === status ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, assunto ou cliente..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TicketStatus | 'all')}>
              <SelectTrigger size="sm" className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as TicketPriority | 'all')}>
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="média">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSector} onValueChange={(v) => setFilterSector(v as Sector | 'all')}>
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger size="sm" className="w-full sm:w-44">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {mockTeamMembers.filter((m) => m.active).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
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
                <Filter className="w-3.5 h-3.5 mr-1.5" />Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhum chamado encontrado</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Ajuste os filtros para ver mais chamados
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Número</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Aberto em</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ticket) => {
                const assigned = mockTeamMembers.find((m) => m.id === ticket.assignedTo);
                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(ticket)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{ticket.id.replace('ticket-', 'TKT-')}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{ticket.description}</p>
                    </TableCell>
                    <TableCell className="text-sm">{ticket.customerName}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[ticket.status].className + ' text-[10px]'}>
                        {statusConfig[ticket.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityConfig[ticket.priority] + ' text-[10px]'}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {SECTOR_LABELS[ticket.sector]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {assigned ? (
                        <span className="flex items-center gap-1.5">
                          <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
                          {assigned.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(ticket.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(ticket.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs">{ticket.messages.length}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

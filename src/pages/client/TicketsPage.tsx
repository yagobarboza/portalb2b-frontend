import { useState, useRef } from 'react';
import { mockTickets } from '../../data/mock';
import type { Ticket, TicketPriority, Sector, TicketMessage, TicketAttachment } from '../../types';
import { SECTORS, SECTOR_LABELS } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Plus, TicketIcon, MessageCircle, ArrowLeft, Paperclip, Send, FileText, Image as ImageIcon, FileVideo, X, Download } from 'lucide-react';
import { formatDateTime, formatDate } from '../../lib/format';
import { toast } from 'sonner';

function priorityBadge(priority: TicketPriority) {
  const map: Record<TicketPriority, string> = {
    baixa: 'bg-slate-100 text-slate-700 border-slate-200',
    média: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    alta: 'bg-orange-100 text-orange-800 border-orange-200',
    urgente: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <Badge variant="outline" className={map[priority]}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-800 border-blue-200',
    em_andamento: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    aguardando_cliente: 'bg-violet-100 text-violet-800 border-violet-200',
    resolvido: 'bg-green-100 text-green-800 border-green-200',
    fechado: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const labels: Record<string, string> = {
    aberto: 'Aberto',
    em_andamento: 'Em Andamento',
    aguardando_cliente: 'Aguardando Cliente',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
  };
  return (
    <Badge variant="outline" className={map[status]}>
      {labels[status]}
    </Badge>
  );
}

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
      {/* First message = original email */}
      {ticket.messages.map((msg, idx) => (
        <div key={msg.id} className="border-b last:border-b-0">
          {/* Email header bar */}
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
                <p className="text-xs text-muted-foreground mt-0.5">Para: Suporte · Setor: {SECTOR_LABELS[ticket.sector]}</p>
              )}
              {idx > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">Em resposta ao ticket original</p>
              )}
            </div>
          </div>
          {/* Email body */}
          <div className="px-6 py-5">
            <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            <AttachmentList attachments={msg.attachments} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState(
    mockTickets.filter((t) => t.customerId === 'cust-1')
  );
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [pendingFiles, setPendingFiles] = useState<TicketAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const newTicketFileRef = useRef<HTMLInputElement>(null);
  const [newTicketFiles, setNewTicketFiles] = useState<TicketAttachment[]>([]);

  // New ticket form
  const [form, setForm] = useState({ title: '', description: '', priority: 'média' as TicketPriority, sector: 'suporte' as Sector });

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

  const handleNewTicketFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setNewTicketFiles((prev) => [...prev, ...filesToAttachments(e.target.files!)]);
    }
    e.target.value = '';
  };

  const handleCreate = () => {
    if (!form.title || !form.description) {
      toast.error('Preencha todos os campos');
      return;
    }
    const newTicket: Ticket = {
      id: `ticket-${Date.now()}`,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: 'aberto',
      sector: form.sector,
      customerId: 'cust-1',
      customerName: 'TechnoOffice Ltda',
      tenantId: 'tenant-1',
      messages: [{
        id: `tm-${Date.now()}`,
        author: 'João Silva',
        authorRole: 'cliente',
        content: form.description,
        createdAt: new Date().toISOString(),
        attachments: newTicketFiles.length ? newTicketFiles : undefined,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTickets((prev) => [newTicket, ...prev]);
    setShowNew(false);
    setForm({ title: '', description: '', priority: 'média', sector: 'suporte' });
    setNewTicketFiles([]);
    toast.success('Ticket criado com sucesso!');
  };

  const handleSendMessage = () => {
    if ((!newMsg.trim() && pendingFiles.length === 0) || !selected) return;
    const msg: TicketMessage = {
      id: `tm-${Date.now()}`,
      author: 'João Silva',
      authorRole: 'cliente',
      content: newMsg.trim(),
      createdAt: new Date().toISOString(),
      attachments: pendingFiles.length ? pendingFiles : undefined,
    };
    const updated = tickets.map((t) =>
      t.id === selected.id ? { ...t, messages: [...t.messages, msg], updatedAt: new Date().toISOString() } : t
    );
    setTickets(updated);
    setSelected((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
    setNewMsg('');
    setPendingFiles([]);
  };

  if (selected) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Email header */}
        <div className="border rounded-t-lg bg-background">
          <div className="flex items-center gap-3 px-6 py-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-muted-foreground">#{selected.id.replace('ticket-', 'TKT-')}</span>
              </div>
              <h1 className="text-xl font-bold truncate">{selected.title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {statusBadge(selected.status)}
                {priorityBadge(selected.priority)}
                <Badge variant="secondary" className="text-[10px]">{SECTOR_LABELS[selected.sector]}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(selected.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email thread */}
        <Card className="rounded-t-none border-t-0 flex flex-col h-[calc(100vh-20rem)]">
          <ScrollArea className="flex-1">
            <EmailThread ticket={selected} />
          </ScrollArea>

          {selected.status !== 'fechado' ? (
            <div className="border-t">
              {/* Pending attachments preview */}
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
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
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
                  <Button onClick={handleSendMessage} disabled={!newMsg.trim() && pendingFiles.length === 0} size="sm">
                    <Send className="w-4 h-4 mr-1.5" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">Este ticket está encerrado. Abra um novo ticket se precisar de mais ajuda.</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tickets de Suporte</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas solicitações de suporte</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TicketIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum ticket</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Crie um ticket para obter suporte</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelected(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">{ticket.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(ticket.status)}
                      {priorityBadge(ticket.priority)}
                      <Badge variant="secondary" className="text-[10px]">{SECTOR_LABELS[ticket.sector]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(ticket.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs">{ticket.messages.length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Ticket de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Descreva brevemente o problema"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select
                  value={form.sector}
                  onValueChange={(v) => setForm((f) => ({ ...f, sector: v as Sector }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TicketPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="média">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva o problema em detalhes..."
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Anexos</Label>
              <input ref={newTicketFileRef} type="file" multiple className="hidden" onChange={handleNewTicketFiles} />
              {newTicketFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {newTicketFiles.map((att) => {
                    const Icon = attachmentIcon(att.type);
                    return (
                      <div key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium max-w-32 truncate">{att.name}</span>
                        <button onClick={() => setNewTicketFiles((prev) => prev.filter((p) => p.id !== att.id))} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => newTicketFileRef.current?.click()}>
                <Paperclip className="w-4 h-4 mr-1.5" />
                Adicionar anexos
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

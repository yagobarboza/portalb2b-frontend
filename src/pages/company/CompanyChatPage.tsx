import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Send,
  Search,
  Briefcase,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  MessageCircle,
  Clock,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Building2,
  Mail,
  Phone,
  MapPin,
  UserCog,
} from 'lucide-react';
import { mockConversations, mockCustomers, mockTeamMembers } from '../../data/mock';
import { formatDateTime, formatDate } from '../../lib/format';
import type { ChatConversation, ChatMessage, Sector, ConversationStatus } from '../../types';
import { SECTORS, SECTOR_LABELS } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
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

const sectorIcons: Record<Sector, typeof MessageCircle> = {
  comercial: Briefcase,
  financeiro: CreditCard,
  suporte: LifeBuoy,
  garantia: ShieldCheck,
};

const statusConfig: Record<ConversationStatus, { label: string; className: string; dot: string }> = {
  aberta: { label: 'Aberta', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  encerrada: { label: 'Encerrada', className: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function CompanyChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [message, setMessage] = useState('');
  const [filterSector, setFilterSector] = useState<Sector | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ConversationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selected?.messages]);

  const filtered = conversations.filter((c) => {
    const matchSector = filterSector === 'all' || c.sector === filterSector;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchSearch =
      !search ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    return matchSector && matchStatus && matchSearch;
  });

  // Group filtered conversations by sector
  const grouped = SECTORS.map((sector) => ({
    sector,
    items: filtered.filter((c) => c.sector === sector),
  })).filter((g) => g.items.length > 0);

  const handleSend = () => {
    if (!message.trim() || !selected) return;
    const msg: ChatMessage = {
      id: `cm-${Date.now()}`,
      author: 'Maria Santos',
      authorRole: 'suporte',
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() }
          : c
      )
    );
    setSelected((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
    setMessage('');
  };

  const updateConversationStatus = (id: string, status: ConversationStatus) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    const labels: Record<ConversationStatus, string> = { aberta: 'reaberta', pendente: 'marcada como pendente', encerrada: 'encerrada' };
    toast.success(`Conversa ${labels[status]}`);
  };

  const transferSector = (id: string, sector: Sector) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, sector, updatedAt: new Date().toISOString() } : c))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, sector } : prev));
    toast.success(`Conversa transferida para ${SECTOR_LABELS[sector]}`);
  };

  const transferToMember = (id: string, memberId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, assignedTo: memberId, updatedAt: new Date().toISOString() } : c))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, assignedTo: memberId } : prev));
    const member = mockTeamMembers.find((m) => m.id === memberId);
    toast.success(`Conversa atribuída a ${member?.name}`);
  };

  const customer = selected ? mockCustomers.find((c) => c.id === selected.customerId) : null;
  const assignedMember = selected ? mockTeamMembers.find((m) => m.id === selected.assignedTo) : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 pt-4 pb-2">
        <PageHeading title="Chat de Atendimento" description="Atenda seus clientes em tempo real, organizado por setor." />
      </div>

      <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
        {/* Conversation List - always visible on desktop */}
        <div className={`${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[340px] flex-shrink-0`}>
          {/* Filters */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterSector} onValueChange={(v) => setFilterSector(v as Sector | 'all')}>
                <SelectTrigger size="sm" className="flex-1">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as ConversationStatus | 'all')}>
                <SelectTrigger size="sm" className="flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List grouped by sector */}
          <Card className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  grouped.map((group) => {
                    const SectorIcon = sectorIcons[group.sector];
                    return (
                      <div key={group.sector} className="mb-3">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 sticky top-0 bg-background">
                          <SectorIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {SECTOR_LABELS[group.sector]}
                          </span>
                          <span className="text-xs text-muted-foreground/60">({group.items.length})</span>
                        </div>
                        <div className="space-y-1">
                          {group.items.map((conv) => {
                            const lastMsg = conv.messages[conv.messages.length - 1];
                            const isSelected = selected?.id === conv.id;
                            return (
                              <button
                                key={conv.id}
                                onClick={() => {
                                  setSelected(conv);
                                  setMobileView('chat');
                                }}
                                className={`w-full rounded-lg p-3 text-left transition-colors border ${
                                  isSelected ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-muted'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                  }`}>
                                    <SectorIcon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-medium text-sm truncate">{conv.customerName}</span>
                                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                        {formatDate(conv.updatedAt)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{conv.subject}</p>
                                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                                      {lastMsg?.content}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[conv.status].dot}`} />
                                        <span className="text-[10px] text-muted-foreground">
                                          {statusConfig[conv.status].label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Chat Area */}
        {selected ? (
          <div className={`${mobileView === 'list' ? 'hidden' : 'flex'} flex-1 flex-col min-w-0`}>
            <Card className="flex flex-1 flex-col min-h-0">
              {/* Chat Header */}
              <div className="border-b px-4 py-3 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden -ml-1"
                  onClick={() => setMobileView('list')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const SectorIcon = sectorIcons[selected.sector];
                    return <SectorIcon className="w-5 h-5 text-primary-foreground" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selected.customerName}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {SECTOR_LABELS[selected.sector]}
                    </Badge>
                    <Badge variant="outline" className={statusConfig[selected.status].className + ' text-[10px]'}>
                      {statusConfig[selected.status].label}
                    </Badge>
                    {assignedMember && (
                      <Badge variant="outline" className="text-[10px]">
                        <UserCog className="w-3 h-3 mr-1" />
                        {assignedMember.name}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{selected.subject}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Transferir para setor</p>
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
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Atribuir a colaborador</p>
                    {mockTeamMembers.filter((m) => m.active).map((m) => (
                      <DropdownMenuItem key={m.id} onClick={() => transferToMember(selected.id, m.id)}>
                        <UserCog className="w-4 h-4 mr-2" />
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {selected.status !== 'encerrada' ? (
                      <DropdownMenuItem
                        onClick={() => updateConversationStatus(selected.id, 'encerrada')}
                        className="text-destructive"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Encerrar conversa
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => updateConversationStatus(selected.id, 'aberta')}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reabrir conversa
                      </DropdownMenuItem>
                    )}
                    {selected.status === 'aberta' && (
                      <DropdownMenuItem onClick={() => updateConversationStatus(selected.id, 'pendente')}>
                        <Clock className="w-4 h-4 mr-2" />
                        Marcar como pendente
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4" ref={scrollRef}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground px-2">
                      {formatDate(selected.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.authorRole === 'suporte' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className="max-w-[75%]">
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                            msg.authorRole === 'suporte'
                              ? 'bg-primary text-primary-foreground rounded-bl-sm'
                              : 'bg-muted text-foreground rounded-br-sm'
                          }`}
                        >
                          <p className="text-xs font-semibold mb-1 opacity-80">{msg.author}</p>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        <p className={`text-[10px] text-muted-foreground mt-1 ${msg.authorRole === 'suporte' ? '' : 'text-right'}`}>
                          {formatDateTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input */}
              {selected.status !== 'encerrada' ? (
                <div className="border-t p-3 flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  />
                  <Button onClick={handleSend} disabled={!message.trim()} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-t p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Conversa encerrada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => updateConversationStatus(selected.id, 'aberta')}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reabrir
                  </Button>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <Card className="w-full max-w-sm">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Escolha uma conversa na lista para começar o atendimento
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Customer Info Sidebar */}
        {selected && customer && (
          <div className="hidden xl:flex w-64 flex-shrink-0">
            <Card className="w-full">
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
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={customer.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}>
                    {customer.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Setor atual</p>
                  <Badge variant="secondary">{SECTOR_LABELS[selected.sector]}</Badge>
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
          </div>
        )}
      </div>
    </div>
  );
}

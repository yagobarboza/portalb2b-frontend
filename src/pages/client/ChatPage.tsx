import { useState, useRef, useEffect } from 'react';
import { mockConversations } from '../../data/mock';
import type { ChatConversation, ChatMessage, Sector } from '../../types';
import { SECTORS, SECTOR_LABELS } from '../../types';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  MessageCircle,
  Send,
  Plus,
  ArrowLeft,
  MessageSquare,
  Briefcase,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { formatDateTime, formatDate } from '../../lib/format';
import { toast } from 'sonner';

const sectorIcons: Record<Sector, typeof MessageCircle> = {
  comercial: Briefcase,
  financeiro: CreditCard,
  suporte: LifeBuoy,
  garantia: ShieldCheck,
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    aberta: { label: 'Aberta', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: MessageCircle },
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    encerrada: { label: 'Encerrada', className: 'bg-muted text-muted-foreground border-border', icon: XCircle },
  };
  const { label, className, icon: Icon } = map[status] ?? map.aberta;
  return (
    <Badge variant="outline" className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}

export default function ClientChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>(
    mockConversations.filter((c) => c.customerId === 'cust-1')
  );
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [subject, setSubject] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selected?.messages]);

  const handleSend = () => {
    if (!newMsg.trim() || !selected) return;
    const msg: ChatMessage = {
      id: `cm-${Date.now()}`,
      author: 'João Silva',
      authorRole: 'cliente',
      content: newMsg.trim(),
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
    setNewMsg('');

    // Simulate auto-response
    setTimeout(() => {
      const responses = [
        'Obrigado pelo contato! Vou verificar isso para você.',
        'Entendido! Nossa equipe está analisando sua solicitação.',
        'Claro! Posso ajudá-lo com isso. Aguarde um momento.',
        'Perfeito! Fique à vontade para nos contatar sempre que precisar.',
      ];
      const autoReply: ChatMessage = {
        id: `cm-${Date.now()}-auto`,
        author: 'Suporte TechMax',
        authorRole: 'suporte',
        content: responses[Math.floor(Math.random() * responses.length)],
        createdAt: new Date().toISOString(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, messages: [...c.messages, autoReply], updatedAt: new Date().toISOString() }
            : c
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, messages: [...prev.messages, autoReply] } : prev
      );
    }, 1200);
  };

  const handleCreateConversation = () => {
    if (!selectedSector || !subject.trim()) {
      toast.error('Selecione o setor e informe o assunto');
      return;
    }
    const newConv: ChatConversation = {
      id: `conv-${Date.now()}`,
      customerId: 'cust-1',
      customerName: 'TechnoOffice Ltda',
      sector: selectedSector,
      status: 'aberta',
      subject: subject.trim(),
      tenantId: 'tenant-1',
      messages: [
        {
          id: `cm-${Date.now()}`,
          author: 'João Silva',
          authorRole: 'cliente',
          content: `Olá! Preciso de atendimento do setor de ${SECTOR_LABELS[selectedSector]}. Assunto: ${subject.trim()}`,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setSelected(newConv);
    setShowNew(false);
    setSelectedSector(null);
    setSubject('');
    toast.success(`Conversa iniciada com o setor de ${SECTOR_LABELS[selectedSector]}`);
  };

  if (selected) {
    const SectorIcon = sectorIcons[selected.sector];
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <SectorIcon className="w-5 h-5 text-primary" />
              {selected.subject}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary">{SECTOR_LABELS[selected.sector]}</Badge>
              {statusBadge(selected.status)}
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          {/* Chat Header */}
          <div className="border-b px-4 py-3 flex items-center gap-3 bg-muted/30">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
              <SectorIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">{SECTOR_LABELS[selected.sector]} · TechMax</p>
              <p className="text-xs text-muted-foreground">
                Conversa iniciada em {formatDate(selected.createdAt)}
              </p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-[480px] px-4 py-4">
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
                  className={`flex ${msg.authorRole === 'cliente' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.authorRole === 'suporte' && (
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center mr-2 flex-shrink-0 self-end mb-1">
                      <span className="text-xs font-bold text-primary-foreground">S</span>
                    </div>
                  )}
                  <div className="max-w-[75%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        msg.authorRole === 'cliente'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-80">{msg.author}</p>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <p
                      className={`text-[10px] text-muted-foreground mt-1 ${
                        msg.authorRole === 'cliente' ? 'text-right' : ''
                      }`}
                    >
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                  {msg.authorRole === 'cliente' && (
                    <div className="w-7 h-7 bg-secondary rounded-full flex items-center justify-center ml-2 flex-shrink-0 self-end mb-1">
                      <span className="text-xs font-bold text-secondary-foreground">J</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          {selected.status !== 'encerrada' ? (
            <div className="border-t p-3 flex gap-2 bg-background">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!newMsg.trim()} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="border-t p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Esta conversa foi encerrada pela empresa.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Inicie uma nova conversa se precisar de mais ajuda.
              </p>
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
          <h1 className="text-3xl font-bold">Chat de Atendimento</h1>
          <p className="text-muted-foreground mt-1">
            Converse com os setores da TechMax
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Conversa
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma conversa</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Inicie uma nova conversa com um de nossos setores
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const SectorIcon = sectorIcons[conv.sector];
            const lastMsg = conv.messages[conv.messages.length - 1];
            return (
              <Card
                key={conv.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(conv)}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <SectorIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">{conv.subject}</h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {SECTOR_LABELS[conv.sector]}
                      </Badge>
                      {statusBadge(conv.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {lastMsg?.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(conv.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs">{conv.messages.length}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Conversation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium mb-3">Escolha o setor</p>
              <div className="grid grid-cols-2 gap-3">
                {SECTORS.map((sector) => {
                  const Icon = sectorIcons[sector];
                  return (
                    <button
                      key={sector}
                      onClick={() => setSelectedSector(sector)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        selectedSector === sector
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedSector === sector
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">{SECTOR_LABELS[sector]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Assunto</p>
              <Input
                placeholder="Descreva brevemente o assunto..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateConversation}>Iniciar Conversa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone, maskPhone } from '@/lib/phoneUtils';
import { cn, getSaoPauloTimestamp, formatDisplayTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Lead, LeadStatus, User } from '@/types/database';
import { Phone, Clock, Plus, Loader2, Trash2 } from 'lucide-react';
import type { User as UserType, LeadStatus as LeadStatusType } from '@/types/database';

const statusColors: Record<string, string> = {
  'Novos Leads': 'bg-slate-500/20 text-slate-400',
  'Qualificação': 'bg-yellow-500/20 text-yellow-400',
  'Apresentação': 'bg-blue-500/20 text-blue-400',
  'Follow-up': 'bg-orange-500/20 text-orange-400',
  'Negociação': 'bg-purple-500/20 text-purple-400',
  'Aguardar Pagamento': 'bg-pink-500/20 text-pink-400',
  'Produção': 'bg-indigo-500/20 text-indigo-400',
  'Pronto para Entrega': 'bg-teal-500/20 text-teal-400',
  'Vendido': 'bg-emerald-500/20 text-emerald-400',
  'Pós-Venda': 'bg-cyan-500/20 text-cyan-400',
  'Perdido': 'bg-red-500/20 text-red-500',
};

const statusLabels: Record<string, string> = {
  'Novos Leads': 'Novos Leads',
  'Qualificação': 'Qualificação',
  'Apresentação': 'Apresentação / Showroom',
  'Follow-up': 'Follow-up',
  'Negociação': 'Negociação / Orçamento',
  'Aguardar Pagamento': 'Aguardar Pagamento',
  'Produção': 'Produção / Ajustes',
  'Pronto para Entrega': 'Pronto para Entrega',
  'Vendido': 'Vendido / Entregue',
  'Pós-Venda': 'Pós-Venda (LTV)',
  'Perdido': 'Perdido',
};

const kanbanColumns: string[] = [
  'Novos Leads',
  'Qualificação',
  'Apresentação',
  'Follow-up',
  'Negociação',
  'Aguardar Pagamento',
  'Produção',
  'Pronto para Entrega',
  'Vendido',
  'Pós-Venda',
];

const columns = kanbanColumns.map(status => ({
  id: status,
  title: statusLabels[status],
  color: statusColors[status] || 'bg-gray-500/20 text-gray-400'
}));
const avatarColors = [
  'bg-primary',
  'bg-success',
  'bg-warning',
  'bg-destructive',
  'bg-purple-500',
];

interface LeadWithUser extends Lead {
  assigned_user?: { name: string } | null;
}

interface SortableLeadCardProps {
  lead: LeadWithUser;
  onEdit: (lead: LeadWithUser) => void;
}

function SortableLeadCard({ lead, onEdit }: SortableLeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <LeadCard lead={lead} onEdit={onEdit} />
    </div>
  );
}

function LeadCard({ lead, onEdit }: { lead: LeadWithUser; onEdit: (lead: LeadWithUser) => void }) {
  const { role } = useAuth();

  const getAvatarColor = (name: string) => {
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatRelativeTime = (timestamp: string) => {
    return formatDisplayTime(timestamp, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone: string) => {
    if (role !== 'admin') {
      return maskPhone(phone);
    }

    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only open edit if not dragging
    if (e.detail === 1) {
      setTimeout(() => onEdit(lead), 200);
    }
  };

  return (
    <Card
      className="mb-3 border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className={cn('h-10 w-10', getAvatarColor(lead.name))}>
            <AvatarFallback className="text-primary-foreground text-sm font-medium">
              {getInitials(lead.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium truncate">{lead.name}</p>
              {lead.assigned_user && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className={cn('h-6 w-6 flex-shrink-0', getAvatarColor(lead.assigned_user.name))}>
                      <AvatarFallback className="text-primary-foreground text-[10px] font-medium">
                        {getInitials(lead.assigned_user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Responsável: {lead.assigned_user.name}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Phone className="h-3 w-3" />
              <span className="truncate">{formatPhone(lead.phone)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(lead.created_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function DroppableColumn({ id, children, className }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {children}
    </div>
  );
}

export default function Kanban() {
  const { user, role } = useAuth();
  const [leads, setLeads] = useState<LeadWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);

  // New lead modal state
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadSource, setNewLeadSource] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState<LeadStatusType>('novo');
  const [newLeadAssignedTo, setNewLeadAssignedTo] = useState<string>('');
  const [creatingLead, setCreatingLead] = useState(false);

  // Edit lead modal state
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithUser | null>(null);
  const [editLeadName, setEditLeadName] = useState('');
  const [editLeadPhone, setEditLeadPhone] = useState('');
  const [editLeadSource, setEditLeadSource] = useState('');
  const [editLeadStatus, setEditLeadStatus] = useState<LeadStatusType>('novo');
  const [editLeadAssignedTo, setEditLeadAssignedTo] = useState<string>('');
  const [editLeadNotes, setEditLeadNotes] = useState<string>('');
  const [savingLead, setSavingLead] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchLeads = useCallback(async () => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('kanban_position', { ascending: true });

    // FILTRO REMOVIDO: Deixar o RLS do banco decidir.
    // Isso resolve o problema de leads sumindo se o frontend falhar na checagem de role.
    // if (role !== 'admin' && user) {
    //   query = query.eq('assigned_to', user.id);
    // }

    const { data, error } = await query;

    if (!error && data) {
      const leadsData = data as Lead[];
      const userIds = [...new Set(leadsData.map(l => l.assigned_to).filter(Boolean))];

      let usersMap: Record<string, { name: string }> = {};

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('app_profiles')
          .select('id, name')
          .in('id', userIds);

        if (usersData) {
          usersMap = usersData.reduce((acc, u) => {
            acc[u.id] = { name: u.name };
            return acc;
          }, {} as Record<string, { name: string }>);
        }
      }

      const leadsWithUsers: LeadWithUser[] = leadsData.map(lead => ({
        ...lead,
        assigned_user: lead.assigned_to ? usersMap[lead.assigned_to] || null : null,
      }));

      setLeads(leadsWithUsers);
    }
    setLoading(false);
  }, [role, user]);

  const fetchUsers = useCallback(async () => {
    if (role !== 'admin') return;
    const { data } = await supabase.from('app_profiles').select('*');
    if (data) setUsers(data as UserType[]);
  }, [role]);

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, [fetchLeads, fetchUsers]);

  const handleCreateLead = async () => {
    if (!newLeadName || !newLeadPhone) {
      toast.error('Preencha nome e telefone');
      return;
    }

    // Use centralized normalization to enforce 9th digit and standard format
    const phone = normalizePhone(newLeadPhone);

    if (!phone) {
      toast.error('Telefone inválido');
      return;
    }

    setCreatingLead(true);
    try {
      // PROACTIVE DUPLICATE CHECK (Secure RPC)
      const { data: checkData, error: checkError } = await supabase
        .rpc('check_lead_status', { phone_number: phone });

      if (checkError) throw checkError;

      const result = checkData as { exists: boolean; lead_id?: string; assigned_to_name?: string };

      if (result.exists) {
        toast.error(`Telefone já cadastrado! Cliente: ${result.assigned_to_name}`);
        setCreatingLead(false);
        return;
      }

      const { error } = await supabase.from('leads').insert([{
        name: newLeadName,
        phone,
        source: newLeadSource || null, // Add source
        status: newLeadStatus,
        assigned_to: newLeadAssignedTo && newLeadAssignedTo !== 'none' ? newLeadAssignedTo : (role === 'admin' ? null : user?.id),
      }] as never);

      if (error) throw error;

      toast.success('Lead criado com sucesso!');
      setNewLeadOpen(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadSource(''); // Reset source
      setNewLeadStatus('novo');
      setNewLeadAssignedTo('');
      fetchLeads();
      fetchLeads();
    } catch (error) {
      toast.error('Erro ao criar lead');
      console.error(error);
    }
    setCreatingLead(false);
  };

  const handleEditLead = (lead: LeadWithUser) => {
    setEditingLead(lead);
    setEditLeadName(lead.name);
    setEditLeadPhone(lead.phone);
    setEditLeadSource(lead.source || ''); // Populate source
    setEditLeadStatus(lead.status as LeadStatusType);
    setEditLeadAssignedTo(lead.assigned_to || 'none');
    setEditLeadNotes(lead.notes || '');
    setEditLeadOpen(true);
  };

  const handleSaveLead = async () => {
    if (!editingLead || !editLeadName || !editLeadPhone) {
      toast.error('Preencha nome e telefone');
      return;
    }

    let phone = editLeadPhone.replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length <= 11) {
      phone = '55' + phone;
    }

    setSavingLead(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          name: editLeadName,
          phone,
          source: editLeadSource || null, // Update source
          status: editLeadStatus,
          assigned_to: editLeadAssignedTo && editLeadAssignedTo !== 'none' ? editLeadAssignedTo : null,
          notes: editLeadNotes || null,
          updated_at: getSaoPauloTimestamp(),
        } as never)
        .eq('id', editingLead.id);

      if (error) throw error;

      toast.success('Lead atualizado!');
      setEditLeadOpen(false);
      setEditingLead(null);
      fetchLeads();
    } catch (error) {
      toast.error('Erro ao atualizar lead');
      console.error(error);
    }
    setSavingLead(false);
  };

  const handleDeleteLead = async () => {
    if (!editingLead) return;
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    setDeletingLead(true);
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', editingLead.id);

      if (error) throw error;

      toast.success('Lead excluído!');
      setEditLeadOpen(false);
      setEditingLead(null);
      fetchLeads();
    } catch (error) {
      toast.error('Erro ao excluir lead');
      console.error(error);
    }
    setDeletingLead(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overId = over.id as string;

    // Find if dropped on a column
    const targetColumn = columns.find((col) => col.id === overId);
    const activeLead = leads.find((lead) => lead.id === activeIdStr);

    if (!activeLead) return;

    if (targetColumn) {
      // Dropped on column
      if (activeLead.status !== targetColumn.id) {
        const updatedLeads = leads.map((lead) =>
          lead.id === activeIdStr ? { ...lead, status: targetColumn.id } : lead
        );
        setLeads(updatedLeads);

        const { error } = await supabase
          .from('leads')
          .update({
            status: targetColumn.id,
            updated_at: getSaoPauloTimestamp(),
          } as never)
          .eq('id', activeIdStr);

        if (error) {
          toast.error('Erro ao atualizar status');
          fetchLeads();
        } else {
          toast.success('Status atualizado');
        }
      }
    } else {
      // Dropped on another card
      const overLead = leads.find((lead) => lead.id === overId);
      if (overLead && activeLead.status !== overLead.status) {
        const updatedLeads = leads.map((lead) =>
          lead.id === activeIdStr ? { ...lead, status: overLead.status } : lead
        );
        setLeads(updatedLeads);

        const { error } = await supabase
          .from('leads')
          .update({
            status: overLead.status,
            updated_at: getSaoPauloTimestamp(),
          } as never)
          .eq('id', activeIdStr);

        if (error) {
          toast.error('Erro ao atualizar status');
          fetchLeads();
        } else {
          toast.success('Status atualizado');
        }
      }
    }
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const activeLead = activeId ? leads.find((lead) => lead.id === activeId) : null;

  return (
    <div className="h-full flex flex-col p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Kanban</h1>
          <p className="text-muted-foreground">Gerencie seus leads visualmente</p>
        </div>
        <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
              <DialogDescription>Adicione um novo lead ao sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="Nome do lead"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newLeadStatus} onValueChange={(v) => setNewLeadStatus(v as LeadStatusType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {role === 'admin' && (
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select value={newLeadAssignedTo} onValueChange={setNewLeadAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewLeadOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateLead} disabled={creatingLead}>
                {creatingLead ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Lead'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Lead Modal */}
      <Dialog open={editLeadOpen} onOpenChange={setEditLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>Atualize as informações do lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={editLeadName}
                onChange={(e) => setEditLeadName(e.target.value)}
                placeholder="Nome do lead"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input
                value={editLeadPhone}
                onChange={(e) => setEditLeadPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                disabled={role !== 'admin'}
              />
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input
                value={editLeadSource}
                onChange={(e) => setEditLeadSource(e.target.value)}
                placeholder="Ex: Facebook, Instagram, Google"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editLeadStatus} onValueChange={(v) => setEditLeadStatus(v as LeadStatusType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === 'admin' && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={editLeadAssignedTo} onValueChange={setEditLeadAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <textarea
                value={editLeadNotes}
                onChange={(e) => setEditLeadNotes(e.target.value)}
                placeholder="Notas sobre o cliente..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {role === 'admin' && (
              <Button
                variant="destructive"
                onClick={handleDeleteLead}
                disabled={deletingLead}
              >
                {deletingLead ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditLeadOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveLead} disabled={savingLead}>
                {savingLead ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full">
            {columns.map((column) => {
              const columnLeads = getLeadsByStatus(column.id);
              return (
                <DroppableColumn
                  key={column.id}
                  id={column.id}
                  className={cn(
                    'w-72 flex-shrink-0 rounded-xl border p-4 flex flex-col transition-all',
                    column.color
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{column.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {columnLeads.length}
                    </Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-thin min-h-[200px]">
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-24 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : columnLeads.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        Nenhum lead nesta coluna
                      </div>
                    ) : (
                      <SortableContext
                        items={columnLeads.map((lead) => lead.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {columnLeads.map((lead) => (
                          <SortableLeadCard key={lead.id} lead={lead} onEdit={handleEditLead} />
                        ))}
                      </SortableContext>
                    )}
                  </div>
                </DroppableColumn>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} onEdit={() => { }} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

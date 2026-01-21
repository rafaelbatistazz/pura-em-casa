import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Calendar as CalendarIcon,
    Trash2,
    MessageSquare,
    UserCog,
    Save,
    Loader2,
    Phone,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskPhone, normalizePhone } from '@/lib/phoneUtils';
import type { Lead, User, LeadStatus, Instance } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { statusColors, statusLabels, getInitials, avatarColors } from '@/pages/Conversas'; // We'll need to export these from Conversas or move to utils
import { useAuth } from '@/contexts/AuthContext';

// For simplicity, we might need these props
interface ClientDetailsSheetProps {
    lead: Lead | null; // LeadWithMessages
    isOpen: boolean;
    onClose: () => void;
    onUpdateLead: (updates: Partial<Lead>) => Promise<void>;
    onDeleteLead: () => Promise<void>;
    onClearHistory: () => Promise<void>;
    allUsers: User[];
    role: 'admin' | 'user' | 'master';
}

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ClientDetailsSheet({
    lead,
    isOpen,
    onClose,
    onUpdateLead,
    onDeleteLead,
    onClearHistory,
    allUsers,
    role
}: ClientDetailsSheetProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<LeadStatus>('novo');
    const [assignedTo, setAssignedTo] = useState<string>('none');
    const [cleaningDate, setCleaningDate] = useState<Date | undefined>(undefined);
    const [budget, setBudget] = useState<string>('');
    const [instanceName, setInstanceName] = useState<string>('default');
    const [instances, setInstances] = useState<Instance[]>([]);

    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | null>(null);

    useEffect(() => {
        if (lead && isOpen) {
            setName(lead.name);

            // Should Unmask?
            // User can unmask if:
            // 1. Role is admin
            // 2. Lead is assigned to them
            const isAssignedToMe = lead.assigned_to === user?.id;
            const shouldUnmask = role === 'admin' || isAssignedToMe;

            setPhone(shouldUnmask ? normalizePhone(lead.phone) : maskPhone(lead.phone));

            setNotes(lead.notes || '');
            setStatus(lead.status);
            setAssignedTo(lead.assigned_to || 'none');
            setCleaningDate(lead.cleaning_date ? new Date(lead.cleaning_date) : undefined);
            setBudget(lead.budget ? lead.budget.toString() : '');
            setInstanceName(lead.instance_name || 'default');
        }
    }, [lead, isOpen, user, role]);

    useEffect(() => {
        if (isOpen && role === 'admin') {
            const fetchInstances = async () => {
                const { data } = await supabase.from('instances').select('*').eq('status', 'connected');
                if (data) setInstances(data as Instance[]);
            };
            fetchInstances();
        }
    }, [isOpen, role]);

    const handleSave = async () => {
        setLoading(true);

        try {
            // Sanitize phone: remove non-digits, ensure 55 prefix
            const cleanPhone = phone.replace(/\D/g, '');
            const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

            // Existing DB seems to use @s.whatsapp.net suffix
            const phoneToSave = finalPhone.includes('@s.whatsapp.net') ? finalPhone : `${finalPhone}@s.whatsapp.net`;

            const budgetValue = budget ? parseFloat(budget.replace(',', '.')) : null;

            await onUpdateLead({
                name,
                phone: phoneToSave,
                status,
                assigned_to: assignedTo === 'none' ? null : assignedTo,
                cleaning_date: cleaningDate ? cleaningDate.toISOString() : null,
                budget: budgetValue,
                notes,
                instance_name: instanceName === 'default' ? null : instanceName
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const triggerConfirm = (action: 'clear' | 'delete') => {
        setConfirmAction(action);
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        setConfirmOpen(false);
        if (confirmAction === 'clear') {
            await onClearHistory();
        } else if (confirmAction === 'delete') {
            await onDeleteLead();
        }
        setConfirmAction(null);
    };

    const getAvatarColor = (name: string) => {
        const index = name.charCodeAt(0) % avatarColors.length;
        return avatarColors[index];
    };

    if (!lead) return null;

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-gradient-to-b from-background to-muted/20">
                    {/* Custom Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-2 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span className="sr-only">Fechar</span>
                    </button>

                    <SheetHeader className="mb-8 pr-12">
                        <SheetTitle className="text-2xl font-semibold">Detalhes do Cliente</SheetTitle>
                        <SheetDescription className="text-sm text-muted-foreground">
                            Gerencie as informações e status deste lead.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6 pb-6">
                        {/* Profile Section */}
                        <div className="flex flex-col items-center justify-center gap-4 pb-6 border-b">
                            <Avatar className={cn('h-20 w-20 ring-4 ring-background shadow-lg', getAvatarColor(lead.name))}>
                                <AvatarFallback className="text-2xl font-semibold text-white">
                                    {getInitials(lead.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center w-full space-y-2">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-center font-semibold text-lg border-0 bg-transparent hover:bg-accent/50 focus:bg-accent transition-colors h-10 px-3 rounded-lg"
                                    placeholder="Nome do cliente"
                                />
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="text-center text-muted-foreground text-sm border-0 bg-transparent hover:bg-accent/50 focus:bg-accent transition-colors h-9 px-3 rounded-lg"
                                    placeholder="Telefone"
                                />
                            </div>
                        </div>

                        {/* Status & Assignment */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                                <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                                    <SelectTrigger className="h-11 bg-card hover:bg-accent/50 transition-colors">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(statusLabels).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn('w-2 h-2 rounded-full', statusColors[key]?.split(' ')[0] || 'bg-slate-500')} />
                                                    {label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</Label>
                                {role === 'admin' ? (
                                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                                        <SelectTrigger className="h-11 bg-card hover:bg-accent/50 transition-colors">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Não atribuído</SelectItem>
                                            {allUsers.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="h-11 flex items-center px-3 text-sm rounded-md bg-card text-muted-foreground truncate border">
                                        {allUsers.find(u => u.id === assignedTo)?.name || 'Não atribuído'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instance & Date */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WhatsApp Conexão</Label>
                                {role === 'admin' ? (
                                    <Select value={instanceName} onValueChange={setInstanceName}>
                                        <SelectTrigger className="h-11 bg-card hover:bg-accent/50 transition-colors">
                                            <SelectValue placeholder="Padrão" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Automático (Padrão)</SelectItem>
                                            {instances.map(inst => (
                                                <SelectItem key={inst.id} value={inst.instance_name}>
                                                    {inst.instance_name} ({inst.provider === 'meta' ? 'Meta' : 'API'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="h-11 flex items-center px-3 text-sm rounded-md bg-card text-muted-foreground truncate border">
                                        {instanceName === 'default' ? 'Automático (Padrão)' : instanceName}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data da Limpeza</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full h-11 justify-start text-left font-normal bg-card hover:bg-accent/50 transition-colors",
                                                !cleaningDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {cleaningDate ? format(cleaningDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={cleaningDate}
                                            onSelect={setCleaningDate}
                                            initialFocus
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Budget */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Orçamento (R$)</Label>
                            <Input
                                type="number"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                placeholder="0.00"
                                className="h-11 bg-card hover:bg-accent/50 focus:bg-accent transition-colors"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Digite observações importantes..."
                                rows={5}
                                className="resize-none bg-card hover:bg-accent/50 focus:bg-accent transition-colors"
                            />
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>

                        {/* Danger Zone */}
                        {role === 'admin' && (
                            <div className="pt-6 border-t space-y-3">
                                <Label className="text-xs font-semibold text-destructive uppercase tracking-wide">Zona de Perigo</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-10 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 transition-colors"
                                        onClick={() => triggerConfirm('clear')}
                                    >
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Limpar Chat
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-10 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 transition-colors"
                                        onClick={() => triggerConfirm('delete')}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir Lead
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Confirmation Dialog - Rendered outside Sheet logic */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmAction === 'clear' ? 'Limpar Histórico?' : 'Excluir Cliente?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction === 'clear'
                                ? 'Esta ação apagará todas as mensagens desta conversa. Isso não pode ser desfeito.'
                                : 'Esta ação excluirá o cliente e todo o histórico de mensagens permanentemente.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            className={cn(confirmAction === 'delete' ? 'bg-destructive hover:bg-destructive/90' : 'bg-orange-500 hover:bg-orange-600')}
                        >
                            {confirmAction === 'clear' ? 'Confirmar Limpeza' : 'Confirmar Exclusão'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

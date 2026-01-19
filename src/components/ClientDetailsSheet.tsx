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
import type { Lead, User, LeadStatus } from '@/types/database';
import { statusColors, statusLabels, getInitials, avatarColors } from '@/pages/Conversas'; // We'll need to export these from Conversas or move to utils

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

    const [loading, setLoading] = useState(false);

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | null>(null);

    useEffect(() => {
        if (lead && isOpen) {
            setName(lead.name);
            const rawPhone = lead.phone.replace('@s.whatsapp.net', '');
            const formatted = rawPhone.replace(/^(\d{2})(\d{2})(\d{5})(\d{4}).*/, '+$1 ($2) $3-$4').replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3'); // Simple mask attempt, usually 55+
            // Better: remove 55 if present, then mask
            const clean = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;
            const mask = clean.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
            setPhone(mask);
            setNotes(lead.notes || '');
            setStatus(lead.status);
            setAssignedTo(lead.assigned_to || 'none');
            setCleaningDate(lead.cleaning_date ? new Date(lead.cleaning_date) : undefined);
            setBudget(lead.budget ? String(lead.budget) : '');
        }
    }, [lead, isOpen]);

    if (!lead) return null;

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
                notes: notes || null,
                status,
                assigned_to: assignedTo === 'none' ? null : assignedTo,
                cleaning_date: cleaningDate ? cleaningDate.toISOString() : null,
                budget: budgetValue
            });
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

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Detalhes do Cliente</SheetTitle>
                        <SheetDescription>Gerencie as informações e status deste lead.</SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6">
                        {/* Profile Section */}
                        <div className="flex flex-col items-center justify-center gap-3 mb-6">
                            <Avatar className={cn('h-24 w-24', getAvatarColor(lead.name))}>
                                <AvatarFallback className="text-2xl text-white">
                                    {getInitials(lead.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center w-full space-y-2">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-center font-medium text-lg border-transparent hover:border-border focus:border-primary transition-colors h-10"
                                />
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="text-center text-muted-foreground text-sm border-transparent hover:border-border focus:border-primary transition-colors h-8"
                                />
                            </div>
                        </div>

                        {/* Status & Assignment */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                                    <SelectTrigger>
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
                                <Label>Responsável</Label>
                                {role === 'admin' ? (
                                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                                        <SelectTrigger>
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
                                    <div className="text-sm border rounded-md p-2 bg-secondary text-muted-foreground truncate">
                                        {allUsers.find(u => u.id === assignedTo)?.name || 'Não atribuído'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Date Picker */}
                        <div className="space-y-2">
                            <Label>Data da Limpeza</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
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

                        {/* Budget */}
                        <div className="space-y-2">
                            <Label>Orçamento (R$)</Label>
                            <Input
                                type="number"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Digite observações importantes..."
                                rows={5}
                            />
                        </div>

                        <Button onClick={handleSave} disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>

                        {/* Danger Zone */}
                        {role === 'admin' && (
                            <div className="pt-6 border-t space-y-3">
                                <Label className="text-destructive">Zona de Perigo</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                        onClick={() => triggerConfirm('clear')}
                                    >
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Limpar Chat
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

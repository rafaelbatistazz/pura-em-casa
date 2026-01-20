import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, MessageSquare, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import type { WhatsAppTemplate } from '@/types/database';

export default function Templates() {
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchTemplates = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_templates' as any)
                .select('*')
                .order('name');

            if (error) throw error;
            setTemplates((data as any) || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
            toast.error('Erro ao carregar templates');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('sync-templates');

            if (error) throw error;

            if (data.error) {
                throw new Error(data.error);
            }

            toast.success(data.message || 'Templates sincronizados com sucesso!');
            fetchTemplates();
        } catch (error: any) {
            console.error('Sync error:', error);
            toast.error(error.message || 'Erro ao sincronizar templates');
        } finally {
            setSyncing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'default'; // primary/black
            case 'REJECTED': return 'destructive';
            case 'PENDING': return 'secondary';
            case 'PAUSED': return 'warning'; // warning isn't standard in Badge, use secondary or custom class
            default: return 'outline';
        }
    };

    const statusMap: Record<string, string> = {
        APPROVED: 'Aprovado',
        REJECTED: 'Rejeitado',
        PENDING: 'Pendente',
        PAUSED: 'Pausado',
        DISABLED: 'Desativado'
    };

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                            <MessageSquare className="h-8 w-8 text-primary" />
                            Templates WhatsApp
                        </h1>
                        <p className="text-muted-foreground">
                            Gerencie seus modelos de mensagem da Meta (WhatsApp Business API)
                        </p>
                    </div>
                    <Button onClick={handleSync} disabled={syncing}>
                        {syncing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sincronizar com Meta
                            </>
                        )}
                    </Button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="animate-pulse">
                                <CardHeader className="h-24 bg-secondary/50" />
                                <CardContent className="h-32" />
                            </Card>
                        ))}
                    </div>
                ) : templates.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 rounded-full bg-secondary mb-4">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium text-lg mb-2">Nenhum template encontrado</h3>
                            <p className="text-muted-foreground max-w-sm mb-6">
                                Clique em "Sincronizar" para importar os templates da sua conta Meta Business.
                            </p>
                            <Button onClick={handleSync} disabled={syncing}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sincronizar Agora
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template) => (
                            <Card key={template.meta_id || template.id} className="flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-base font-semibold truncate" title={template.name}>
                                            {template.name}
                                        </CardTitle>
                                        <Badge variant={getStatusColor(template.status) as any}>
                                            {statusMap[template.status] || template.status}
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-2 text-xs">
                                        <span className="uppercase bg-secondary px-1.5 py-0.5 rounded text-foreground font-medium">
                                            {template.language}
                                        </span>
                                        <span className="capitalize">{template.category?.toLowerCase().replace('_', ' ')}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 text-sm bg-secondary/10 pt-4 border-t">
                                    <div className="space-y-2">
                                        {/* Try to find BODY component */}
                                        {template.components && Array.isArray(template.components) && (
                                            <>
                                                {template.components.find((c: any) => c.type === 'HEADER') && (
                                                    <p className="font-bold text-xs text-muted-foreground">
                                                        {template.components.find((c: any) => c.type === 'HEADER').text || '[Mídia Header]'}
                                                    </p>
                                                )}
                                                <p className="whitespace-pre-wrap line-clamp-4 text-muted-foreground">
                                                    {template.components.find((c: any) => c.type === 'BODY')?.text || 'Sem texto'}
                                                </p>
                                                {template.components.find((c: any) => c.type === 'FOOTER') && (
                                                    <p className="text-xs text-muted-foreground/70 mt-2">
                                                        {template.components.find((c: any) => c.type === 'FOOTER').text}
                                                    </p>
                                                )}
                                                {template.components.find((c: any) => c.type === 'BUTTONS') && (
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {template.components.find((c: any) => c.type === 'BUTTONS').buttons.map((b: any, idx: number) => (
                                                            <Badge key={idx} variant="outline" className="text-[10px]">
                                                                {b.text}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

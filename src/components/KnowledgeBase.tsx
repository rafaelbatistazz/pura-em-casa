
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Upload, FileText, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Document_ { // "Document" is a global type
    id: string;
    created_at: string;
    content: string;
    metadata: { filename: string };
}

export function KnowledgeBase() {
    const [documents, setDocuments] = useState<Document_[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            // We can't select * easily because 'embedding' is large and hidden by default maybe? 
            // Actually vector extension hides it or shows it as string.
            // We just need metadata.
            const { data, error } = await supabase
                .from('documents')
                .select('id, created_at, content, metadata') // Don't fetch embedding for UI
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments((data as unknown as Document_[]) || []);
        } catch (error) {
            console.error('Error fetching docs:', error);
            toast.error('Erro ao carregar documentos.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const text = await file.text(); // Simple text extraction

            if (text.length < 10) {
                throw new Error("Arquivo muito pequeno ou vazio.");
            }

            const { data, error } = await supabase.functions.invoke('embed-documents', {
                body: { text, filename: file.name }
            });

            if (error) throw error;

            toast.success(`Documento processado! ${data.chunks} fragmentos gerados.`);
            fetchDocuments();

            // Reset input
            e.target.value = '';
        } catch (error: any) {
            console.error('Upload Error:', error);
            toast.error('Erro ao processar documento: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Isso apaga o conhecimento da IA sobre este arquivo.')) return;

        try {
            const { error } = await supabase.from('documents').delete().eq('id', id);
            if (error) throw error;
            toast.success('Documento removido.');
            setDocuments(docs => docs.filter(d => d.id !== id));
        } catch (error) {
            toast.error('Erro ao apagar.');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Base de Conhecimento (RAG)
                </CardTitle>
                <CardDescription>
                    Adicione textos e manuais para a IA consultar quando não souber a resposta.
                    Arquivos suportados: .txt, .md, .csv (PDF em breve).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Upload Area */}
                <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center gap-2">
                        {uploading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : (
                            <Upload className="h-8 w-8 text-muted-foreground" />
                        )}
                        <div className="text-sm font-medium">
                            {uploading ? "Processando e gerando fragmentos..." : "Clique para selecionar um arquivo"}
                        </div>
                        {!uploading && (
                            <Input
                                type="file"
                                accept=".txt,.md,.csv,.json"
                                className="max-w-xs cursor-pointer opacity-0 absolute w-full h-full inset-0"
                                onChange={handleFileUpload}
                            />
                        )}
                    </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Documentos Ativos</h3>

                    {loading ? (
                        <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-md">
                            Nenhum documento na base de conhecimento.
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/20">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-primary/10 rounded text-primary">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{doc.metadata?.filename || 'Sem Nome'}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                Adicionado em: {new Date(doc.created_at).toLocaleDateString()} • {doc.content?.substring(0, 30)}...
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(doc.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}

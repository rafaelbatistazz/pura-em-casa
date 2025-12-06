import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getSaoPauloTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Wifi,
  WifiOff,
  QrCode,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  Key,
  User,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Webhook,
  TestTube,
  Command,
  LogOut,
} from 'lucide-react';
import type { User as UserType, UserRole, SystemConfig, MessageShortcut, LeadDistribution, LeadDistributionConfig } from '@/types/database';

export default function Config() {
  const { user, userData, updatePassword, role, signOut } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [loading, setLoading] = useState(true);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  // Shortcuts
  const [shortcuts, setShortcuts] = useState<MessageShortcut[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newShortcutOpen, setNewShortcutOpen] = useState(false);
  const [newShortcutTrigger, setNewShortcutTrigger] = useState('');
  const [newShortcutContent, setNewShortcutContent] = useState('');
  const [savingShortcut, setSavingShortcut] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<MessageShortcut | null>(null);

  // New user form
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [creatingUser, setCreatingUser] = useState(false);

  // Password change
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit Evolution credentials
  const [editCredentialsOpen, setEditCredentialsOpen] = useState(false);
  const [editApiUrl, setEditApiUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editInstanceName, setEditInstanceName] = useState('');
  const [editInstancePhone, setEditInstancePhone] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Lead Distribution
  const [leadDistributionEnabled, setLeadDistributionEnabled] = useState(false);
  const [distributionConfigId, setDistributionConfigId] = useState<string>('');
  const [distributionUsers, setDistributionUsers] = useState<LeadDistribution[]>([]);

  // Webhooks
  const [webhookIncoming, setWebhookIncoming] = useState('');
  const [webhookOutgoing, setWebhookOutgoing] = useState('');
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as UserType[]);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    }
  }, []);

  const [inviteFallbackOpen, setInviteFallbackOpen] = useState(false);

  /* Handlers de Gerenciamento de Usuários (Simplificado e Direto) */
  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setCreatingUser(true);
    try {
      // TRUQUE DO "CLIENTE TEMPORÁRIO":
      // Criamos uma instância isolada do Supabase para criar o usuário SEM deslogar o admin.
      // Isso elimina a necessidade de Edge Functions.
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false, // IMPORTANTE: Não salva sessão, não desloga o admin
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      // 1. Criar o usuário no Auth
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            name: newUserName // Passa o metadata para o trigger usar
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário (sem dados retornados)');

      const newUserId = authData.user.id;

      // 2. Atualizar o Role (se for admin)
      // O trigger já criou o usuário como 'user' (ou 'admin' se for o primeiro).
      // Agora garantimos o role escolhido.
      if (newUserRole) {
        // Aguardamos um pouco para garantir que o trigger rodou
        await new Promise(r => setTimeout(r, 1000));

        const { error: updateError } = await supabase
          .from('app_profiles')
          .update({ role: newUserRole })
          .eq('id', newUserId);

        if (updateError) {
          console.warn('Erro ao atualizar role inicial (pode ser ajustado depois):', updateError);
          // Não falhamos o processo todo por isso, o usuário já foi criado.
        }
      }

      toast.success('Usuário adicionado com sucesso!');
      setNewUserOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao adicionar:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  const resetForm = () => {
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserName('');
    setNewUserRole('user');
  };

  const handleToggleRole = async (userId: string, currentRole: UserRole) => {
    const newRole: UserRole = currentRole === 'admin' ? 'user' : 'admin';
    const previousUsers = [...users];

    // Optimistic update
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));

    try {
      // Update direto no banco (Funciona sempre se RLS estiver certo)
      const { error } = await supabase
        .from('app_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`Role alterado para ${newRole === 'admin' ? 'Admin' : 'Usuário'}`);
    } catch (error: any) {
      console.error('Erro ao atualizar role:', error);
      toast.error('Erro ao atualizar permissão. Verifique se você é Admin.');
      setUsers(previousUsers);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza? O usuário perderá o acesso imediatamente.')) return;

    const previousUsers = [...users];
    setUsers(users.filter(u => u.id !== userId));

    try {
      // DELETE GLOBAL (Via Edge Function - se disponível)
      // Se não tiver Edge Function, fazemos DELETE local no banco.
      const { error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (fnError) {
        // Fallback: Delete local
        const { error: dbError } = await supabase
          .from('app_profiles')
          .delete()
          .eq('id', userId);
        if (dbError) throw dbError;
      }

      toast.success('Usuário removido');
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      // Se deu erro, revertemos a UI mas tentamos limpar do banco local de qualquer jeito
      toast.error('Erro ao excluir usuário');
      setUsers(previousUsers);
    }
  };

  const fetchConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_config')
      .select('*');

    if (!error && data) {
      setConfigs(data as SystemConfig[]);
      const apiUrl = (data as SystemConfig[]).find((c) => c.key === 'evolution_api_url')?.value || '';
      const apiKey = (data as SystemConfig[]).find((c) => c.key === 'evolution_api_key')?.value || '';
      const instanceName = (data as SystemConfig[]).find((c) => c.key === 'evolution_instance_name')?.value || '';
      const instancePhone = (data as SystemConfig[]).find((c) => c.key === 'evolution_instance_phone')?.value || '';
      setEditApiUrl(apiUrl);
      setEditApiKey(apiKey);
      setEditInstanceName(instanceName);
      setEditInstancePhone(instancePhone);
      setWebhookIncoming((data as SystemConfig[]).find((c) => c.key === 'webhook_incoming_url')?.value || '');
      setWebhookOutgoing((data as SystemConfig[]).find((c) => c.key === 'webhook_outgoing_url')?.value || '');
    }
  }, []);

  const fetchShortcuts = useCallback(async () => {
    const { data } = await supabase
      .from('message_shortcuts')
      .select('*')
      .order('trigger', { ascending: true });

    if (data) {
      setShortcuts(data as MessageShortcut[]);
    }
  }, []);

  const fetchDistributionConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lead_distribution_config')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching distribution config:', error);
        return;
      }

      if (data) {
        setLeadDistributionEnabled(data.enabled);
        setDistributionConfigId(data.id);
      } else {
        // Create default if not exists (though migration should have created it)
        const { data: newData, error: createError } = await supabase
          .from('lead_distribution_config')
          .insert({ enabled: false, last_assigned_index: 0 })
          .select()
          .single();

        if (!createError && newData) {
          setLeadDistributionEnabled(newData.enabled);
          setDistributionConfigId(newData.id);
        }
      }
    } catch (error) {
      console.error('Error in fetchDistributionConfig:', error);
    }
  }, []);

  const fetchDistributionUsers = useCallback(async () => {
    try {
      // Fetch distribution entries
      const { data: distributionData, error: distError } = await supabase
        .from('lead_distribution')
        .select('*')
        .order('position');

      if (distError) {
        console.error('Error fetching distribution:', distError);
        return;
      }

      if (!distributionData || distributionData.length === 0) {
        setDistributionUsers([]);
        return;
      }

      // Fetch user details separately to avoid RLS issues with JOIN
      const userIds = distributionData.map(d => d.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('app_profiles')
        .select('*')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        setDistributionUsers(distributionData as LeadDistribution[]);
        return;
      }

      // Combine the data
      const combined = distributionData.map(dist => ({
        ...dist,
        users: usersData?.find(u => u.id === dist.user_id)
      })) as LeadDistribution[];

      setDistributionUsers(combined);
    } catch (error) {
      console.error('Error in fetchDistributionUsers:', error);
    }
  }, []);

  const handleToggleDistribution = async (enabled: boolean) => {
    if (!distributionConfigId) {
      toast.error('Configuração não encontrada');
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_distribution_config')
        .update({ enabled, updated_at: getSaoPauloTimestamp() })
        .eq('id', distributionConfigId);

      if (error) throw error;

      setLeadDistributionEnabled(enabled);
      toast.success(enabled ? 'Distribuição automática ativada!' : 'Distribuição automática desativada!');
    } catch (error) {
      console.error('Error toggling distribution:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleAddToDistribution = async (userId: string) => {
    if (!userId) return;

    try {
      // Check if user already in distribution
      const existing = distributionUsers.find(du => du.user_id === userId);
      if (existing) {
        toast.error('Usuário já está na distribuição');
        return;
      }

      const maxPosition = distributionUsers.length > 0
        ? Math.max(...distributionUsers.map(u => u.position))
        : 0;

      const { error } = await supabase
        .from('lead_distribution')
        .insert({
          user_id: userId,
          position: maxPosition + 1,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Usuário adicionado à distribuição!');
      fetchDistributionUsers();
    } catch (error) {
      console.error('Error adding to distribution:', error);
      toast.error('Erro ao adicionar usuário');
    }
  };

  const handleRemoveFromDistribution = async (id: string) => {
    try {
      const { error } = await supabase
        .from('lead_distribution')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Usuário removido da distribuição!');
      fetchDistributionUsers();
    } catch (error) {
      console.error('Error removing from distribution:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  useEffect(() => {
    if (userData) {
      setEditName(userData.name);
      setEditEmail(userData.email);
    }
    if (role === 'admin') {
      fetchUsers();
      fetchConfigs();
      fetchShortcuts();
      fetchDistributionConfig();
      fetchDistributionUsers();
    }
    setLoading(false);
  }, [userData, role, fetchUsers, fetchConfigs, fetchShortcuts, fetchDistributionConfig, fetchDistributionUsers]);

  const checkConnectionStatus = useCallback(async () => {
    const apiUrl = configs.find((c) => c.key === 'evolution_api_url')?.value;
    const apiKey = configs.find((c) => c.key === 'evolution_api_key')?.value;
    const instanceName = configs.find((c) => c.key === 'evolution_instance_name')?.value;

    if (!apiUrl || !apiKey || !instanceName) {
      setConnectionStatus('disconnected');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      const data = await response.json();

      if (data.instance?.state === 'open') {
        setConnectionStatus('connected');
        setQrCode(null);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      // Silently fail
      setConnectionStatus('disconnected');
    }
  }, [configs]);

  useEffect(() => {
    if (configs.length > 0) {
      checkConnectionStatus();
      const interval = setInterval(checkConnectionStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [configs, checkConnectionStatus]);

  const generateQRCode = async () => {
    const apiUrl = configs.find((c) => c.key === 'evolution_api_url')?.value;
    const apiKey = configs.find((c) => c.key === 'evolution_api_key')?.value;
    const instanceName = configs.find((c) => c.key === 'evolution_instance_name')?.value;

    if (!apiUrl || !apiKey || !instanceName) {
      toast.error('Configure as credenciais da API primeiro');
      setCredentialsOpen(true);
      return;
    }

    setConnectionStatus('connecting');
    setConnectionStatus('connecting');
    try {
      const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
      });

      const data = await response.json();

      if (data.qrcode?.base64) {
        setQrCode(data.qrcode.base64);
      } else if (data.instance?.state === 'open') {
        setConnectionStatus('connected');
        toast.success('WhatsApp conectado!');
      }
    } catch (error) {
      console.error('Error generating QR Code:', error);
      toast.error('Erro ao gerar QR Code');
      setConnectionStatus('disconnected');
    }
  };

  const handleSaveCredentials = async () => {
    if (!editApiUrl || !editApiKey || !editInstanceName) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSavingCredentials(true);
    try {
      const credentials = [
        { key: 'evolution_api_url', value: editApiUrl },
        { key: 'evolution_api_key', value: editApiKey },
        { key: 'evolution_instance_name', value: editInstanceName },
      ];

      for (const cred of credentials) {
        const existing = configs.find(c => c.key === cred.key);
        if (existing) {
          await supabase
            .from('system_config')
            .update({ value: cred.value } as never)
            .eq('key', cred.key);
        } else {
          await supabase
            .from('system_config')
            .insert({ key: cred.key, value: cred.value } as never);
        }
      }

      toast.success('Credenciais salvas com sucesso!');
      setEditCredentialsOpen(false);
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao salvar credenciais');
    }
    setSavingCredentials(false);
  };

  const handleSaveWebhooks = async () => {
    setSavingWebhooks(true);
    try {
      const webhooks = [
        { key: 'webhook_incoming_url', value: webhookIncoming },
        { key: 'webhook_outgoing_url', value: webhookOutgoing },
      ];

      for (const webhook of webhooks) {
        const existing = configs.find(c => c.key === webhook.key);
        if (existing) {
          await supabase
            .from('system_config')
            .update({ value: webhook.value } as never)
            .eq('key', webhook.key);
        } else {
          await supabase
            .from('system_config')
            .insert({ key: webhook.key, value: webhook.value } as never);
        }
      }

      toast.success('Webhooks salvos!');
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao salvar webhooks');
    }
    setSavingWebhooks(false);
  };

  const handleTestWebhook = async () => {
    if (!webhookIncoming) {
      toast.error('Configure o webhook antes de testar');
      return;
    }

    setTestingWebhook(true);
    try {
      const response = await fetch(webhookIncoming, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          timestamp: getSaoPauloTimestamp(),
          message: 'Teste de webhook do CRM',
        }),
      });

      if (response.ok) {
        toast.success('Webhook testado com sucesso!');
      } else {
        toast.error(`Erro: ${response.status}`);
      }
    } catch (error) {
      toast.error('Erro ao testar webhook');
    }
    setTestingWebhook(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setChangingPassword(false);

    if (error) {
      toast.error('Erro ao alterar senha');
    } else {
      toast.success('Senha alterada com sucesso');
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName || !editEmail) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase
      .from('app_profiles')
      .update({ name: editName, email: editEmail } as never)
      .eq('id', userData?.id);

    setSavingProfile(false);

    if (error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil atualizado');
    }
  };

  // Shortcuts handlers
  const handleSaveShortcut = async () => {
    const trigger = newShortcutTrigger.toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!trigger || !newShortcutContent) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSavingShortcut(true);
    try {
      if (editingShortcut) {
        await supabase
          .from('message_shortcuts')
          .update({ trigger, content: newShortcutContent } as never)
          .eq('id', editingShortcut.id);
        toast.success('Atalho atualizado!');
      } else {
        const { error } = await supabase
          .from('message_shortcuts')
          .insert({ trigger, content: newShortcutContent } as never);

        if (error) {
          if (error.code === '23505') {
            toast.error('Este gatilho já existe');
          } else {
            throw error;
          }
          setSavingShortcut(false);
          return;
        }
        toast.success('Atalho criado!');
      }

      setNewShortcutOpen(false);
      setNewShortcutTrigger('');
      setNewShortcutContent('');
      setEditingShortcut(null);
      fetchShortcuts();
    } catch (error) {
      toast.error('Erro ao salvar atalho');
    }
    setSavingShortcut(false);
  };

  const handleEditShortcut = (shortcut: MessageShortcut) => {
    setEditingShortcut(shortcut);
    setNewShortcutTrigger(shortcut.trigger);
    setNewShortcutContent(shortcut.content);
    setNewShortcutOpen(true);
  };

  const handleDeleteShortcut = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este atalho?')) return;

    try {
      await supabase.from('message_shortcuts').delete().eq('id', id);
      toast.success('Atalho excluído');
      fetchShortcuts();
    } catch (error) {
      toast.error('Erro ao excluir atalho');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getConfigValue = (key: string) => {
    return configs.find((c) => c.key === key)?.value || '';
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            Configurações
            <Badge variant="outline" className="text-xs font-normal">
              {role === 'admin' ? 'Admin' : 'Usuário Padrão'}
              <span className="ml-1 opacity-50">({user?.id?.slice(0, 4)}...)</span>
            </Badge>
          </h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        {/* Admin-only sections */}
        {role === 'admin' && (
          <>
            {/* WhatsApp Connection */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {connectionStatus === 'connected' ? (
                    <Wifi className="h-5 w-5 text-success" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-destructive" />
                  )}
                  Conexão WhatsApp
                </CardTitle>
                <CardDescription>
                  Conecte sua instância do WhatsApp para enviar e receber mensagens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge
                    variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
                    className={cn(
                      connectionStatus === 'connected' && 'bg-success hover:bg-success/90'
                    )}
                  >
                    {connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                  </Badge>
                  <Button onClick={generateQRCode} disabled={connectionStatus === 'connecting'} className="bg-primary hover:bg-primary/90">
                    {connectionStatus === 'connecting' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar QR Code
                      </>
                    )}
                  </Button>
                </div>

                {qrCode && (
                  <div className="mt-4 flex justify-center">
                    <div className="p-4 bg-white rounded-lg">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <Dialog open={editCredentialsOpen} onOpenChange={setEditCredentialsOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Pencil className="mr-2 h-4 w-4" />
                        Configurar Credenciais
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Configurar Evolution API</DialogTitle>
                        <DialogDescription>
                          Insira as credenciais da sua instância da Evolution API
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>API URL</Label>
                          <Input
                            value={editApiUrl}
                            onChange={(e) => setEditApiUrl(e.target.value)}
                            placeholder="https://api.seudominio.com"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={editApiKey}
                            onChange={(e) => setEditApiKey(e.target.value)}
                            placeholder="Sua API Key Global"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome da Instância</Label>
                          <Input
                            value={editInstanceName}
                            onChange={(e) => setEditInstanceName(e.target.value)}
                            placeholder="Nome da Instância"
                            className="bg-secondary border-border"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditCredentialsOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveCredentials} disabled={savingCredentials} className="bg-primary hover:bg-primary/90">
                          {savingCredentials ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            'Salvar'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Message Shortcuts */}
            <Collapsible open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
              <Card className="border-border bg-card">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Command className="h-5 w-5" />
                          Atalhos de Mensagem
                        </CardTitle>
                        <CardDescription>Crie atalhos para mensagens frequentes (use / no chat)</CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform',
                          shortcutsOpen && 'rotate-180'
                        )}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {shortcuts.length} atalho{shortcuts.length !== 1 ? 's' : ''} cadastrado{shortcuts.length !== 1 ? 's' : ''}
                      </p>
                      <Dialog open={newShortcutOpen} onOpenChange={(open) => {
                        setNewShortcutOpen(open);
                        if (!open) {
                          setEditingShortcut(null);
                          setNewShortcutTrigger('');
                          setNewShortcutContent('');
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button className="bg-primary hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Atalho
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border">
                          <DialogHeader>
                            <DialogTitle>{editingShortcut ? 'Editar Atalho' : 'Novo Atalho'}</DialogTitle>
                            <DialogDescription>
                              Crie um atalho para usar digitando / no chat
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Gatilho (sem /)</Label>
                              <Input
                                value={newShortcutTrigger}
                                onChange={(e) => setNewShortcutTrigger(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                placeholder="saudacao"
                                className="bg-secondary border-border"
                              />
                              <p className="text-xs text-muted-foreground">
                                Apenas letras minúsculas, números e underscore
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Conteúdo da mensagem</Label>
                              <Textarea
                                value={newShortcutContent}
                                onChange={(e) => setNewShortcutContent(e.target.value)}
                                placeholder="Olá! Seja bem-vindo à Carlos Rodeiro. Como posso ajudá-lo?"
                                rows={4}
                                className="bg-secondary border-border"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setNewShortcutOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleSaveShortcut} disabled={savingShortcut} className="bg-primary hover:bg-primary/90">
                              {savingShortcut ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                'Salvar'
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {shortcuts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Command className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Nenhum atalho cadastrado</p>
                        <p className="text-sm">Crie atalhos para agilizar o atendimento</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {shortcuts.map((shortcut) => (
                          <div
                            key={shortcut.id}
                            className="flex items-start justify-between p-4 rounded-lg border border-border bg-secondary/30"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono">
                                  /{shortcut.trigger}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {shortcut.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-4 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditShortcut(shortcut)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteShortcut(shortcut.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Users Management */}
            {/* Users Management */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Gerenciar Usuários
                    </CardTitle>
                    <CardDescription>Adicione e gerencie usuários do sistema (Admins têm acesso total)</CardDescription>
                  </div>
                  <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Novo Usuário</DialogTitle>
                        <DialogDescription>
                          Preencha os dados para criar um novo usuário.
                          <br />
                          <span className="text-xs text-muted-foreground">Nota: Requer Edge Function 'create-user' implantada.</span>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Nome completo"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="email@exemplo.com"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Senha</Label>
                          <Input
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Função (Role)</Label>
                          <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                            <SelectTrigger className="bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="user">Usuário Padrão</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewUserOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={creatingUser} className="bg-primary hover:bg-primary/90">
                          {creatingUser ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            'Criar Usuário'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhum usuário encontrado (exceto você).</p>
                    ) : (
                      users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 bg-primary">
                              <AvatarFallback className="text-primary-foreground">
                                {getInitials(user.name || user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{user.name || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'Admin' : 'Usuário'}
                            </Badge>

                            {/* Actions only valid if not self (usually) but let's allow editing roles */}
                            <Button
                              variant="outline"
                              size="sm"
                              title={user.role === 'admin' ? 'Rebaixar para Usuário' : 'Promover a Admin'}
                              onClick={() => handleToggleRole(user.id, user.role)}
                              disabled={user.id === userData?.id} // Prevent self-demotion lockout if desired, or allow it
                            >
                              <Key className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              title="Excluir Usuário"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === userData?.id} // Prevent self-deletion
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lead Distribution */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Distribuição Automática de Leads
                </CardTitle>
                <CardDescription>
                  Distribui novos leads automaticamente de forma igualitária entre os usuários selecionados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30">
                  <div>
                    <Label className="text-base font-medium">Ativar distribuição automática</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Novos leads serão distribuídos automaticamente (round-robin)
                    </p>
                  </div>
                  <Switch
                    checked={leadDistributionEnabled}
                    onCheckedChange={handleToggleDistribution}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Usuários na Distribuição</Label>

                  {distributionUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                      Nenhum usuário na distribuição. Adicione usuários abaixo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {distributionUsers.map((du, index) => (
                        <div
                          key={du.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono w-8 justify-center">
                              {index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{du.users?.name || 'Usuário desconhecido'}</p>
                              <p className="text-sm text-muted-foreground">{du.users?.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromDistribution(du.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <Label className="mb-2 block">Adicionar Usuário</Label>
                    <Select onValueChange={handleAddToDistribution}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Selecione um usuário para adicionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter(u => !distributionUsers.some(du => du.user_id === u.id))
                          .map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))
                        }
                        {users.filter(u => !distributionUsers.some(du => du.user_id === u.id)).length === 0 && (
                          <SelectItem value="_none" disabled>
                            Todos os usuários já estão na distribuição
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* My Profile */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Meu Perfil
            </CardTitle>
            <CardDescription>Edite suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-primary hover:bg-primary/90">
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>

              <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Alterar Senha</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Alterar Senha</DialogTitle>
                    <DialogDescription>
                      Digite sua senha atual e a nova senha
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Senha atual</Label>
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="bg-secondary border-border"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nova senha</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar nova senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-secondary border-border"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPasswordOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-primary hover:bg-primary/90">
                      {changingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Alterando...
                        </>
                      ) : (
                        'Alterar Senha'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="destructive" onClick={signOut} className="ml-auto">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  );
}
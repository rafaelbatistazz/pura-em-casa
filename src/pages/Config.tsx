import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
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
import type { User as UserType, UserRole, SystemConfig, MessageShortcut } from '@/types/database';

export default function Config() {
  const { userData, updatePassword, role, signOut } = useAuth();
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
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Webhooks
  const [webhookIncoming, setWebhookIncoming] = useState('');
  const [webhookOutgoing, setWebhookOutgoing] = useState('');
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchConfigs();
    fetchShortcuts();
    if (userData) {
      setEditName(userData.name);
      setEditEmail(userData.email);
    }
  }, [userData]);

  const checkConnectionStatus = useCallback(async () => {
    const apiUrl = configs.find((c) => c.key === 'evolution_api_url')?.value;
    const apiKey = configs.find((c) => c.key === 'evolution_api_key')?.value;
    const instance = configs.find((c) => c.key === 'evolution_instance_name')?.value;

    if (!apiUrl || !apiKey || !instance) return;

    try {
      const response = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
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
    }
  }, [configs]);

  useEffect(() => {
    if (configs.length > 0) {
      checkConnectionStatus();
      const interval = setInterval(checkConnectionStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [configs, checkConnectionStatus]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data as UserType[]);
    }
    setLoading(false);
  };

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name', 'webhook_incoming_url', 'webhook_outgoing_url']);

    if (!error && data) {
      setConfigs(data as SystemConfig[]);
      const apiUrl = (data as SystemConfig[]).find((c) => c.key === 'evolution_api_url')?.value || '';
      const apiKey = (data as SystemConfig[]).find((c) => c.key === 'evolution_api_key')?.value || '';
      const instanceName = (data as SystemConfig[]).find((c) => c.key === 'evolution_instance_name')?.value || '';
      setEditApiUrl(apiUrl);
      setEditApiKey(apiKey);
      setEditInstanceName(instanceName);
      setWebhookIncoming((data as SystemConfig[]).find((c) => c.key === 'webhook_incoming_url')?.value || '');
      setWebhookOutgoing((data as SystemConfig[]).find((c) => c.key === 'webhook_outgoing_url')?.value || '');
    }
  };

  const fetchShortcuts = async () => {
    const { data } = await supabase
      .from('message_shortcuts')
      .select('*')
      .order('trigger', { ascending: true });

    if (data) {
      setShortcuts(data as MessageShortcut[]);
    }
  };

  const generateQRCode = async () => {
    setConnectionStatus('connecting');
    try {
      const apiUrl = configs.find((c) => c.key === 'evolution_api_url')?.value;
      const apiKey = configs.find((c) => c.key === 'evolution_api_key')?.value;
      const instance = configs.find((c) => c.key === 'evolution_instance_name')?.value;

      if (!apiUrl || !apiKey || !instance) {
        toast.error('Credenciais não configuradas');
        setConnectionStatus('disconnected');
        return;
      }

      const response = await fetch(`${apiUrl}/instance/connect/${instance}`, {
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
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Usuário criado com sucesso!');
      setNewUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      fetchUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário';
      toast.error(errorMessage);
    }
    setCreatingUser(false);
  };

  const handleToggleRole = async (userId: string, _currentRole: UserRole) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    const newRole: UserRole = userToUpdate.role === 'admin' ? 'user' : 'admin';

    try {
      const { error: usersError } = await supabase
        .from('users')
        .update({ role: newRole } as never)
        .eq('id', userId);

      if (usersError) throw usersError;

      const { error: rolesError } = await supabase
        .from('user_roles')
        .update({ role: newRole } as never)
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      toast.success(`Usuário alterado para ${newRole === 'admin' ? 'Admin' : 'Usuário'}!`);
      fetchUsers();
    } catch (error) {
      toast.error('Erro ao atualizar role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Usuário excluído');
      fetchUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir usuário';
      toast.error(errorMessage);
    }
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
          timestamp: new Date().toISOString(),
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
      .from('users')
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
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
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Gerenciar Usuários
                    </CardTitle>
                    <CardDescription>Adicione e gerencie usuários do sistema</CardDescription>
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
                          Preencha os dados para criar um novo usuário
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
                          <Label>Role</Label>
                          <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                            <SelectTrigger className="bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="user">Usuário</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
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
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 bg-primary">
                            <AvatarFallback className="text-primary-foreground">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleToggleRole(user.id, value === 'admin' ? 'user' : 'admin')}
                            disabled={user.id === userData?.id}
                          >
                            <SelectTrigger className="w-[120px] bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="user">Usuário</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === userData?.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API de Mensagens */}
            <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
              <Card className="border-border bg-card">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Key className="h-5 w-5" />
                          API de Mensagens
                        </CardTitle>
                        <CardDescription>Configurações da API de envio de mensagens</CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform',
                          credentialsOpen && 'rotate-180'
                        )}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Instância</Label>
                      <Input value={getConfigValue('evolution_instance_name')} readOnly className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input value={getConfigValue('evolution_api_key')} readOnly type="password" className="bg-secondary border-border" />
                    </div>
                    <Dialog open={editCredentialsOpen} onOpenChange={(open) => {
                      setEditCredentialsOpen(open);
                      if (open) {
                        setEditApiUrl(getConfigValue('evolution_api_url'));
                        setEditApiKey(getConfigValue('evolution_api_key'));
                        setEditInstanceName(getConfigValue('evolution_instance_name'));
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Credenciais
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border">
                        <DialogHeader>
                          <DialogTitle>Editar Credenciais da API</DialogTitle>
                          <DialogDescription>
                            Atualize as credenciais da API de mensagens
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>API URL</Label>
                            <Input
                              value={editApiUrl}
                              onChange={(e) => setEditApiUrl(e.target.value)}
                              placeholder="https://api.exemplo.com"
                              className="bg-secondary border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                              value={editApiKey}
                              onChange={(e) => setEditApiKey(e.target.value)}
                              placeholder="Sua API Key"
                              className="bg-secondary border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nome da Instância</Label>
                            <Input
                              value={editInstanceName}
                              onChange={(e) => setEditInstanceName(e.target.value)}
                              placeholder="Nome da instância"
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
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Webhooks */}
            <Collapsible>
              <Card className="border-border bg-card">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Webhook className="h-5 w-5" />
                          Webhooks
                        </CardTitle>
                        <CardDescription>Configure URLs de webhook para integração</CardDescription>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Webhook de Entrada</Label>
                      <Input
                        value={webhookIncoming}
                        onChange={(e) => setWebhookIncoming(e.target.value)}
                        placeholder="https://seu-webhook.com/incoming"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook de Saída (opcional)</Label>
                      <Input
                        value={webhookOutgoing}
                        onChange={(e) => setWebhookOutgoing(e.target.value)}
                        placeholder="https://seu-webhook.com/outgoing"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveWebhooks} disabled={savingWebhooks} className="bg-primary hover:bg-primary/90">
                        {savingWebhooks ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleTestWebhook} disabled={testingWebhook || !webhookIncoming}>
                        {testingWebhook ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testando...
                          </>
                        ) : (
                          <>
                            <TestTube className="mr-2 h-4 w-4" />
                            Testar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
    </div>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getSaoPauloTimestamp } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
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
  TestTube,
  Command,
  LogOut,
  Bot,
  Brain,
} from 'lucide-react';
import { KnowledgeBase } from '@/components/KnowledgeBase';
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

  // Evolution API Constants
  const EVOLUTION_API_URL = 'https://evo.advfunnel.com.br';
  const EVOLUTION_API_KEY = 'ESWH6B36nhfW3apMfQQAv3SU2CthsZCg';

  // Profile edit
  const [editName, setEditName] = useState('');

  // Alert Notification
  const [alertPhone, setAlertPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // New Instance Form
  const [newInstanceOpen, setNewInstanceOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [instanceName, setInstanceName] = useState('');

  // Lead Distribution
  const [leadDistributionEnabled, setLeadDistributionEnabled] = useState(false);
  const [distributionConfigId, setDistributionConfigId] = useState<string>('');
  const [distributionUsers, setDistributionUsers] = useState<LeadDistribution[]>([]);

  // Webhooks
  const [webhookIncoming, setWebhookIncoming] = useState('');
  const [webhookOutgoing, setWebhookOutgoing] = useState('');
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // AI Settings
  const [aiSettings, setAiSettings] = useState({
    model: 'gpt-4o-mini',
    system_prompt: `# SISTEMA DE ATENDIMENTO - TAMIRES | PURA EM CASA

Você é **Tamires**, especialista de atendimento da Pura em Casa, empresa de limpeza e impermeabilização de estofados em Brasília/DF.

---

## REGRAS ABSOLUTAS

1. **NUNCA mencione ou ofereça desconto** - isso é responsabilidade do atendente humano no follow-up
2. **Descontos aparecem no histórico?** A IA verifica o histórico da conversa para saber se já foi dado desconto
3. **SEMPRE avance a conversa** - termine cada mensagem com próximo passo
4. **Pagamento é na casa do cliente** - nunca mencionar link de pagamento ou PIX no atendimento inicial
5. **Protocolo de agendamento:** MÊS+2026 (exemplo: janeiro = 012026, fevereiro = 022026)
6. **PROIBIDO USAR FORMATO DE LISTA/BULLET POINTS** (ex: •, -, *). Use sempre TEXTO CORRIDO e humanizado.

---

## FERRAMENTAS DISPONÍVEIS

### send_media(media_type: "processo_8_etapas")
Envia a imagem ilustrativa do processo de limpeza em 8 etapas.

### send_media(media_type: "demonstracao_limpeza")
Envia vídeo demonstrativo da limpeza sendo realizada.

### finalize_proposal(total_value: number)
**IMPORTANTE:** CHAME ESTA FUNÇÃO IMEDIATAMENTE APÓS ENVIAR O ORÇAMENTO.
Ela altera o status do lead para "Proposta" no sistema.

---

## ESTADO 1: ABERTURA

**Quando:** Primeiro contato do cliente

**Enviar:**
"Olá! Tudo bem? ✨
Aqui é a Tamires e sou a especialista da Pura em Casa.

A partir de agora, estarei à frente do seu atendimento, qualquer dúvida que surgir, pode contar comigo!

Poderia nos enviar uma foto de seus estofados, por gentileza?!"

---

## ESTADO 2: QUALIFICAÇÃO (Foto Recebida)

**IMPORTANTE:**
1. **Analise a foto** e identifique qual móvel é (Sofá, Colchão, Cadeira, etc).
2. **SELECIONE APENAS UM** conjunto de perguntas abaixo (o que melhor se aplica).
3. **NUNCA** envie a lista completa ("Se for sofá..., Se for colchão..."). Isso é proibido.
4. **Responda** agradecendo e já fazendo a pergunta específica.

**Exemplo (Se for Sofá):**
"Agradeço o envio da foto!
Este sofá é retrátil ou reclinável? As almofadas são soltas?"

### PERGUNTAS QUALIFICADORAS (Escolha UMA categoria)

#### Para SOFÁ:
- "Este sofá é retrátil ou reclinável?"
- "As almofadas do encosto são soltas ou fixas?"
- Se sofá-cama: "Este é um modelo sofá-cama?"
- Se não souber tamanho: "Quantos lugares ele tem aproximadamente?"

#### Para COLCHÃO:
- "Quer limpar a base do colchão também ou só o colchão?"
- "Qual o tamanho? Casal, Queen ou King?"

#### Para CADEIRAS:
- "Essas cadeiras têm encosto estofado ou é só o assento?"
- "Quantas cadeiras são ao todo?"

#### Para POLTRONAS:
- "Esta poltrona é reclinável (tipo 'do papai')?"
- "Deseja limpar apenas o assento ou assento + encosto?"
- "As almofadas são soltas ou fixas?"

#### Para ALMOFADAS DECORATIVAS:
- "Deseja a limpeza dessas almofadas decorativas também?"
- "Quantas almofadas são?"

#### Para TAPETES:
- "Este tapete é fibra sintética ou natural?"
- "Qual o tamanho aproximado? (em metros)"

#### Para PUFFS/RECAMIER:
- "Este puff tem quanto de comprimento aproximadamente?"
- "Deseja limpar só o assento ou por inteiro?"

**Após qualificação completa:**
"Perfeito! Vou te apresentar nosso método e depois envio o orçamento."

---

## ESTADO 3: APRESENTAÇÃO DO MÉTODO

**PROTOCOLO VISUAL (IMPORTANTE):**
Nesta etapa, você deve **SEMPRE** usar a ferramenta nativa \`send_media\`.
O fluxo correto é:
1. Você envia o texto explicativo.
2. O sistema anexa a mídia automaticamente se você usar a ferramenta.

**REGRA DE OURO:**
**NUNCA ESCREVA** \`send_media\` ou o nome da função no seu texto.
Apenas **USE** a ferramenta silenciosamente junto com sua resposta.

### 1. TEXTO + IMAGEM
**Ação:** Explique o método E ative a ferramenta (parâmetro: "processo_8_etapas").

**Texto Sugerido:**
- "Perfeito! Vou te apresentar nosso método... (explique os benefícios)... toque e o visual do estofado."

*(Aguarde o sistema enviar a imagem)*

---

### 2. VÍDEO DEMONSTRATIVO
**Ação:** Diga "Veja como funciona: Ao invés de oferecer..." E ative a ferramenta (parâmetro: "demonstracao_limpeza").

**Texto Sugerido:**
"Veja como funciona: Ao invés de oferecer apenas uma simples limpeza... (explique o vídeo) ...o estofado fica verdadeiramente limpo."

*(Aguarde o sistema enviar o vídeo)*

---

### 3. CONFIRMAÇÃO
**Ação:** No turno seguinte ao vídeo, pergunte:
"Entendeu como funciona nosso processo? Posso te encaminhar o orçamento agora?"

### Etapa 3.6: Pedir Confirmação para Orçamento
**IMPORTANTE: DEPOIS DO VÍDEO, PERGUNTE:**

"Entendeu como funciona nosso processo? 

Posso te encaminhar o orçamento agora?"

**AGUARDE A RESPOSTA DO CLIENTE.**
- Se cliente confirmar (ex: "sim", "pode", "ok", "manda"), vá para ESTADO 4 (gerar orçamento)
- Se cliente tiver dúvidas, responda e pergunte novamente se pode enviar o orçamento

**AGUARDE A RESPOSTA DO CLIENTE.**
- Se cliente confirmar (ex: "sim", "pode", "ok", "manda"), vá para ESTADO 4 (gerar orçamento)
- Se cliente tiver dúvidas, responda e pergunte novamente se pode enviar o orçamento

---

## ESTADO 4: ORÇAMENTO (SOMENTE APÓS CONFIRMAÇÃO DO CLIENTE)

### TABELA COMPLETA DE LIMPEZA/HIGIENIZAÇÃO

PARA CALCULAR O PREÇO, USE ESTES DADOS (JSON):

{
  "sofas": {
    "2_lugares_ate_2m": { "todo_fixo": 229, "assento_ou_encosto_solto": 249, "todo_solto_retratil_reclinavel": 279 },
    "2_lugares_ate_2_6m": { "todo_fixo": 249, "assento_ou_encosto_solto": 279, "todo_solto_retratil_reclinavel": 319 },
    "3_lugares_ate_3_2m": { "todo_fixo": 279, "assento_ou_encosto_solto": 309, "todo_solto_retratil_reclinavel": 359 },
    "4_lugares_ate_3_8m": { "todo_fixo": 355, "assento_ou_encosto_solto": 419, "todo_solto_retratil_reclinavel": 489 },
    "5_lugares_ate_4_4m": { "todo_fixo": 419, "assento_ou_encosto_solto": 499, "todo_solto_retratil_reclinavel": 599 },
    "sofa_cama_sem_colchao": 339
  },
  "modulado_0_8_a_1m": { "fixo_por_modulo": 189, "almofadas_soltas_por_modulo": 199, "reclinavel_retratil_por_modulo": 219 },
  "modulado_1_a_1_2m": { "fixo_por_modulo": 199, "almofadas_soltas_por_modulo": 209, "reclinavel_retratil_por_modulo": 229 },
  "chaises": { "pequeno_0_6_a_1m": 199, "grande_1_a_1_5m": 209 },
  "cadeiras": { "toda_revestida": 55, "somente_assento": 45, "tipo_poltrona": 99 },
  "poltronas": {
    "pequena_0_45m": { "todo_fixo": 169, "assento_ou_encosto_solto": 179, "todo_solto": 189 },
    "media_0_9m": { "todo_fixo": 189, "assento_ou_encosto_solto": 199, "todo_solto": 209 },
    "grande_1_35m": { "todo_fixo": 199, "assento_ou_encosto_solto": 209, "todo_solto": 219 },
    "reclinavel_papai": 199
  },
  "colchoes": {
    "solteiro_0_78x1_88": 199, "solteirao_0_9x1_88": 209, "casal_padrao_1_38x1_88": 249,
    "queen_1_58x1_98": 269, "king_1_86x1_98": 329, "super_king_1_98x2_03": 349
  },
  "cama": { "base_queen_com_cabeceira": 199, "base_king_com_cabeceira": 219, "cabeceira_por_m2": 60 },
  "outros": { "almofada_decorativa_0_45x0_45": 45, "recamier_puff_ate_1_1m": 159 },
  "tapetes": { "fibra_sintetica_por_m2": 45, "fibra_natural_por_m2": 60, "fibra_natural_tingido_por_m2": 60 }
}

### TABELA COMPLETA DE IMPERMEABILIZAÇÃO

{
  "sofas": {
    "2_lugares_ate_2_5m": { "todo_fixo": 479, "assento_ou_encosto_solto": 629, "todo_solto_retratil_reclinavel": 799 },
    "3_lugares_ate_3m": { "todo_fixo": 559, "assento_ou_encosto_solto": 759, "todo_solto_retratil_reclinavel": 969 },
    "4_lugares_ate_3_5m": { "todo_fixo": 655, "assento_ou_encosto_solto": 895, "todo_solto_retratil_reclinavel": 1159 },
    "5_lugares_ate_4m": { "todo_fixo": 749, "assento_ou_encosto_solto": 1029, "todo_solto_retratil_reclinavel": 1349 },
    "sofa_cama_sem_colchao": 760, "sofa_cama_com_colchao": 800
  },
  "chaises": { "pequeno_0_6_a_1m": 329, "grande_1_a_1_5m": 389 },
  "cadeiras": { "toda_revestida": 119, "somente_assento": 79, "tipo_poltrona": 149 },
  "poltronas": {
    "pequena_0_45m": { "todo_fixo": 195, "assento_ou_encosto_solto": 219, "todo_solto": 239 },
    "media_0_9m": { "todo_fixo": 259, "assento_ou_encosto_solto": 279, "todo_solto": 299 },
    "grande_1_35m": { "todo_fixo": 315, "assento_ou_encosto_solto": 355, "todo_solto": 419 },
    "reclinavel_amamentacao_papai": 322
  },
  "colchoes": {
    "solteiro_0_78x1_88": 320, "solteirao_0_9x1_88": 349, "casal_padrao_1_38x1_88": 459,
    "queen_1_58x1_98": 529, "king_1_86x1_98": 619, "super_king_1_98x2_03": 659
  },
  "cama_completa": { "padrao_base_cabeceira": 659, "queen_base_cabeceira": 749, "king_base_cabeceira": 799, "super_king_base_cabeceira": 839 },
  "cabeceiras": { "padrao": 439, "queen": 499, "king": 549, "super_king": 599 },
  "outros": { "almofada_decorativa_0_45x0_45": 120, "almofada_grande": 180, "recamier_puff_ate_1_1m": 242 },
  "tapetes": { "fibra_sintetica_por_m2": 110 }
}

### FORMATO DO ORÇAMENTO (OBRIGATÓRIO)

**⚠️ IMPORTANTE: SUBSTITUIÇÃO DE VALORES**
Ao gerar o orçamento, você deve SUBSTITUIR o texto "[VALOR]" e "[TOTAL]" pelo número do preço calculado na tabela acima.
NÃO envie o texto "[VALOR]" para o cliente. Envie o NÚMERO real (ex: R$229,00).

"Orçamento Pura em Casa – Serviço de Higienização de Estofados e Tapetes
Higienização profunda com segurança, cuidado e alto padrão ✨

Itens inclusos:

01 LIMPEZA [TIPO EM MAIÚSCULO] ([ESPECIFICAÇÃO]): R$[PREÇO_CALCULADO],00

Valor total do investimento: R$[PREÇO_TOTAL],00

Opção de parcelamento em até [X]x sem juros no cartão."

(AGORA: CHAME A FUNÇÃO finalize_proposal com o valor total numérico)

### Após Orçamento SEMPRE Enviar:
"Após a higienização, o estofado retém aproximadamente 20% a 30% de umidade. Respeitamos um período de 8 a 12 horas para sua secagem completa, garantindo que esteja em perfeitas condições para uso.

Gostaria de agendar um horário conosco? 🤗"

---

## REGRAS DE COMPORTAMENTO
1. **PARÁGRAFOS:** Use SEMPRE quebra de linha dupla entre as frases longas para facilitar a leitura no WhatsApp.
2. **ZERO VAZAMENTO:** Não escreva os comandos entre parênteses como "(AGORA: PARE...)". Eles são ordens para seu "cérebro", não para o cliente.
3. **MÍDIA:** É OBRIGATÓRIO chamar as funções \`send_media\`. Não pule essa etapa.
4. **NUNCA** gere o orçamento antes do cliente CONFIRMAR todo o fluxo (foto, explicação, imagem, vídeo).
5. **NUNCA** use listas/pontos. Escreva texto corrido.`,
    temperature: 0.1,
    max_tokens: 1000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    debounce_seconds: 6
  });
  const [savingAi, setSavingAi] = useState(false);

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
      toast.success(`Role alterado para ${newRole === 'admin' ? 'Admin' : 'Usuário'} `);
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
      // DELETE GLOBAL (Via RPC Function)
      // Chama a função segura do banco que remove do auth.users e app_profiles
      const { error } = await supabase.rpc('delete_user_by_id', {
        user_id: userId
      });

      if (error) throw error;

      toast.success('Usuário removido do sistema');
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
      setUsers(previousUsers);
    }
  };

  const fetchConfigs = useCallback(async () => {
    const { data: configsData, error: configsError } = await supabase
      .from('system_config')
      .select('*');

    if (!configsError && configsData) {
      setConfigs(configsData as SystemConfig[]);
      const savedInstanceName = (configsData as SystemConfig[]).find((c) => c.key === 'evolution_instance_name')?.value || '';
      setInstanceName(savedInstanceName);
      setWebhookIncoming((configsData as SystemConfig[]).find((c) => c.key === 'webhook_incoming_url')?.value || '');
      setWebhookOutgoing((configsData as SystemConfig[]).find((c) => c.key === 'webhook_outgoing_url')?.value || '');

      const aiConfig = (configsData as SystemConfig[]).find((c) => c.key === 'ai_chat_config')?.value || (configsData as SystemConfig[]).find((c) => c.key === 'ai_settings')?.value;
      if (aiConfig) {
        try {
          const parsed = JSON.parse(aiConfig);
          setAiSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Error parsing AI settings', e);
        }
      }

      // Load Alert Phone
      const alertConfig = configsData.find(c => c.key === 'alert_notification_phone');
      if (alertConfig) setAlertPhone(JSON.parse(alertConfig.value || '""'));
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
        .limit(1);

      if (error) {
        console.error('Error fetching distribution config:', error);
        return;
      }

      const config = data?.[0];

      if (config) {
        setLeadDistributionEnabled(config.enabled);
        setDistributionConfigId(config.id);
      } else {
        // Create default if not exists
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
    if (!instanceName) {
      setConnectionStatus('disconnected');
      return;
    }

    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const data = await response.json();

      if (data.instance?.state === 'open') {
        setConnectionStatus('connected');
        setQrCode(null);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  }, [instanceName]);

  useEffect(() => {
    if (instanceName) {
      checkConnectionStatus();
      const interval = setInterval(checkConnectionStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [instanceName, checkConnectionStatus]);

  const generateQRCode = async () => {
    if (!instanceName) return;

    setConnectionStatus('connecting');
    try {
      const response = await fetch(`${EVOLUTION_API_URL} /instance/connect / ${instanceName} `, {
        method: 'GET', // Changed to GET as per typical Evolution API usage for connection state/QR
        headers: { apikey: EVOLUTION_API_KEY },
      });

      const data = await response.json();

      console.log('QR Code Response:', data); // Debug log

      if (data.qrcode?.base64) {
        setQrCode(data.qrcode.base64);
      } else if (data.base64) {
        setQrCode(data.base64);
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

  const handleCreateInstance = async () => {
    if (!newInstanceName) {
      toast.error('Digite um nome para o WhatsApp');
      return;
    }

    setCreatingInstance(true);
    try {
      // 1. Create Instance in Evolution
      const response = await fetch(`${EVOLUTION_API_URL} /instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: newInstanceName,
          token: crypto.randomUUID(), // Secure random token
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar instância');
      }

      // 2. Save instance name to Supabase
      const { error } = await supabase
        .from('system_config')
        .upsert({ key: 'evolution_instance_name', value: newInstanceName }, { onConflict: 'key' });

      if (error) throw error;

      setInstanceName(newInstanceName);
      setNewInstanceOpen(false);
      setNewInstanceName('');
      toast.success('WhatsApp criado! Clique em Conectar.');
      fetchConfigs();

      // 3. Trigger N8N Webhook
      try {
        await fetch(`https://n8n.advfunnel.com.br/webhook/5f27db92-6051-4d28-9ff0-9047f6622c82/puraemcasawebhookinstancia`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: newInstanceName,
            status: 'created',
            phone: null // Phone is not available until connection
          }),
        });
      } catch (webhookError) {
        console.error('Error triggering N8N webhook:', webhookError);
        // Do not block UI success
      }
    } catch (error: any) {
      console.error('Error creating instance:', error);
      toast.error(error.message || 'Erro ao criar instância');
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!confirm('Tem certeza? Isso irá desconectar o WhatsApp.')) return;

    try {
      // 1. Logout/Delete from Evolution
      await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_API_KEY },
      });

      await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_API_KEY },
      });

      // 2. Remove from Supabase
      await supabase
        .from('system_config')
        .delete()
        .eq('key', 'evolution_instance_name');

      setInstanceName('');
      setQrCode(null);
      setConnectionStatus('disconnected');
      toast.success('WhatsApp desconectado');
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Erro ao desconectar');
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

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      await supabase
        .from('system_config')
        .upsert({
          key: 'ai_chat_config',
          value: JSON.stringify(aiSettings)
        }, { onConflict: 'key' });

      toast.success('Configurações de IA salvas!');
      fetchConfigs();
    } catch (error) {
      console.error('Error saving AI settings:', error);
      toast.error('Erro ao salvar IA');
    }
    setSavingAi(false);
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

  const saveConfigs = async () => {
    try {
      // Save Alert Phone
      const { error: alertError } = await supabase
        .from('system_config')
        .upsert({
          key: 'alert_notification_phone',
          value: JSON.stringify(alertPhone)
        }, { onConflict: 'key' });

      if (alertError) throw alertError;

      // Update local state
      setConfigs(prev => {
        const filtered = prev.filter(c => c.key !== 'alert_notification_phone');
        return [...filtered, {
          id: 'temp',
          key: 'alert_notification_phone',
          value: JSON.stringify(alertPhone),
          created_at: new Date().toISOString()
        }];
      });

      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao salvar configurações');
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
                  Gerencie a conexão da sua instância do WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Instance State Management */}
                {!instanceName ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                    <div className="p-3 rounded-full bg-muted">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium">Nenhuma instância conectada</h3>
                      <p className="text-sm text-muted-foreground">
                        Crie uma nova instância para conectar seu WhatsApp
                      </p>
                    </div>
                    <Button onClick={() => setNewInstanceOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Novo WhatsApp
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status Display */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Instância:</span>
                          <Badge variant="outline">{instanceName}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          Status:
                          <span className={cn(
                            "font-medium",
                            connectionStatus === 'connected' ? "text-success" : "text-amber-500"
                          )}>
                            {connectionStatus === 'connected' ? 'Ativo e Conectado' : 'Aguardando Conexão'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {connectionStatus !== 'connected' && (
                          <Button onClick={generateQRCode} disabled={connectionStatus === 'connecting'}>
                            {connectionStatus === 'connecting' ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Gerando QR...
                              </>
                            ) : (
                              <>
                                <QrCode className="mr-2 h-4 w-4" />
                                Conectar (QR Code)
                              </>
                            )}
                          </Button>
                        )}
                        <Button variant="destructive" size="icon" onClick={handleDeleteInstance} title="Desconectar e Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* QR Code Display */}
                    {qrCode && connectionStatus !== 'connected' && (
                      <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-white w-fit mx-auto">
                        <img src={qrCode} alt="QR Code WhatsApp" className="h-64 w-64" />
                        <p className="mt-4 text-sm text-center text-gray-500">
                          Abra o WhatsApp no seu celular → Configurações → Aparelhos Conectados → Conectar Aparelho
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={newInstanceOpen} onOpenChange={setNewInstanceOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Instância</DialogTitle>
                  <DialogDescription>
                    Digite um nome para identificar este WhatsApp (ex: Comercial, Suporte).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      placeholder="Ex: Comercial"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewInstanceOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateInstance} disabled={creatingInstance}>
                    {creatingInstance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AI Settings */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Inteligência Artificial (Agente)
                </CardTitle>
                <CardDescription>
                  Configure o comportamento e parâmetros do seu agente de IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>System Prompt (Personalidade)</Label>
                    <Textarea
                      value={aiSettings.system_prompt}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
                      placeholder="Você é um assistente..."
                      rows={4}
                      className="bg-secondary border-border"
                    />
                    <p className="text-xs text-muted-foreground">Define como a IA deve se comportar e o que ela sabe.</p>
                  </div>

                  {/* Model Selection Removed - Hardcoded to GPT-4o Mini in Backend */}
                  {/* <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Select ... /> (Removed)
                  </div> */}

                  <div className="space-y-2">
                    <Label>Tempo de Espera (Debounce) - Segundos</Label>
                    <Input
                      type="number"
                      value={(aiSettings as any).debounce_seconds || 6}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, debounce_seconds: Number(e.target.value) }))}
                      className="bg-secondary border-border"
                      min={1}
                      max={60}
                    />
                    <p className="text-xs text-muted-foreground">Tempo que a IA espera por mais mensagens antes de responder.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Tokens ({aiSettings.max_tokens})</Label>
                    <Input
                      type="number"
                      value={aiSettings.max_tokens}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, max_tokens: Number(e.target.value) }))}
                      className="bg-secondary border-border"
                      min={100}
                      max={10000}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Temperature ({aiSettings.temperature})</Label>
                    </div>
                    <Slider
                      value={[aiSettings.temperature]}
                      onValueChange={([val]) => setAiSettings(prev => ({ ...prev, temperature: val }))}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">Criatividade vs Consistência</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Top P ({aiSettings.top_p})</Label>
                    </div>
                    <Slider
                      value={[aiSettings.top_p]}
                      onValueChange={([val]) => setAiSettings(prev => ({ ...prev, top_p: val }))}
                      max={1}
                      step={0.1}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Frequency Penalty ({aiSettings.frequency_penalty})</Label>
                    </div>
                    <Slider
                      value={[aiSettings.frequency_penalty]}
                      onValueChange={([val]) => setAiSettings(prev => ({ ...prev, frequency_penalty: val }))}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Presence Penalty ({aiSettings.presence_penalty})</Label>
                    </div>
                    <Slider
                      value={[aiSettings.presence_penalty]}
                      onValueChange={([val]) => setAiSettings(prev => ({ ...prev, presence_penalty: val }))}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveAi} disabled={savingAi} className="bg-primary hover:bg-primary/90">
                    {savingAi ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Bot className="mr-2 h-4 w-4" />
                        Salvar Configurações IA
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Alert Notification Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Alerta de Avisos
                </CardTitle>
                <CardDescription>
                  Número de WhatsApp para receber resumo quando um lead for Agendado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Número do WhatsApp (com DDD)</Label>
                  <Input
                    placeholder="Ex: 5511999999999"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Se preenchido, enviaremos um resumo (Nome, Telefone, Orçamento, Resumo da conversa) para este número.
                  </p>
                </div>
                <Button onClick={saveConfigs}>Salvar Configuração</Button>
              </CardContent>
            </Card>

            {/* Knowledge Base (RAG) */}
            <KnowledgeBase />

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
                                placeholder="Olá! Seja bem-vindo à Pura Em Casa. Como posso ajudá-lo?"
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
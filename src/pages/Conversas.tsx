import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone, maskPhone } from '@/lib/phoneUtils';
import { cn, getSaoPauloTimestamp } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// ScrollArea removed - using native scroll with scrollbar-hide
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  Search, Send, ArrowLeft, Plus, Loader2, UserCog, FileText,
  ChevronDown, CheckCheck, Paperclip, Mic, Square, X, Image as ImageIcon, Play, Pause, MessageSquare, Trash2, Bot, Calendar as CalendarIcon
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { MessageShortcuts } from '@/components/MessageShortcuts';
import type { Lead, Message, LeadStatus, SystemConfig, User, MediaType } from '@/types/database';
import { ClientDetailsSheet } from '@/components/ClientDetailsSheet';
import { MoreVertical } from 'lucide-react';

const TIMEZONE = 'America/Sao_Paulo';

// Função getSaoPauloTimestamp importada de @/lib/utils


const EVOLUTION_API_URL = 'https://evo.advfunnel.com.br';
const EVOLUTION_API_KEY = 'ESWH6B36nhfW3apMfQQAv3SU2CthsZCg';

export const statusColors: Record<string, string> = {
  'Oportunidade': 'bg-slate-500/20 text-slate-400',
  'Atendendo': 'bg-yellow-500/20 text-yellow-400',
  'Proposta': 'bg-blue-500/20 text-blue-400',
  'Follow Up': 'bg-orange-500/20 text-orange-400',
  'Agendado': 'bg-teal-500/20 text-teal-400',
  'Pós Venda': 'bg-purple-500/20 text-purple-400',
};

export const statusLabels: Record<string, string> = {
  'Oportunidade': 'Oportunidade',
  'Atendendo': 'Atendendo',
  'Proposta': 'Proposta',
  'Follow Up': 'Follow Up',
  'Agendado': 'Agendado',
  'Pós Venda': 'Pós Venda',
};

export const avatarColors = [
  'bg-primary',
  'bg-success',
  'bg-warning',
  'bg-destructive',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

type FilterType = 'all' | 'unread' | LeadStatus;

interface LeadWithMessages extends Lead {
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  notes?: string;
}

export default function Conversas() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Helper to display phone
  const displayPhone = (phone: string, assignedTo?: string | null) => {
    const cleanPhone = phone?.split('@')[0] || '';
    if (role === 'admin' || (user && assignedTo === user.id)) return cleanPhone;
    return maskPhone(cleanPhone);
  };

  const [leads, setLeads] = useState<LeadWithMessages[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithMessages | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [inputText, setInputText] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Ref to track selected lead inside stale closures of useEffect
  const selectedLeadRef = useRef<LeadWithMessages | null>(null);

  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  // Shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcutSearch, setShortcutSearch] = useState('');

  // New conversation modal
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Users list for assignment
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Sheet state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(''); // Kept for legacy compatibility or removal
  const [savingNotes, setSavingNotes] = useState(false); // Kept for legacy compatibility or removal

  // Instance management
  const [activeInstances, setActiveInstances] = useState<{ instance_name: string }[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');

  useEffect(() => {
    (supabase as any)
      .from('instances')
      .select('instance_name')
      .eq('status', 'connected')
      .eq('provider', 'evolution')
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setActiveInstances(data);
          setSelectedInstance(data[0].instance_name);
        }
      });
  }, []);



  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Simplified handlers for Sheet
  const handleUpdateLead = async (updates: Partial<Lead>) => {
    if (!selectedLead) return;

    const { error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', selectedLead.id);

    if (error) {
      toast.error('Erro ao atualizar lead');
    } else {
      toast.success('Lead atualizado');
      // fetchLeads(); // Optimized: update local state instead if possible, but fetch is safer
      fetchLeads();
    }
  };

  // Clear History Wrapper
  const handleClearHistoryWrapper = async () => {
    if (!selectedLead) return;
    // Confirmation handled in ClientDetailsSheet

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('lead_id', selectedLead.id);

    if (error) {
      toast.error('Erro ao limpar histórico');
    } else {
      toast.success('Histórico limpo');
      setMessages([]);
      fetchLeads();
      setDetailsOpen(false);
    }
  };

  // Delete Lead Wrapper
  const handleDeleteLeadWrapper = async () => {
    if (!selectedLead) return;
    // Confirmation handled in ClientDetailsSheet

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', selectedLead.id);

    if (error) {
      toast.error('Erro ao excluir lead');
    } else {
      toast.success('Lead excluído');
      setSelectedLead(null);
      setDetailsOpen(false);
      setShowMobileChat(false); // Close mobile chat if open
      navigate('/chat'); // Redirect to conversations page
      fetchLeads();
    }
  };

  // Audio player states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isCancelledRef = useRef<boolean>(false);

  // Fetch leads with last message and unread count
  const fetchLeads = async () => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });

    // Filter leads based on user role
    // Non-admin users should only see leads assigned to them
    if (role !== 'admin' && user) {
      query = query.eq('assigned_to', user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      const leadsWithMessages = await Promise.all(
        (data as Lead[]).map(async (lead) => {
          const { data: msgData } = await supabase
            .from('messages')
            .select('message_text, media_type, timestamp')
            .eq('lead_id', lead.id)
            .order('timestamp', { ascending: false })
            .limit(1);

          const lastMsgData = (msgData as any)?.[0];

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', lead.id)
            .eq('direction', 'inbound')
            .eq('read', false);

          let lastMessage = lastMsgData?.message_text || '';
          if (lastMsgData?.media_type === 'audio') lastMessage = '🎤 Áudio';
          else if (lastMsgData?.media_type === 'image') lastMessage = '📷 Imagem';
          else if (lastMsgData?.media_type === 'video') lastMessage = '🎬 Vídeo';
          else if (lastMsgData?.media_type === 'document') lastMessage = '📄 Documento';

          return {
            ...lead,
            last_message: lastMessage,
            last_message_time: lastMsgData?.timestamp || lead.updated_at,
            unread_count: count || 0,
          };
        })
      );

      const sortedLeads = leadsWithMessages.sort((a, b) => {
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        return timeB - timeA;
      });

      setLeads(sortedLeads);
    }
    setLoadingLeads(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('app_profiles').select('*');
    if (data) setAllUsers(data as User[]);
  };

  const fetchMessages = async (leadId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);


      // Use RPC instead of direct update to bypass potential RLS issues
      await (supabase.rpc as any)('mark_messages_read', { p_lead_id: leadId });

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, unread_count: 0 } : lead
        )
      );
    }
    setLoadingMessages(false);
  };

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchLeads();
    // Allow all users to fetch profiles for name mapping
    fetchUsers();

    // Consolidated global channel for both leads and messages
    const globalChannel = supabase
      .channel('global-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          // console.log('Lead change received:', payload); // Debug log
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead;

            // DEDUPLICAÇÃO DE SEGURANÇA:
            // Precisamos checar o estado atual antes de prosseguir com chamadas de API desnecessárias.
            // Para isso, usamos setLeads com callback para verificar a existência.

            setLeads(prev => {
              if (prev.some(l => l.id === newLead.id)) {
                console.log('Lead duplicated ignored:', newLead.id);
                return prev;
              }

              // Se não existe, precisamos buscar a última mensagem e adicionar.
              // Como não podemos fazer async dentro do setState, fazemos a busca fora
              // MAS, para evitar conflito visual imediato, já adicionamos o lead cru
              // e atualizamos ele depois.

              // TODO: Idealmente refatorar para buscar dados antes, mas isso exige state management mais complexo.
              // Por hora, vamos confiar que se o REST já trouxe, o 'if' acima barrou.
              // Se for REALMENTE novo (criado agora), ele passa.

              // Nota: A lógica original tentava buscar mensagens. Isso é arriscado no Realtime.
              // Vamos adicionar o lead simples primeiro.
              return [newLead as LeadWithMessages, ...prev];
            });

            // Busca dados complementares em segundo plano e atualiza se necessário
            if (role === 'admin' || newLead.assigned_to === user?.id) {
              supabase
                .from('messages')
                .select('message_text, media_type, timestamp')
                .eq('lead_id', newLead.id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single()
                .then(({ data: lastMsgData }) => {
                  // Atualiza o lead na lista com a mensagem, SE ele ainda estiver lá
                  if (lastMsgData) {
                    setLeads(current => current.map(l => {
                      if (l.id === newLead.id) {
                        return {
                          ...l,
                          last_message: lastMsgData.message_text || (lastMsgData.media_type ? 'Mídia' : ''),
                          last_message_time: lastMsgData.timestamp
                        };
                      }
                      return l;
                    }));
                  }
                });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLead = payload.new as Lead;
            setLeads((prev) =>
              prev.map((lead) =>
                lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setLeads((prev) => prev.filter((lead) => lead.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // console.log('Global message received:', payload); // Debug log
          const newMessage = payload.new as Message;

          setLeads((prev) => {
            const updated = prev.map(lead => {
              if (lead.id === newMessage.lead_id) {
                let lastMessage = newMessage.message_text;
                if (newMessage.media_type === 'audio') lastMessage = '🎤 Áudio';
                else if (newMessage.media_type === 'image') lastMessage = '📷 Imagem';
                else if (newMessage.media_type === 'video') lastMessage = '🎬 Vídeo';
                else if (newMessage.media_type === 'document') lastMessage = '📄 Documento';

                // Check if this lead is currently currently open using the ref
                const isCurrentConversation = selectedLeadRef.current?.id === newMessage.lead_id;

                // Should we increment unread count?
                // Only if it's inbound, unread, AND NOT the current conversation
                const shouldIncrement = newMessage.direction === 'inbound' &&
                  !newMessage.read &&
                  !isCurrentConversation;

                // Use effect side-effect: If it IS the current conversation, mark as read in DB immediately
                // Use effect side-effect: If it IS the current conversation, mark as read in DB immediately
                if (isCurrentConversation && newMessage.direction === 'inbound' && !newMessage.read) {
                  (supabase.rpc as any)('mark_messages_read', { p_lead_id: newMessage.lead_id })
                    .then(({ error }: any) => {
                      if (error) console.error('Error marking new message as read:', error);
                    });
                }

                return {
                  ...lead,
                  last_message: lastMessage,
                  last_message_time: newMessage.timestamp,
                  unread_count: shouldIncrement
                    ? (lead.unread_count || 0) + 1
                    : lead.unread_count,
                  updated_at: newMessage.timestamp
                };
              }
              return lead;
            });

            // Update messages list if it belongs to current conversation
            if (selectedLeadRef.current && newMessage.lead_id === selectedLeadRef.current.id) {
              setMessages((prev) => {
                // Deduplicação Inteligente:
                const idExists = prev.some(m => m.id === newMessage.id);
                if (idExists) return prev;

                if (newMessage.direction === 'outbound') {
                  const contentDuplicate = prev.some(m =>
                    m.direction === 'outbound' &&
                    m.message_text === newMessage.message_text &&
                    Math.abs(new Date(m.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 60000
                  );
                  if (contentDuplicate) return prev;
                }

                // Substitui mensagem temporária pela real se encontrar match (fallback)
                const isTempReplace = prev.some(m => m.id.startsWith('temp-') && m.message_text === newMessage.message_text);
                if (isTempReplace) {
                  return prev.map(m =>
                    (m.id.startsWith('temp-') && m.message_text === newMessage.message_text)
                      ? newMessage
                      : m
                  );
                }

                return [...prev, newMessage];
              });
            }

            // Re-sort to put newest conversations first
            return updated.sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        console.log('Global subscription status:', status);
      });

    return () => {
      console.log('Cleaning up global subscription');
      supabase.removeChannel(globalChannel);
    };
  }, [role, user?.id]);

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);
    }
  }, [selectedLead]);

  // Use layout effect to scroll before paint to avoid visual jump
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages, selectedLead]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    if (value.startsWith('/')) {
      setShowShortcuts(true);
      setShortcutSearch(value);
    } else {
      setShowShortcuts(false);
      setShortcutSearch('');
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  };

  const handleShortcutSelect = (content: string) => {
    setInputText(content);
    setShowShortcuts(false);
    setShortcutSearch('');
    textareaRef.current?.focus();
  };

  const uploadMediaToStorage = async (file: Blob, fileName: string): Promise<string | null> => {
    try {
      const folder = selectedLead?.id || 'unknown';
      const filePath = `${folder}/${Date.now()}-${fileName}`;
      const { error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, {
          contentType: file.type || 'audio/mpeg'
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  };

  // Handle Date Selection
  const handleDateSelect = async (date: Date | undefined) => {
    if (!selectedLead) return;

    // Optimistic update
    const updatedLead = { ...selectedLead, cleaning_date: date?.toISOString() || null };
    setSelectedLead(updatedLead);
    setLeads(leads.map(l => l.id === selectedLead.id ? updatedLead : l));

    const { error } = await supabase
      .from('leads')
      .update({ cleaning_date: date?.toISOString() || null })
      .eq('id', selectedLead.id);

    if (error) {
      toast.error('Erro ao atualizar data');
    } else {
      toast.success('Data atualizada!');
    }
  };

  const sendMessage = async (text?: string, mediaUrl?: string, mediaType?: MediaType) => {
    const messageText = text?.trim() || inputText.trim();
    if (!messageText && !mediaUrl) return;
    if (!selectedLead) return;

    // Generate timestamp once to use for both local state and database
    const timestamp = getSaoPauloTimestamp();

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      lead_id: selectedLead.id,
      phone: selectedLead.phone,
      whatsapp_id: null,
      message_text: messageText,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      direction: 'outbound',
      sender_name: 'Você',
      timestamp: timestamp,
      read: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    if (!mediaUrl) {
      setInputText('');
      setShowShortcuts(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    setSendingMessage(true);
    try {
      // Use selected instance or fallback to first available
      let instanceName = selectedInstance || activeInstances?.[0]?.instance_name;

      if (!instanceName) {
        // Fallback fetch logic if state is empty
        const { data: instancesData } = await supabase
          .from('instances')
          .select('instance_name')
          .eq('status', 'connected')
          .eq('provider', 'evolution')
          .limit(1);
        instanceName = instancesData?.[0]?.instance_name || '';
      }

      // 2. Sempre tenta enviar via API se configurado
      if (instanceName) {
        try {
          if (mediaUrl && mediaType) {
            if (mediaType === 'audio') {
              await fetch(`${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${instanceName}`, {
                method: 'POST',
                headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: selectedLead.phone, audio: mediaUrl }),
              });
            } else {
              await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
                method: 'POST',
                headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  number: selectedLead.phone,
                  mediatype: mediaType,
                  media: mediaUrl,
                  caption: messageText || undefined,
                }),
              });
            }
          } else {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: selectedLead.phone, text: messageText }),
            });
          }
        } catch (apiError) {
          console.error('Erro ao enviar via API:', apiError);
        }
      } else {
        console.error('Instância não configurada/conectada. Mensagem salva apenas no banco.');
        toast.warning('WhatsApp desconectado. Mensagem salva apenas no sistema.');
      }

      // 2. SEMPRE insere no banco para garantir histórico (Confiabilidade > Duplicidade temporária)
      await supabase.from('messages').insert([{
        lead_id: selectedLead.id,
        phone: selectedLead.phone,
        whatsapp_id: null,
        message_text: messageText,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        direction: 'outbound',
        sender_name: 'Você',
        timestamp: timestamp,
        read: true,
      }] as never);


      // Atualiza o lead de qualquer forma para o update_at subir
      await supabase
        .from('leads')
        .update({ updated_at: timestamp } as never)
        .eq('id', selectedLead.id);

      const lastMsg = mediaType === 'audio' ? '🎤 Áudio' : mediaType === 'image' ? '📷 Imagem' : messageText;
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === selectedLead.id
            ? { ...lead, last_message: lastMsg, updated_at: timestamp }
            : lead
        )
      );
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      if (!mediaUrl) setInputText(messageText);
      toast.error('Erro ao enviar mensagem');
    }
    setSendingMessage(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showShortcuts) return;
    // Enter key sends removed intentionally to allow line breaks on all devices
  };

  // Media handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLead) return;

    setUploadingMedia(true);
    try {
      const mediaType: MediaType = file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('video/') ? 'video' :
          file.type.startsWith('audio/') ? 'audio' : 'document';

      const mediaUrl = await uploadMediaToStorage(file, file.name);
      if (mediaUrl) {
        await sendMessage('', mediaUrl, mediaType);
      } else {
        toast.error('Erro ao fazer upload do arquivo');
      }
    } catch {
      toast.error('Erro ao enviar arquivo');
    }
    setUploadingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Basic mime type detection - Let browser pick if it supports it, or use standard fallbacks
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

      console.log('Selected MIME type:', mimeType);

      // Create AudioContext strictly for monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);

      // Monitor volume for debugging
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Critical for Mac: Context often starts 'suspended'
      if (audioContext.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        await audioContext.resume();
      }

      const checkVolume = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        // Log even 0.00 so we know the sensor is active
        console.log(`[Debug] Mic Status: ${audioContext.state}, Level: ${average.toFixed(2)}`);
      }, 1000);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          console.log(`Audio chunk received: ${e.data.size} bytes`);
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped. Total chunks:', audioChunksRef.current.length);
        clearInterval(checkVolume);
        audioContext.close();

        if (isCancelledRef.current) {
          console.log('Recording was cancelled, skipping upload.');
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Use the actual mime type from the recorder or the one we selected
        const finalMimeType = mediaRecorder.mimeType || mimeType;
        const ext = finalMimeType.includes('mp4') ? 'm4a' : (finalMimeType.includes('webm') ? 'webm' : 'ogg');

        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        stream.getTracks().forEach(track => track.stop());

        console.log(`Created audio blob: ${audioBlob.size} bytes, type: ${finalMimeType}`);

        if (audioBlob.size < 1000) {
          console.error('Audio blob too small or empty', audioBlob.size);
          toast.error('O áudio parece estar sem som. Por favor, verifique se seu microfone está funcionando e se o volume está alto o suficiente.');
          return;
        }

        setUploadingMedia(true);
        const mediaUrl = await uploadMediaToStorage(audioBlob, `audio.${ext}`);
        if (mediaUrl) {
          await sendMessage('', mediaUrl, 'audio');
        } else {
          toast.error('Erro ao enviar áudio');
        }
        setUploadingMedia(false);
      };

      isCancelledRef.current = false;
      // Start immediately but with a small timeslice to ensure data flow
      mediaRecorder.start(1000);

      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio player functions
  const toggleAudioPlay = async (messageId: string, audioUrl: string) => {
    try {
      if (!audioUrl || audioUrl === 'null' || audioUrl === 'undefined' || !audioUrl.startsWith('http')) {
        toast.error('Áudio ainda não disponível ou inválido');
        return;
      }

      const currentAudio = audioRefs.current.get(messageId);

      if (playingAudioId === messageId && currentAudio) {
        currentAudio.pause();
        setPlayingAudioId(null);
      } else {
        // Pause any currently playing audio
        if (playingAudioId) {
          const prevAudio = audioRefs.current.get(playingAudioId);
          if (prevAudio) prevAudio.pause();
        }

        let audio = currentAudio;
        if (!audio) {
          console.log('Creating new Audio element for:', audioUrl);
          audio = new Audio(audioUrl);
          audio.onended = () => {
            setPlayingAudioId(null);
            setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
          };
          audio.ontimeupdate = () => {
            if (audio && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
              setAudioProgress(prev => ({
                ...prev,
                [messageId]: (audio!.currentTime / audio!.duration) * 100
              }));
            }
          };
          audio.onerror = (e) => {
            console.error('Audio error:', e);
            toast.error('Erro ao reproduzir áudio');
            setPlayingAudioId(null);
            setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
          };
          audioRefs.current.set(messageId, audio);
        }

        console.log('Attempting to play audio:', audioUrl);
        await audio.play();
        setPlayingAudioId(messageId);
        console.log('Audio playing successfully');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('Não foi possível reproduzir o áudio');
      setPlayingAudioId(null);
    }
  };

  const handleNewConversation = async () => {
    if (!newPhone) {
      toast.error('Digite o número de telefone');
      return;
    }

    // Normalize phone number to prevent duplicates
    const phone = normalizePhone(newPhone);

    if (!phone) {
      toast.error('Telefone inválido');
      return;
    }

    setCreatingConversation(true);
    try {
      // 1. Check if lead exists using Secure RPC (bypasses RLS visibility)
      const { data: checkData, error: checkError } = await (supabase.rpc as any)('check_lead_status', { phone_number: phone });

      if (checkError) throw checkError;

      const result = checkData as unknown as { exists: boolean; lead_id?: string; assigned_to_name?: string };

      if (result.exists && result.lead_id) {
        // 2. Lead exists. Can we see it? (RLS check)
        // Try to fetch it standard way
        const { data: visibleLead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', result.lead_id)
          .maybeSingle();

        if (visibleLead) {
          // We own it or are admin -> Open it
          toast.info(`Telefone já cadastrado! Abrindo conversa...`);
          setNewConversationOpen(false);
          setNewPhone('');
          setNewName('');

          const leadWithDetails = { ...visibleLead, last_message: '', unread_count: 0 };
          setLeads(prev => {
            if (prev.some(l => l.id === visibleLead.id)) return prev;
            return [leadWithDetails as any, ...prev];
          });
          setTimeout(() => setSelectedLead(leadWithDetails as any), 100);
          return;
        } else {
          // We CANNOT see it -> It belongs to someone else
          toast.error(`Este telefone já está cadastrado com: ${result.assigned_to_name}`);
          return; // Stop here, don't try to insert
        }
      }

      // 3. Lead does not exist -> Create it
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert([{
          name: newName,
          phone,
          status: 'Novos Leads',
          assigned_to: role === 'admin' ? null : user?.id,
          updated_at: getSaoPauloTimestamp(),
        }])
        .select()
        .single();

      if (error) throw error;

      if (newLead) {
        const leadWithDetails = { ...newLead, last_message: '', unread_count: 0 };
        setLeads((prev) => [leadWithDetails as any, ...prev]);
        setSelectedLead(leadWithDetails as any);
        setNewConversationOpen(false);
        setNewPhone('');
        setNewName('');
        toast.success('Novo lead criado!');
      }
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      if (error.code === '42501') {
        toast.error('Sem permissão para criar leads.');
      } else {
        toast.error(error.message || 'Erro ao criar conversa');
      }
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleMobileBack = () => {
    setShowMobileChat(false);
    setSelectedLead(null);
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!selectedLead) return;

    try {
      await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: getSaoPauloTimestamp() } as never)
        .eq('id', selectedLead.id);

      setSelectedLead({ ...selectedLead, status: newStatus });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: newStatus } : l));
      toast.success('Status atualizado!');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleAssignedChange = async (newAssignedTo: string) => {
    if (!selectedLead || role !== 'admin') return;

    const assignedValue = newAssignedTo === 'none' ? null : newAssignedTo;

    try {
      await supabase
        .from('leads')
        .update({ assigned_to: assignedValue, updated_at: getSaoPauloTimestamp() } as never)
        .eq('id', selectedLead.id);

      setSelectedLead({ ...selectedLead, assigned_to: assignedValue });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, assigned_to: assignedValue } : l));
      toast.success('Responsável atualizado!');
    } catch {
      toast.error('Erro ao atualizar responsável');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedLead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', selectedLead.id);

      if (error) throw error;

      toast.success('Conversa excluída com sucesso');
      setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
      setSelectedLead(null);
      setShowMobileChat(false);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao excluir conversa');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;

    setSavingNotes(true);
    try {
      await supabase
        .from('leads')
        .update({ notes: editingNotes } as never)
        .eq('id', selectedLead.id);

      setSelectedLead({ ...selectedLead, notes: editingNotes });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: editingNotes } : l));
      // setNotesOpen(false); // Undefined
      toast.success('Observações salvas!');
    } catch {
      toast.error('Erro ao salvar observações');
    }
    setSavingNotes(false);
  };

  const handleToggleChange = async (type: 'ai' | 'followup', checked: boolean) => {
    if (!selectedLead) return;

    try {
      const updateData = type === 'ai' ? { ai_enabled: checked } : { followup_enabled: checked };

      const { error } = await supabase
        .from('leads')
        .update({ ...updateData, updated_at: new Date().toISOString() } as never)
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Optimistic update
      const updatedLead = {
        ...selectedLead,
        [type === 'ai' ? 'ai_enabled' : 'followup_enabled']: checked
      };

      setSelectedLead(updatedLead);
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...updateData } : l));

      toast.success(`${type === 'ai' ? 'IA' : 'Follow-up'} ${checked ? 'ativado' : 'desativado'}`);
    } catch (error) {
      console.error('Error toggling settings:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const normalizeTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return new Date().toISOString();

    try {
      // Check for Z or offset (+00:00, -0300) using regex
      if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
        return timestamp;
      }
      return `${timestamp}Z`;
    } catch {
      return new Date().toISOString();
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const normalized = normalizeTimestamp(timestamp);
      const date = new Date(normalized);

      // Check for Invalid Date
      if (isNaN(date.getTime())) return '';

      const now = new Date();
      const msPerDay = 86400000;
      const floorDate = new Date(date.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const floorNow = new Date(now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const daysDiff = Math.floor((floorNow.getTime() - floorDate.getTime()) / msPerDay);

      if (daysDiff === 0) {
        return date.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      if (daysDiff === 1) return 'Ontem';
      return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const normalized = normalizeTimestamp(timestamp);
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return '--:--';

      return date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  };

  const getDateSeparator = (timestamp: string) => {
    try {
      const normalized = normalizeTimestamp(timestamp);
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return '';

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateStr = date.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
      const todayStr = today.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
      const yesterdayStr = yesterday.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

      if (dateStr === todayStr) return 'Hoje';
      if (dateStr === yesterdayStr) return 'Ontem';
      return dateStr;
    } catch {
      return '';
    }
  };

  const getAvatarColor = (name: string | null) => {
    if (!name) return avatarColors[0];
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };



  const truncateMessage = (text: string, maxLength: number = 40) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    // Search filter
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      lead.phone.includes(debouncedSearch);

    if (!matchesSearch) return false;

    // Status/type filter
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return (lead.unread_count || 0) > 0;
    return lead.status === activeFilter;
  });

  // Count for filter badges
  const filterCounts = {
    all: leads.length,
    unread: leads.filter(l => (l.unread_count || 0) > 0).length,
    novo: leads.filter(l => l.status === 'novo').length,
    em_atendimento: leads.filter(l => l.status === 'em_atendimento').length,
    aguardando: leads.filter(l => l.status === 'aguardando').length,
    ganho: leads.filter(l => l.status === 'ganho').length,
    perdido: leads.filter(l => l.status === 'perdido').length,
  };

  // Sort messages by timestamp to ensure correct interleaving
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) =>
      new Date(normalizeTimestamp(a.timestamp)).getTime() - new Date(normalizeTimestamp(b.timestamp)).getTime()
    );
  }, [messages]);

  const groupedMessages = sortedMessages.reduce((acc, message, index) => {
    const date = getDateSeparator(message.timestamp);
    const prevMessage = sortedMessages[index - 1];
    const prevDate = prevMessage ? getDateSeparator(prevMessage.timestamp) : null;

    if (date !== prevDate) {
      acc.push({ type: 'separator' as const, date });
    }
    acc.push({ type: 'message' as const, message });
    return acc;
  }, [] as Array<{ type: 'separator'; date: string } | { type: 'message'; message: Message }>);

  const getAssignedUserName = (assignedTo: string | null) => {
    if (!assignedTo) return 'Não atribuído';
    const u = allUsers.find(u => u.id === assignedTo);
    return u?.name || 'Desconhecido';
  };

  // Render media content
  const renderMediaContent = (message: Message) => {
    if (!message.media_url) return null;

    if (message.media_type === 'audio') {
      return (
        <div className="flex items-center gap-2 min-w-[200px] bg-background/20 rounded-full px-3 py-2">
          <button
            onClick={() => toggleAudioPlay(message.id, message.media_url!)}
            className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0"
          >
            {playingAudioId === message.id ? (
              <Pause className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
            )}
          </button>
          <div className="flex-1 h-1 bg-muted-foreground/30 rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${audioProgress[message.id] || 0}%` }}
            />
          </div>
        </div>
      );
    }

    if (message.media_type === 'image') {
      // Proxy WhatsApp URLs to avoid CORS issues
      const mediaUrl = message.media_url || '';
      const imageUrl = mediaUrl.includes('whatsapp.net')
        ? `https://images.weserv.nl/?url=${encodeURIComponent(mediaUrl)}`
        : mediaUrl;

      return (
        <div
          className="rounded-lg overflow-hidden cursor-pointer max-w-[280px]"
          onClick={() => window.open(message.media_url!, '_blank')}
        >
          <img
            src={imageUrl}
            alt="Imagem"
            className="w-full h-auto max-h-[300px] object-contain"
            loading="lazy"
            crossOrigin="anonymous"
            onLoad={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }}
            onError={(e) => {
              console.error('Erro ao carregar imagem:', message.media_url);
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3EImagem indisponível%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>
      );
    }

    if (message.media_type === 'video') {
      return (
        <video
          src={message.media_url}
          controls
          className="rounded-lg max-w-[280px] max-h-[300px]"
          preload="metadata"
        />
      );
    }

    if (message.media_type === 'document') {
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-background/20 rounded-lg px-3 py-2 hover:bg-background/30 transition-colors"
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm underline">Abrir documento</span>
        </a>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex bg-background overflow-hidden relative">
      {/* Conversations Sidebar - Always visible on desktop (md+), hidden on mobile when chat is open */}
      <div
        className={cn(
          'w-full md:w-[340px] lg:w-[380px] h-full border-r border-border flex flex-col bg-card',
          'md:flex', // Always show on desktop
          showMobileChat && 'hidden md:flex' // Hide on mobile when chat open, but keep on desktop
        )}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border safe-area-top bg-card z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-6 bg-secondary text-secondary-foreground">{leads.length}</Badge>
              <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 touch-manipulation">
                    <Plus className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Nova Conversa</DialogTitle>
                    <DialogDescription>Inicie uma conversa com qualquer número</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Telefone *</Label>
                      <Input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="h-12 bg-secondary border-border"
                        type="tel"
                        inputMode="tel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome (opcional)</Label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nome do contato"
                        className="h-12 bg-secondary border-border"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setNewConversationOpen(false)} className="h-12 w-full sm:w-auto">Cancelar</Button>
                    <Button onClick={handleNewConversation} disabled={creatingConversation} className="h-12 w-full sm:w-auto bg-primary hover:bg-primary/90">
                      {creatingConversation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        'Iniciar Conversa'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-secondary border-0 rounded-lg text-base"
            />
          </div>

          {/* Filters - no visible scrollbar */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                Todas {filterCounts.all > 0 && `(${filterCounts.all})`}
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
                  activeFilter === 'unread'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                Não lidas {filterCounts.unread > 0 && `(${filterCounts.unread})`}
              </button>
              {(Object.keys(statusLabels) as LeadStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
                    activeFilter === status
                      ? statusColors[status]
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {statusLabels[status]} {filterCounts[status] > 0 && `(${filterCounts[status]})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin overscroll-contain">
          {loadingLeads ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setSelectedLead(lead);
                  setShowMobileChat(true);
                }}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors border-b border-border/30 touch-manipulation active:bg-secondary min-h-[72px]',
                  selectedLead?.id === lead.id && 'bg-secondary'
                )}
              >
                <Avatar className={cn('h-12 w-12 shrink-0', getAvatarColor(lead.name))}>
                  <AvatarFallback className="text-primary-foreground font-medium">
                    {getInitials(lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground truncate">{lead.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(lead.last_message_time || lead.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate pr-2">
                      {lead.last_message ? truncateMessage(lead.last_message) : displayPhone(lead.phone, lead.assigned_to)}
                    </p>
                    {lead.unread_count && lead.unread_count > 0 ? (
                      <Badge className="h-5 min-w-[20px] bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5">
                        {lead.unread_count > 99 ? '99+' : lead.unread_count}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 min-w-0 h-full grid grid-rows-[auto_1fr_auto]',
          'hidden', // Hidden by default
          'md:grid', // Always shown on desktop (side by side with list)
          showMobileChat && 'grid fixed inset-0 h-[100dvh] w-full max-w-full overflow-hidden grid-cols-1 z-[60] bg-background md:relative md:z-auto md:h-full' // Fullscreen on mobile (dvh for keyboard), normal on desktop
        )}
      >
        {selectedLead ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="relative px-2 py-2 md:px-4 md:py-2.5 border-b border-border flex items-center justify-between bg-card safe-area-top z-[100]">
              {/* Left Group: Back + Avatar + Info */}
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 mr-2">
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleMobileBack}
                  className="md:hidden h-10 w-10 min-w-[40px] touch-manipulation shrink-0 bg-primary hover:bg-primary/90 rounded-full"
                >
                  <ArrowLeft className="h-5 w-5 text-primary-foreground" />
                </Button>
                <div
                  className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    console.log('Opening details from Avatar');
                    setDetailsOpen(true);
                  }}
                >
                  <Avatar className={cn('h-10 w-10 shrink-0', getAvatarColor(selectedLead.name))}>
                    <AvatarFallback className="text-primary-foreground font-medium text-sm">
                      {getInitials(selectedLead.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm text-foreground leading-tight">{selectedLead.name || displayPhone(selectedLead.phone, selectedLead.assigned_to)}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedLead.name ? displayPhone(selectedLead.phone, selectedLead.assigned_to) : ''}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Instance Selector */}
                {activeInstances.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-secondary" title={`Instância: ${selectedInstance}`}>
                        <MessageSquare className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-popover border-border z-[200]" align="end">
                      <div className="space-y-1">
                        <h4 className="font-medium text-xs px-2 mb-2 text-foreground">Enviar via:</h4>
                        {activeInstances.map(inst => (
                          <Button
                            key={inst.instance_name}
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-xs h-8 px-2 font-normal truncate",
                              selectedInstance === inst.instance_name && "bg-secondary font-medium"
                            )}
                            onClick={() => setSelectedInstance(inst.instance_name)}
                          >
                            {inst.instance_name}
                            {selectedInstance === inst.instance_name && <CheckCheck className="ml-auto h-3 w-3" />}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Automations Settings */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground hover:bg-secondary">
                      <Bot className={cn("h-5 w-5", selectedLead.ai_enabled ? "text-primary" : "text-muted-foreground")} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3 bg-popover border-border z-[200]" align="end">
                    <div className="space-y-3">
                      <h4 className="font-medium leading-none mb-2 text-sm text-foreground">Automações</h4>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ai-toggle" className="text-sm cursor-pointer">IA Ativa</Label>
                        <Switch
                          id="ai-toggle"
                          checked={selectedLead.ai_enabled}
                          onCheckedChange={(checked) => handleToggleChange('ai', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="followup-toggle" className="text-sm cursor-pointer">Follow-up</Label>
                        <Switch
                          id="followup-toggle"
                          checked={selectedLead.followup_enabled}
                          onCheckedChange={(checked) => handleToggleChange('followup', checked)}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-2">
                        Controle o comportamento automático para este lead.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Status Badge */}
                {/* Status Badge Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 gap-1 touch-manipulation text-foreground hover:bg-secondary"
                    >
                      <Badge className={cn('text-[10px] px-1.5', statusColors[selectedLead.status] || 'bg-secondary text-foreground')}>
                        {statusLabels[selectedLead.status] || selectedLead.status}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-popover border-border z-[200]" align="end">
                    <div className="grid gap-1">
                      <span className="font-medium text-xs mb-1 px-2">Alterar Status</span>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "justify-start text-xs h-8 px-2 font-normal",
                            selectedLead.status === key && "bg-secondary font-medium"
                          )}
                          onClick={() => {
                            handleUpdateLead({ status: key });
                            // Popover closes automatically on interaction/click-away usually, or we can use a state if needed.
                            // But radix popover usually stays open unless closed. Ideally usage of `DialogClose` or controlling state.
                            // For simplicity, we can let it be or use a wrapper.
                            // Let's try adding a small delay or just rely on the user clicking away?
                            // Actually, standard behavior is fine, or we can use the `open` prop if we want to force close.
                            // But let's stick to simple first.
                            document.body.click(); // Hacky way to close popovers? No.
                            // Let's simply call update.
                          }}
                        >
                          <div className={cn('w-2 h-2 rounded-full mr-2', statusColors[key]?.split(' ')[0] || 'bg-slate-500')} />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* More Options / Details Sheet Trigger */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setDetailsOpen(true)}
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>

            </div>


            {/* Messages */}
            <div className="min-h-0 w-full max-w-full overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin overscroll-contain chat-pattern">
              {loadingMessages ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}
                    >
                      <Skeleton className="h-14 w-56 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                  <p className="text-sm text-muted-foreground">
                    Envie uma mensagem para iniciar
                  </p>
                </div>
              ) : (
                groupedMessages.map((item, index) =>
                  item.type === 'separator' ? (
                    <div key={`sep - ${index} `} className="flex justify-center py-2">
                      <span className="text-xs text-muted-foreground bg-secondary/80 px-3 py-1 rounded-lg">
                        {item.date}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={`${item.message.id}-${index}`}
                      className={cn(
                        'flex',
                        item.message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] sm:max-w-[85%] md:max-w-[70%] px-3 py-2 animate-scale-in shadow-sm break-words',
                          item.message.direction === 'outbound'
                            ? 'message-bubble-outbound'
                            : 'message-bubble-inbound',
                          item.message.id.startsWith('temp-') && 'opacity-70'
                        )}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                      >
                        {/* Removed sender_name display - was showing WhatsApp contact names */}
                        {/* {item.message.direction === 'inbound' && item.message.sender_name !== selectedLead.name && (
                          <p className="text-xs font-medium text-primary mb-1">
                            {item.message.sender_name}
                          </p>
                        )} */}

                        {/* Media content */}
                        {renderMediaContent(item.message)}

                        {/* Text content */}
                        {item.message.message_text && (
                          <p className="text-sm whitespace-pre-wrap break-words text-foreground">
                            {item.message.message_text}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[11px] text-chat-timestamp">
                            {formatTime(item.message.timestamp)}
                          </span>
                          {item.message.direction === 'outbound' && (
                            <CheckCheck className={cn(
                              'h-4 w-4',
                              item.message.id.startsWith('temp-') ? 'text-chat-timestamp' : 'text-primary'
                            )} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Fixed */}
            <div className="relative px-2 py-2 md:px-3 md:py-2.5 border-t border-border bg-card safe-area-bottom z-10">
              <MessageShortcuts
                isOpen={showShortcuts}
                searchText={shortcutSearch}
                onSelect={handleShortcutSelect}
                onClose={() => setShowShortcuts(false)}
              />

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isRecording ? (
                // Recording UI
                <div className="flex items-center gap-3 bg-secondary rounded-3xl px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelRecording();
                    }}
                    className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm font-medium">{formatRecordingTime(recordingTime)}</span>
                    <span className="text-sm text-muted-foreground">Gravando...</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      stopRecording();
                    }}
                    className="h-12 w-12 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Square className="h-5 w-5 text-primary-foreground fill-current" />
                  </button>
                </div>
              ) : (
                // Normal input UI
                <div className="flex items-end gap-2">
                  {/* Attach button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia || sendingMessage}
                    className="h-12 w-12 rounded-full shrink-0 touch-manipulation text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    {uploadingMedia ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Paperclip className="h-5 w-5" />
                    )}
                  </Button>

                  <div className="flex-1 relative min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua mensagem..."
                      rows={1}
                      className="w-full resize-none rounded-3xl bg-secondary border-0 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px] max-h-[120px] overflow-y-auto leading-normal"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  {inputText.trim() ? (
                    <Button
                      onClick={() => sendMessage()}
                      disabled={sendingMessage}
                      className="h-12 w-12 min-w-[48px] rounded-full shrink-0 touch-manipulation active:scale-95 transition-transform bg-primary hover:bg-primary/90"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      disabled={sendingMessage || uploadingMedia}
                      className="h-12 w-12 min-w-[48px] rounded-full shrink-0 touch-manipulation active:scale-95 transition-transform bg-primary hover:bg-primary/90"
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 chat-pattern">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Selecione uma conversa</p>
            <p className="text-muted-foreground">
              Escolha um contato da lista para ver as mensagens
            </p>
          </div>
        )}
      </div>
      {/* Client Details Sheet (Replaces old modals) */}
      <ClientDetailsSheet
        lead={selectedLead}
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onUpdateLead={handleUpdateLead}
        onDeleteLead={handleDeleteLeadWrapper}
        onClearHistory={handleClearHistoryWrapper}
        allUsers={allUsers}
        role={role === 'admin' ? 'admin' : 'user'}
      />

      {/* New Lead/Conversation Dialogs would be here too... */}
    </div >
  );
}

function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
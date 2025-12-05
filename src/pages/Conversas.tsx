import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
// ... existing imports ...

// ... inside formatTime function ...
return date.toLocaleTimeString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { normalizePhone } from '@/lib/phoneUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ChevronDown, CheckCheck, Paperclip, Mic, Square, X, Image as ImageIcon, Play, Pause
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { MessageShortcuts } from '@/components/MessageShortcuts';
import type { Lead, Message, LeadStatus, SystemConfig, User, MediaType } from '@/types/database';

const TIMEZONE = 'America/Sao_Paulo';

// Gera timestamp no fuso horário de São Paulo (UTC-3)
const getSaoPauloTimestamp = (): string => {
  const now = new Date();
  // Adjust to Sao Paulo (UTC-3)
  const offset = -3 * 60; // -180 minutes
  const saoPauloDate = new Date(now.getTime() + offset * 60 * 1000);
  return saoPauloDate.toISOString().replace('Z', '-03:00');
};

const statusColors: Record<LeadStatus, string> = {
  novo: 'bg-primary/20 text-primary',
  em_atendimento: 'bg-warning/20 text-warning',
  aguardando: 'bg-purple-500/20 text-purple-400',
  ganho: 'bg-success/20 text-success',
  perdido: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<LeadStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em Atendimento',
  aguardando: 'Aguardando',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

const avatarColors = [
  'bg-primary',
  'bg-success',
  'bg-warning',
  'bg-destructive',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

type FilterType = 'all' | 'unread' | LeadStatus;

interface LeadWithMessages extends Lead {
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  notes?: string;
}

export default function Conversas() {
  const { user, role } = useAuth();
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

  // Notes modal
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Audio player states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Fetch leads with last message and unread count
  const fetchLeads = async () => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });

    if (role !== 'admin' && user) {
      query = query.eq('assigned_to', user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      const leadsWithMessages = await Promise.all(
        (data as Lead[]).map(async (lead) => {
          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('message_text, media_type, timestamp')
            .eq('lead_id', lead.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

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

      setLeads(leadsWithMessages);
    }
    setLoadingLeads(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
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
      await supabase
        .from('messages')
        .update({ read: true } as never)
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .eq('read', false);

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
    if (role === 'admin') {
      fetchUsers();
    }

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
          console.log('Lead change received:', payload); // Debug log
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead;
            if (role === 'admin' || newLead.assigned_to === user?.id) {
              const { data: lastMsgData } = await supabase
                .from('messages')
                .select('message_text, media_type, timestamp')
                .eq('lead_id', newLead.id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

              const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('lead_id', newLead.id)
                .eq('direction', 'inbound')
                .eq('read', false);

              let lastMessage = lastMsgData?.message_text || '';
              if (lastMsgData?.media_type === 'audio') lastMessage = '🎤 Áudio';
              else if (lastMsgData?.media_type === 'image') lastMessage = '📷 Imagem';
              else if (lastMsgData?.media_type === 'video') lastMessage = '🎬 Vídeo';
              else if (lastMsgData?.media_type === 'document') lastMessage = '📄 Documento';

              const leadWithMessages = {
                ...newLead,
                last_message: lastMessage,
                last_message_time: lastMsgData?.timestamp || newLead.updated_at,
                unread_count: count || 0,
              };

              setLeads((prev) => [leadWithMessages, ...prev]);
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
          console.log('Global message received:', payload); // Debug log
          const newMessage = payload.new as Message;

          setLeads((prev) => {
            const updated = prev.map(lead => {
              if (lead.id === newMessage.lead_id) {
                let lastMessage = newMessage.message_text;
                if (newMessage.media_type === 'audio') lastMessage = '🎤 Áudio';
                else if (newMessage.media_type === 'image') lastMessage = '📷 Imagem';
                else if (newMessage.media_type === 'video') lastMessage = '🎬 Vídeo';
                else if (newMessage.media_type === 'document') lastMessage = '📄 Documento';

                return {
                  ...lead,
                  last_message: lastMessage,
                  last_message_time: newMessage.timestamp,
                  unread_count: newMessage.direction === 'inbound' && !newMessage.read
                    ? (lead.unread_count || 0) + 1
                    : lead.unread_count,
                  updated_at: newMessage.timestamp
                };
              }
              return lead;
            });

            // Re-sort to put newest conversations first
            return updated.sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
          });
        }
      )
      .subscribe((status) => {
        console.log('Global subscription status:', status); // Connection status log
      });

    return () => {
      console.log('Cleaning up global subscription');
      supabase.removeChannel(globalChannel);
    };
  }, [role, user?.id]);

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);

      const channel = supabase
        .channel(`messages-${selectedLead.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `lead_id=eq.${selectedLead.id}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;

            // Update messages list
            setMessages((prev) => {
              const exists = prev.some(m => m.id === newMessage.id || (m.id.startsWith('temp-') && m.message_text === newMessage.message_text));
              if (exists) {
                return prev.map(m =>
                  (m.id.startsWith('temp-') && m.message_text === newMessage.message_text)
                    ? newMessage
                    : m
                );
              }
              return [...prev, newMessage];
            });
          }
        )
        .subscribe((status) => {
          console.log(`Messages channel ${selectedLead.id} status:`, status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
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
      const filePath = `${selectedLead?.phone}/${Date.now()}-${fileName}`;
      const { error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

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

  const sendMessage = async (text?: string, mediaUrl?: string, mediaType?: MediaType) => {
    const messageText = text?.trim() || inputText.trim();
    if (!messageText && !mediaUrl) return;
    if (!selectedLead) return;

    const timestamp = getSaoPauloTimestamp();

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      lead_id: selectedLead.id,
      phone: selectedLead.phone,
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
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

      const configArray = configs as SystemConfig[] | null;
      const apiUrl = configArray?.find((c) => c.key === 'evolution_api_url')?.value;
      const apiKey = configArray?.find((c) => c.key === 'evolution_api_key')?.value;
      const instance = configArray?.find((c) => c.key === 'evolution_instance_name')?.value;

      if (apiUrl && apiKey && instance) {
        if (mediaUrl && mediaType) {
          if (mediaType === 'audio') {
            // Audio endpoint requires 'audio' field
            await fetch(`${apiUrl}/message/sendWhatsAppAudio/${instance}`, {
              method: 'POST',
              headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: selectedLead.phone,
                audio: mediaUrl,
              }),
            });
          } else {
            // For images, videos, documents - use sendMedia
            await fetch(`${apiUrl}/message/sendMedia/${instance}`, {
              method: 'POST',
              headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: selectedLead.phone,
                mediatype: mediaType,
                media: mediaUrl,
                caption: messageText || undefined,
              }),
            });
          }
        } else {
          // Send text message
          await fetch(`${apiUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: selectedLead.phone,
              text: messageText,
            }),
          });
        }
      }

      await supabase.from('messages').insert([{
        lead_id: selectedLead.id,
        phone: selectedLead.phone,
        message_text: messageText,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        direction: 'outbound',
        sender_name: 'Você',
        timestamp: timestamp,
        read: true,
      }] as never);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setUploadingMedia(true);
        const mediaUrl = await uploadMediaToStorage(audioBlob, 'audio.webm');
        if (mediaUrl) {
          await sendMessage('', mediaUrl, 'audio');
        } else {
          toast.error('Erro ao enviar áudio');
        }
        setUploadingMedia(false);
      };

      mediaRecorder.start();
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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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
  const toggleAudioPlay = (messageId: string, audioUrl: string) => {
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
        audio = new Audio(audioUrl);
        audio.onended = () => setPlayingAudioId(null);
        audioRefs.current.set(messageId, audio);
      }
      audio.play();
      setPlayingAudioId(messageId);
    }
  };

  const handleNewConversation = async () => {
    if (!newPhone) {
      toast.error('Digite o número de telefone');
      return;
    }

    // Normalize phone number to prevent duplicates
    const phone = normalizePhone(newPhone);

    setCreatingConversation(true);
    try {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone)
        .single();

      if (existingLead) {
        setSelectedLead(existingLead as LeadWithMessages);
        setShowMobileChat(true);
        toast.info('Conversa existente selecionada');
      } else {
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert([{
            phone,
            name: newName || phone,
            status: 'novo',
            assigned_to: role === 'admin' ? null : user?.id,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }] as never)
          .select()
          .single();

        if (error) throw error;

        setSelectedLead(newLead as LeadWithMessages);
        setShowMobileChat(true);
        toast.success('Nova conversa criada!');
        fetchLeads();
      }

      setNewConversationOpen(false);
      setNewPhone('');
      setNewName('');
    } catch (error) {
      toast.error('Erro ao criar conversa');
      console.error(error);
    }
    setCreatingConversation(false);
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
      setNotesOpen(false);
      toast.success('Observações salvas!');
    } catch {
      toast.error('Erro ao salvar observações');
    }
    setSavingNotes(false);
  };

  const normalizeTimestamp = (timestamp: string) => {
    if (!timestamp) return new Date().toISOString();

    // Check for Z or offset (+00:00, -0300) using regex
    // Matches Z at end, or +XX:XX, or -XX:XX, or +XXXX, or -XXXX
    if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
      return timestamp;
    }

    // Otherwise assume it's UTC and append Z
    return `${timestamp}Z`;
  };

  // Gera timestamp ISO padrão (o banco converte para UTC e o front converte para SP na exibição)
  const getSaoPauloTimestamp = (): string => {
    return new Date().toISOString();
  };

  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return '';

    const normalized = normalizeTimestamp(timestamp);
    const date = new Date(normalized);
    const now = new Date();

    // Use absolute time difference in days to avoid timezone math complexity
    const msPerDay = 86400000;
    // Normalize both dates to midnight in local time (or consistently in one timezone) to compare "days"
    const floorDate = new Date(date.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const floorNow = new Date(now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' }));

    const daysDiff = Math.floor((floorNow.getTime() - floorDate.getTime()) / msPerDay);

    // Today: show HH:MM
    if (daysDiff === 0) {
      return date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // Yesterday: show "Ontem"
    if (daysDiff === 1) return 'Ontem';

    // Older: show dd/MM/yyyy
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const formatTime = (timestamp: string) => {
    const normalized = normalizeTimestamp(timestamp);
    const date = new Date(normalized);
    return date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  const getDateSeparator = (timestamp: string) => {
    const date = new Date(normalizeTimestamp(timestamp));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
    const todayStr = today.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
    const yesterdayStr = yesterday.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';
    return dateStr;
  };

  const getAvatarColor = (name: string | null) => {
    if (!name) return avatarColors[0];
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
            <div className="h-full w-0 bg-primary rounded-full transition-all" />
          </div>
        </div>
      );
    }

    if (message.media_type === 'image') {
      // Proxy WhatsApp URLs to avoid CORS issues
      const imageUrl = message.media_url?.includes('whatsapp.net')
        ? `https://images.weserv.nl/?url=${encodeURIComponent(message.media_url)}`
        : message.media_url;

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
    <div className="h-full flex bg-background">
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
                      {lead.last_message ? truncateMessage(lead.last_message) : lead.phone}
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

      {/* Chat Area - Side by side on desktop, fullscreen on mobile */}
      <div
        className={cn(
          'flex-1 min-w-0 h-full grid grid-rows-[auto_1fr_auto]',
          'hidden', // Hidden by default
          'md:grid', // Always shown on desktop (side by side with list)
          showMobileChat && 'grid fixed inset-0 z-[60] bg-background md:relative md:z-auto' // Fullscreen on mobile, normal on desktop
        )}
      >
        {selectedLead ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="relative px-2 py-2 md:px-4 md:py-2.5 border-b border-border flex items-center gap-2 md:gap-3 bg-card safe-area-top z-[100]">
              <Button
                variant="default"
                size="icon"
                onClick={handleMobileBack}
                className="md:hidden h-11 w-11 min-w-[44px] touch-manipulation shrink-0 bg-primary hover:bg-primary/90"
              >
                <ArrowLeft className="h-7 w-7 text-primary-foreground" />
              </Button>
              <Avatar className={cn('h-10 w-10 shrink-0', getAvatarColor(selectedLead.name))}>
                <AvatarFallback className="text-primary-foreground font-medium text-sm">
                  {getInitials(selectedLead.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 mr-1">
                <p className="font-medium truncate text-sm text-foreground leading-tight">{selectedLead.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedLead.phone}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Status Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-2 gap-1 touch-manipulation text-foreground hover:bg-secondary">
                      <Badge className={cn('text-[10px] px-1.5', statusColors[selectedLead.status])}>
                        <span className="hidden sm:inline">{statusLabels[selectedLead.status]}</span>
                        <span className="sm:hidden">{statusLabels[selectedLead.status].slice(0, 3)}</span>
                      </Badge>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-popover border-border z-[200]" align="end">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Status</p>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key as LeadStatus)}
                          className={cn(
                            'w-full text-left px-2 py-2.5 rounded-md text-sm hover:bg-secondary transition-colors flex items-center gap-2 touch-manipulation',
                            selectedLead.status === key && 'bg-secondary'
                          )}
                        >
                          <div className={cn('w-2 h-2 rounded-full', statusColors[key as LeadStatus].split(' ')[0])} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Admin: Assigned To */}
                {role === 'admin' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-2 gap-1 touch-manipulation text-foreground hover:bg-secondary">
                        <UserCog className="h-4 w-4" />
                        <span className="hidden lg:inline max-w-[80px] truncate text-xs">
                          {getAssignedUserName(selectedLead.assigned_to)}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-popover border-border z-[200]" align="end">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Responsável</p>
                        <button
                          onClick={() => handleAssignedChange('none')}
                          className={cn(
                            'w-full text-left px-2 py-2.5 rounded-md text-sm hover:bg-secondary transition-colors touch-manipulation',
                            !selectedLead.assigned_to && 'bg-secondary'
                          )}
                        >
                          Não atribuído
                        </button>
                        {allUsers.map(u => (
                          <button
                            key={u.id}
                            onClick={() => handleAssignedChange(u.id)}
                            className={cn(
                              'w-full text-left px-2 py-2.5 rounded-md text-sm hover:bg-secondary transition-colors flex items-center gap-2 touch-manipulation',
                              selectedLead.assigned_to === u.id && 'bg-secondary'
                            )}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{getInitials(u.name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{u.name}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Notes */}
                <Dialog open={notesOpen} onOpenChange={(open) => {
                  setNotesOpen(open);
                  if (open) setEditingNotes(selectedLead.notes || '');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-9 w-9 touch-manipulation text-foreground hover:bg-secondary">
                      <FileText className="h-4 w-4" />
                      {selectedLead.notes && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Observações</DialogTitle>
                      <DialogDescription>Adicione notas sobre este cliente</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Digite observações sobre o cliente..."
                        rows={5}
                        className="min-h-[120px] bg-secondary border-border"
                      />
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                      <Button variant="outline" onClick={() => setNotesOpen(false)} className="h-11 w-full sm:w-auto">Cancelar</Button>
                      <Button onClick={handleSaveNotes} disabled={savingNotes} className="h-11 w-full sm:w-auto bg-primary hover:bg-primary/90">
                        {savingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin overscroll-contain chat-pattern">
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
                      key={item.message.id}
                      className={cn(
                        'flex',
                        item.message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] md:max-w-[70%] px-3 py-2 animate-scale-in shadow-sm',
                          item.message.direction === 'outbound'
                            ? 'message-bubble-outbound'
                            : 'message-bubble-inbound',
                          item.message.id.startsWith('temp-') && 'opacity-70'
                        )}
                      >
                        {item.message.direction === 'inbound' && item.message.sender_name !== selectedLead.name && (
                          <p className="text-xs font-medium text-primary mb-1">
                            {item.message.sender_name}
                          </p>
                        )}

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
            <div className="px-2 py-2 md:px-3 md:py-2.5 border-t border-border bg-card safe-area-bottom z-10">
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
                    onClick={cancelRecording}
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
                    onClick={stopRecording}
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

                  <div className="flex-1 relative">
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
              <MessageSquareIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Selecione uma conversa</p>
            <p className="text-muted-foreground">
              Escolha um contato da lista para ver as mensagens
            </p>
          </div>
        )}
      </div>
    </div>
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
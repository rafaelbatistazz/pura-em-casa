import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    console.log('=== Evolution Webhook Received ===');
    console.log('Event:', body.event);
    console.log('Instance:', body.instance);
    console.log('Full body:', JSON.stringify(body, null, 2));

    // Handle messages.upsert event (new messages)
    if (body.event === 'messages.upsert') {
      const data = body.data;

      if (!data || !data.key) {
        console.log('No message data found');
        return new Response(
          JSON.stringify({ success: true, message: 'No message data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract phone number (remove @s.whatsapp.net or @g.us)
      const remoteJid = data.key.remoteJid || '';
      const phone = remoteJid.replace(/@s\.whatsapp\.net|@g\.us/g, '');

      // Skip group messages for now
      if (remoteJid.includes('@g.us')) {
        console.log('Skipping group message');
        return new Response(
          JSON.stringify({ success: true, message: 'Group message skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Skip status broadcasts
      if (remoteJid === 'status@broadcast') {
        console.log('Skipping status broadcast');
        return new Response(
          JSON.stringify({ success: true, message: 'Status broadcast skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get contact name
      const pushName = data.pushName || phone;

      // Determine message direction
      const direction = data.key.fromMe ? 'outbound' : 'inbound';

      // Extract message text and media info (handle different message types)
      let messageText = '';
      let mediaType: string | null = null;
      const message = data.message;

      // Check if n8n sent media_url and media_type
      const mediaUrlFromN8n = data.media_url || null;
      const mediaTypeFromN8n = data.media_type || null;

      if (message) {
        if (message.conversation) {
          messageText = message.conversation;
        } else if (message.extendedTextMessage?.text) {
          messageText = message.extendedTextMessage.text;
        } else if (message.imageMessage) {
          messageText = message.imageMessage.caption || '';
          mediaType = 'image';
        } else if (message.videoMessage) {
          messageText = message.videoMessage.caption || '';
          mediaType = 'video';
        } else if (message.audioMessage) {
          messageText = '';
          mediaType = 'audio';
        } else if (message.documentMessage) {
          messageText = message.documentMessage.fileName || '';
          mediaType = 'document';
        } else if (message.stickerMessage) {
          messageText = '';
          mediaType = 'sticker';
        } else if (message.locationMessage) {
          messageText = '[Localização]';
        } else if (message.contactMessage) {
          messageText = '[Contato]';
        } else {
          messageText = '[Mensagem não suportada]';
        }
      }

      // Use media info from n8n if provided, otherwise use detected type
      const finalMediaUrl = mediaUrlFromN8n;
      const finalMediaType = mediaTypeFromN8n || mediaType;

      // Get message timestamp (Evolution sends in seconds)
      const messageTimestamp = data.messageTimestamp
        ? new Date(data.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      // Get message ID
      const messageId = data.key.id || `msg-${Date.now()}`;

      console.log('Processing message:', {
        phone,
        pushName,
        direction,
        messageText: messageText.substring(0, 50),
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        messageId,
        timestamp: messageTimestamp
      });

      // 1. Upsert lead (create or update)
      const { data: leadId, error: leadError } = await supabase
        .rpc('upsert_lead_from_webhook', {
          p_phone: phone,
          p_name: pushName
        });

      if (leadError) {
        console.error('Error upserting lead:', leadError);
        throw leadError;
      }

      console.log('Lead upserted with ID:', leadId);

      // 2. Check if message already exists (avoid duplicates)
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('phone', phone)
        .eq('message_text', messageText)
        .eq('direction', direction)
        .gte('timestamp', new Date(Date.now() - 60000).toISOString()) // Within last minute
        .limit(1);

      if (existingMessages && existingMessages.length > 0) {
        console.log('Duplicate message detected, skipping');
        return new Response(
          JSON.stringify({ success: true, message: 'Duplicate skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Insert message with media info
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          phone: phone,
          message_text: messageText,
          media_url: finalMediaUrl,
          media_type: finalMediaType,
          direction: direction,
          sender_name: direction === 'inbound' ? pushName : 'Você',
          timestamp: messageTimestamp,
          read: direction === 'outbound',
        });

      if (messageError) {
        console.error('Error inserting message:', messageError);
        throw messageError;
      }

      console.log('Message inserted successfully with media:', { mediaUrl: finalMediaUrl, mediaType: finalMediaType });

      return new Response(
        JSON.stringify({
          success: true,
          leadId,
          message: 'Message processed successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle other events (connection status, etc.)
    console.log('Unhandled event type:', body.event);

    return new Response(
      JSON.stringify({ success: true, message: 'Event received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
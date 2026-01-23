import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    // --- DEBUG LOGGING ---
    try {
      await supabase.from('debug_events').insert({
        event_type: body.event || 'unknown',
        payload: body
      });
    } catch (err) {
      console.error('Failed to log debug event:', err);
    }
    // ---------------------

    // Handle messages.upsert event (new messages)
    if (body.event === 'messages.upsert') {
      // Evolution API can send data as an array or object
      const data = Array.isArray(body.data) ? body.data[0] : (body.data || body);

      if (!data || !data.key) {
        console.log('No message data found in body.data');
        return new Response(
          JSON.stringify({ success: true, message: 'No message data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract phone number (remove @s.whatsapp.net or @g.us)
      // Extract phone number (Smart Selection to avoid @lid)
      const rawRemoteJid = data.key.remoteJid || '';
      const rawRemoteJidAlt = data.key.remoteJidAlt || '';

      let targetJid = rawRemoteJid;

      // Logic: If remoteJid has @lid (Liquidity ID) and we have an alternative that DOESN'T, use the alternative.
      if (rawRemoteJid.includes('@lid') && rawRemoteJidAlt && !rawRemoteJidAlt.includes('@lid')) {
        console.log(`⚠️ Detected @lid in remoteJid (${rawRemoteJid}). Swapping to remoteJidAlt (${rawRemoteJidAlt}).`);
        targetJid = rawRemoteJidAlt;
      }

      const phone = targetJid.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '');

      // Skip group messages for now
      if (rawRemoteJid.includes('@g.us')) {
        console.log('Skipping group message');
        return new Response(
          JSON.stringify({ success: true, message: 'Group message skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Skip status broadcasts
      if (rawRemoteJid === 'status@broadcast') {
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
      let finalMediaUrl = mediaUrlFromN8n;
      const finalMediaType = mediaTypeFromN8n || mediaType;



      // Formata data para timestamp com offset -03:00 (igual ao front)
      const getSPTimestamp = (unixSeconds?: number) => {
        const date = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
        const spTime = date.toLocaleString('sv-SE', {
          timeZone: 'America/Sao_Paulo',
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        return spTime.replace(' ', 'T') + '-03:00';
      };

      const messageTimestamp = getSPTimestamp(data.messageTimestamp);

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

      // 0. Deduplication - Check if message already exists (avoid duplicates EARLY)
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('whatsapp_id', messageId) // Match exactly by WhatsApp ID
        .limit(1);

      if (existingMessages && existingMessages.length > 0) {
        console.log('Duplicate message detected (early check), skipping');
        return new Response(
          JSON.stringify({ success: true, message: 'Duplicate skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // 1.5 Update Lead Instance Name (Multi-Instance Support)
      if (body.instance) {
        await supabase
          .from('leads')
          .update({ instance_name: body.instance })
          .eq('id', leadId);
      }

      console.log('Lead upserted with ID:', leadId);

      // (Deduplication moved to start)

      // --- MEDIA HANDLING (Synchronous to ensure reliability) ---
      if (mediaType && !finalMediaUrl) {
        try {
          console.log(`Attempting to fetch media for message ${messageId} (${mediaType})...`);

          const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
          const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
          const instanceName = body.instance;

          if (evolutionUrl && evolutionKey && instanceName) {
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;
            let respData = null;

            while (retryCount < maxRetries && !success) {
              if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              try {
                // Request structure EXACTLY as shown in n8n screenshot
                const res = await fetch(`${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
                  body: JSON.stringify({
                    message: {
                      key: {
                        id: data.key.id
                      }
                    }
                  })
                });

                if (res.ok) {
                  const json = await res.json();
                  if (json.base64) {
                    respData = json;
                    success = true;
                  }
                }
              } catch (e) {
                console.error('Fetch error during media download:', (e as any).message);
              }
              retryCount++;
            }

            if (success && respData) {
              const base64 = respData.base64;
              const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              console.log(`Media size: ${bytes.length} bytes`);

              let ext = 'jpg';
              let mime = 'image/jpeg';
              if (mediaType === 'video') { ext = 'mp4'; mime = 'video/mp4'; }
              else if (mediaType === 'audio') {
                ext = 'mp3';
                mime = 'audio/mpeg';
              }
              else if (mediaType === 'document') { ext = 'pdf'; mime = 'application/pdf'; }
              else if (mediaType === 'sticker') { ext = 'webp'; mime = 'image/webp'; }

              const fileName = `${messageId}.${ext}`;
              const filePath = `${leadId}/${fileName}`;

              const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, bytes, { contentType: mime, upsert: true });

              if (uploadError) {
                console.error('Storage Upload Error:', uploadError);
              } else {
                const { data: publicUrlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
                finalMediaUrl = publicUrlData.publicUrl;
                console.log('Media uploaded successfully:', finalMediaUrl);
              }
            }
          }
        } catch (err) {
          console.error('Media processing failed:', err);
        }
      }

      // 3. Insert message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          phone: phone,
          whatsapp_id: messageId,
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

      return new Response(
        JSON.stringify({
          success: true,
          leadId,
          message: 'Message processed successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle connection events
    const eventType = (body.event || '').toUpperCase();

    if (eventType === 'CONNECTION_UPDATE' || eventType === 'CONNECTION.UPDATE') {
      const status = body.data?.status || body.data?.statusReason;
      console.log(`Connection update for ${body.instance}: ${status}`);

      // Trigger n8n webhook on connection success
      // REMOVED: N8N dependency eliminated - status is already updated in DB below
      /* 
      if (status === 'open' || status === 'connected') {
        try {
          const instanceName = body.instance;
          const n8nUrl = `https://n8n.advfunnel.com.br/webhook/5f27db92-6051-4d28-9ff0-9047f6622c82/${instanceName}`;

          console.log(`Triggering n8n webhook: ${n8nUrl}`);

          await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instance: instanceName,
              status: 'connected',
              timestamp: new Date().toISOString(),
              data: body.data
            })
          });
          console.log('n8n webhook triggered successfully');
        } catch (err) {
          console.error('Failed to trigger n8n webhook:', err);
        }
      }
      */

      // Update instances table in Supabase to reflect real-time status
      let dbStatus = 'disconnected';
      const s = String(status).toLowerCase();
      if (s === 'open' || s === 'connected') dbStatus = 'connected';
      else if (s === 'connecting') dbStatus = 'connecting';

      console.log(`Syncing status '${dbStatus}' to DB for instance ${body.instance}`);

      const { error: updateError } = await supabase
        .from('instances')
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString()
        })
        .eq('instance_name', body.instance);

      if (updateError) console.error('Failed to update instance status in DB:', updateError);

      return new Response(
        JSON.stringify({ success: true, message: 'Connection update processed' }),
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
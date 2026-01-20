import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. GET Request: Webhook Verification
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        const VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || 'pura_em_casa_secure_token';

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new Response(challenge, { status: 200 });
        } else {
            return new Response('Verification failed', { status: 403 });
        }
    }

    // 2. POST Request: Handle Events
    if (req.method === 'POST') {
        try {
            const body = await req.json();
            console.log('=== Meta Webhook Received ===', JSON.stringify(body, null, 2));

            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            if (value?.messages) {
                const message = value.messages[0];
                const contact = value.contacts?.[0];

                const businessPhoneNumberId = value.metadata?.phone_number_id;
                const from = message.from; // Phone number
                const name = contact?.profile?.name || from;
                const messageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

                let messageText = '';
                let mediaType = null;
                let mediaUrl = null;

                // Handle Text
                if (message.type === 'text') {
                    messageText = message.text.body;
                }
                // Handle Media (Image, Audio, Document, Video)
                else if (['image', 'audio', 'document', 'video', 'sticker'].includes(message.type)) {
                    const media = message[message.type];
                    messageText = media.caption || (media.filename ? media.filename : `[${message.type}]`);
                    mediaType = message.type;

                    // We need to fetch the media URL using the ID (Meta API requirement)
                    // For now, we store the ID as the URL and let the frontend/backend resolve it, 
                    // OR we fetch it immediately. 
                    // Given the constraint of parallel implementation, let's try to fetch active instance config to get the token.

                    // MEDIA FETCHING TODO:
                    // 1. Query 'instances' where meta_phone_id = businessPhoneNumberId
                    // 2. Use access_token to fetch media URL
                    mediaUrl = `meta_media_id:${media.id}`;
                }

                console.log(`Processing Meta Message from ${from}: ${messageText.substring(0, 50)}`);

                // Upsert Lead
                const { data: leadId, error: leadError } = await supabase.rpc('upsert_lead_from_webhook', {
                    p_phone: from,
                    p_name: name
                });

                if (leadError) throw leadError;

                // Resolve Instance Name from Meta Phone ID
                let instanceName = null;
                if (businessPhoneNumberId) {
                    const { data: instanceData } = await supabase
                        .from('instances')
                        .select('instance_name')
                        .eq('meta_phone_id', businessPhoneNumberId)
                        .maybeSingle();

                    if (instanceData) {
                        instanceName = instanceData.instance_name;
                        // Update Lead with Instance Name
                        await supabase
                            .from('leads')
                            .update({ instance_name: instanceName })
                            .eq('id', leadId);
                    }
                }

                // Insert Message
                const { error: msgError } = await supabase.from('messages').insert({
                    lead_id: leadId,
                    phone: from,
                    message_text: messageText,
                    media_type: mediaType,
                    media_url: mediaUrl, // Will be a meta ID placeholder for now
                    direction: 'inbound',
                    sender_name: name,
                    timestamp: timestamp,
                    read: false
                });

                if (msgError) throw msgError;

                console.log('Message stored successfully');
            }

            return new Response('EVENT_RECEIVED', { status: 200 });

        } catch (err: any) {
            console.error('Error processing Meta Error:', err);
            return new Response('INTERNAL_SERVER_ERROR', { status: 500 });
        }
    }

    return new Response('Method not allowed', { status: 405 });
});

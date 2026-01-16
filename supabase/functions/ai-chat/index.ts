
import { createClient } from "jsr:@supabase/supabase-js@2.46.1";
import OpenAI from "npm:openai@4.71.1";
import pdf from "npm:pdf-parse@1.1.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function transcribeAudio(mediaUrl: string, apiKey: string): Promise<string> {
    console.log('Transcribing audio from:', mediaUrl);
    try {
        const fileResponse = await fetch(mediaUrl);
        if (!fileResponse.ok) throw new Error('Failed to download audio file');
        const blob = await fileResponse.blob();

        const file = new File([blob], 'audio.ogg', { type: blob.type || 'audio/ogg' });

        const openai = new OpenAI({ apiKey });
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'pt',
        });

        console.log('Transcription result:', transcription.text);
        return transcription.text || '[Áudio inaudível]';
    } catch (e) {
        console.error('Transcription failed:', e);
        return '[Erro na transcrição do áudio]';
    }
}

async function extractPdfText(mediaUrl: string): Promise<string> {
    console.log('Extracting PDF text from:', mediaUrl);
    try {
        const fileResponse = await fetch(mediaUrl);
        if (!fileResponse.ok) throw new Error('Failed to download PDF file');
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const data = await pdf(buffer);
        console.log('PDF extracted, length:', data.text.length);

        // Limit text to avoid token limits (e.g., first 10k chars)
        const text = data.text.trim();
        return text.slice(0, 15000) || '[PDF sem texto extraível]';
    } catch (e) {
        console.error('PDF extraction failed:', e);
        return '[Erro na leitura do PDF (pode ser imagem/escaneado)]';
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const requestData = await req.json();
        const { leadId, instanceName: inputInstanceName } = requestData;

        let messageText = requestData.message || '';
        const mediaUrl = requestData.media_url || requestData.mediaUrl || '';
        let mediaType = requestData.media_type || requestData.mediaType || 'text';

        // Auto-detect PDF via extension if mediaType is generic 'document' or 'file'
        if (mediaUrl && mediaUrl.toLowerCase().includes('.pdf')) {
            mediaType = 'document';
        }

        if (!leadId) {
            throw new Error('leadId is required');
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

        // --- 0. PRE-PROCESSING: Transcription, Vision & PDF ---
        let currentMessageContent: any = messageText;

        // 1. Audio/Video
        if ((mediaType === 'audio' || mediaType === 'video') && mediaUrl) {
            const transcription = await transcribeAudio(mediaUrl, apiKey);
            messageText = `[Transcrição do Áudio/Vídeo]: ${transcription}`;
            currentMessageContent = messageText;
        }
        // 2. PDF Document
        else if (mediaType === 'document' && mediaUrl) {
            const pdfText = await extractPdfText(mediaUrl);
            messageText = `[Conteúdo do Arquivo PDF]:\n${pdfText}`;
            currentMessageContent = messageText;
        }
        // 3. Image (Vision)
        else if (mediaType === 'image' && mediaUrl) {
            const textPrompt = messageText || 'Analise esta imagem enviada pelo usuário.';
            currentMessageContent = [
                { type: 'text', text: textPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: mediaUrl,
                        detail: 'low'
                    }
                }
            ];
        }

        // Fetch AI Config
        const { data: configData } = await supabaseClient
            .from('system_config')
            .select('value')
            .eq('key', 'ai_settings')
            .maybeSingle();

        // Initialize aiConfig with default prompt
        let aiConfig = {
            model: 'gpt-4o-mini',
            system_prompt: 'Você é um assistente útil e amigável. IMPORTANTE: Se o usuário pedir "vídeo", "demonstração" ou "ver como funciona", você DEVE chamar a função `send_media`. Não descreva o vídeo, ENVIE o vídeo. Para formatação em negrito, use APENAS UM asterisco (*texto*). Ao enviar mídia, NÃO escreva texto adicional, apenas chame a função.',
            temperature: 0.5,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };

        if (configData?.value) {
            try {
                const dbConfig = JSON.parse(configData.value);
                aiConfig = { ...aiConfig, ...dbConfig };
                // Enforce critical rules even if overriding from DB
                aiConfig.system_prompt += " REGRAS CRÍTICAS: 1. Use apenas *um asterisco* para negrito. 2. Se pedirem imagem/vídeo, CHAME A FUNÇÃO `send_media`. 3. Se chamar mídia, não responda com texto.";
            } catch (e) {
                console.error('Error parsing AI config', e);
            }
        }

        // Fetch Chat History
        const { data: historyData } = await supabaseClient
            .from('messages')
            .select('direction, message_text, media_url, media_type, timestamp')
            .eq('lead_id', leadId)
            .order('timestamp', { ascending: false })
            .limit(20);

        const history = (historyData || []).reverse().map(msg => {
            const role = msg.direction === 'inbound' ? 'user' : 'assistant';

            if (msg.direction === 'inbound' && msg.media_type === 'image' && msg.media_url) {
                return {
                    role: role,
                    content: [
                        { type: 'text', text: msg.message_text || 'Imagem enviada.' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: msg.media_url,
                                detail: 'low'
                            }
                        }
                    ]
                };
            }
            return {
                role: role,
                content: msg.message_text || '(media message)'
            };
        });

        // Evolution Config
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.advfunnel.com.br';
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || 'ESWH6B36nhfW3apMfQQAv3SU2CthsZCg';

        let instanceName = inputInstanceName;
        if (!instanceName) {
            const { data: instanceConfig } = await supabaseClient
                .from('system_config')
                .select('value')
                .eq('key', 'evolution_instance_name')
                .maybeSingle();
            instanceName = instanceConfig?.value;
        }

        const { data: leadData } = await supabaseClient
            .from('leads')
            .select('phone')
            .eq('id', leadId)
            .single();

        // OpenAI Call
        const openai = new OpenAI({ apiKey: apiKey });

        const tools = [
            {
                type: 'function',
                function: {
                    name: 'send_media',
                    description: 'Envia MÍDIA (imagem ou vídeo). É OBRIGATÓRIO usar esta função se o usuário pedir para "ver", "assistir", "vídeo" ou "como funciona".',
                    parameters: {
                        type: 'object',
                        properties: {
                            media_type: {
                                type: 'string',
                                enum: ['processo_8_etapas', 'demonstracao_limpeza'],
                                description: 'processo_8_etapas (Para "imagem", "metodologia", "passos") ou demonstracao_limpeza (Para "vídeo", "limpeza em ação", "ver funcionando").'
                            }
                        },
                        required: ['media_type']
                    }
                }
            }
        ];

        const completion = await openai.chat.completions.create({
            model: aiConfig.model,
            messages: [
                { role: 'system', content: aiConfig.system_prompt },
                ...history,
                { role: 'user', content: currentMessageContent }
            ],
            tools: tools,
            tool_choice: 'auto',
            temperature: aiConfig.temperature,
            max_tokens: aiConfig.max_tokens,
            top_p: aiConfig.top_p,
            frequency_penalty: aiConfig.frequency_penalty,
            presence_penalty: aiConfig.presence_penalty,
        });

        const replyMessage = completion.choices[0]?.message;
        let textContent = replyMessage?.content || '';
        const toolCalls = replyMessage?.tool_calls || [];

        // Suppress text if media is being sent, to avoid "Here is the image" redundancy
        if (toolCalls.length > 0) {
            textContent = '';
        }

        let executionLog = {
            textStatus: 'skipped',
            mediaStatus: 'skipped',
            textError: null,
            mediaError: null,
            debug: {
                hasText: !!textContent,
                toolCallsCount: toolCalls.length,
                instance: instanceName,
                phone: leadData?.phone,
                inputType: mediaType,
                transcribed: mediaType === 'audio' || mediaType === 'video',
                pdfExtracted: mediaType === 'document'
            }
        };

        if (evolutionUrl && evolutionApiKey && instanceName && leadData?.phone) {
            const cleanPhone = leadData.phone.replace(/\D/g, '');

            if (textContent) {
                try {
                    const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': evolutionApiKey
                        },
                        body: JSON.stringify({
                            number: cleanPhone,
                            text: textContent
                        })
                    });

                    if (sendResponse.ok) {
                        executionLog.textStatus = 'sent';
                        await supabaseClient.from('messages').insert({
                            lead_id: leadId,
                            phone: leadData.phone,
                            message_text: textContent,
                            direction: 'outbound',
                            sender_name: 'AI Agent',
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        executionLog.textStatus = 'failed';
                        executionLog.textError = await sendResponse.text();
                    }
                } catch (e: any) {
                    executionLog.textError = e.message || String(e);
                }
            }

            for (const toolCall of toolCalls) {
                if (toolCall.function.name === 'send_media') {
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        let mediaUrl = '';
                        let mediaType = 'image';

                        if (args.media_type === 'processo_8_etapas') {
                            mediaUrl = 'https://lhbwfbquxkutcyqazpnw.supabase.co/storage/v1/object/public/images/outro/metodologia-pura-em-casa.webp';
                            mediaType = 'image';
                        } else if (args.media_type === 'demonstracao_limpeza') {
                            mediaUrl = 'https://lhbwfbquxkutcyqazpnw.supabase.co/storage/v1/object/public/images/videos/video-pura-em-casa.mp4';
                            mediaType = 'video';
                        }

                        if (mediaUrl) {
                            // Enhanced payload based on User's explicit request
                            // Structure: { number, options, mediaMessage: { mediatype, caption, media } }
                            // Hybrid payload: Include parameters at BOTH root and nested levels to ensure compatibility across versions.
                            const mediaBody = {
                                number: cleanPhone,
                                mediatype: mediaType,
                                mediaType: mediaType,
                                mimetype: mediaType === 'image' ? 'image/webp' : 'video/mp4',
                                media: mediaUrl,           // <--- CRITICAL: URL at root for legacy/hybrid support
                                caption: '',               // Root caption
                                options: {
                                    delay: 1200,
                                    presence: "composing"
                                },
                                mediaMessage: {
                                    mediatype: mediaType,
                                    caption: '',
                                    media: mediaUrl,
                                    fileName: args.media_type + (mediaType === 'image' ? '.webp' : '.mp4')
                                }
                            };

                            console.log('Sending Media Payload (Hybrid):', JSON.stringify(mediaBody));

                            const mediaResponse = await fetch(`${evolutionUrl}/message/sendMedia/${instanceName}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': evolutionApiKey
                                },
                                body: JSON.stringify(mediaBody)
                            });

                            if (mediaResponse.ok) {
                                executionLog.mediaStatus = 'sent';
                                await supabaseClient.from('messages').insert({
                                    lead_id: leadId,
                                    phone: leadData.phone,
                                    message_text: `(Mídia enviada: ${args.media_type})`,
                                    media_url: mediaUrl,
                                    media_type: mediaType,
                                    direction: 'outbound',
                                    sender_name: 'AI Agent (Mídia)',
                                    timestamp: new Date().toISOString()
                                });
                            } else {
                                const err = await mediaResponse.text();
                                executionLog.mediaStatus = 'failed';
                                // Include Payload in Error Log for Debugging
                                executionLog.mediaError = `API Error: ${err} | Payload Sent: ${JSON.stringify(mediaBody)}`;
                                console.error('Media Send Failed:', err);
                            }
                        }
                    } catch (e: any) {
                        console.error('Error executing tool call:', e);
                        executionLog.mediaError = e.message || String(e);
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            reply: textContent,
            toolCalls,
            executionLog
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('AI Function Error:', error);
        return new Response(JSON.stringify({ error: error.message || String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

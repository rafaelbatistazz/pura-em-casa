import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import OpenAI from "https://esm.sh/openai@4.71.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { lead_id, elapsed_time } = await req.json();

        if (!lead_id || !elapsed_time) {
            throw new Error('lead_id and elapsed_time are required');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        // Use Service Role to access system_config and update leads freely
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Check Lead Status & Follow-up Toggle
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id, name, phone, status, followup_enabled')
            .eq('id', lead_id)
            .single();

        if (leadError || !lead) throw new Error('Lead not found');

        // EXIT CONDITIONS
        if (lead.followup_enabled === false) {
            return new Response(JSON.stringify({ message: 'Follow-up is disabled for this lead.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const stopStatuses = ['Agendado', 'Pós Venda', 'Finalizado', 'Arquivado', 'Venda'];
        if (stopStatuses.includes(lead.status)) {
            return new Response(JSON.stringify({ message: `Status '${lead.status}' does not require follow-up.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Get Conversation History
        const { data: messages } = await supabase
            .from('messages')
            .select('message_text, sender_name, direction')
            .eq('lead_id', lead_id)
            .order('timestamp', { ascending: false })
            .limit(30);

        const history = (messages || []).reverse().map(m =>
            `${m.direction === 'outbound' ? 'IA' : 'Cliente'}: ${m.message_text}`
        ).join('\n');

        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        const openai = new OpenAI({ apiKey: openAiKey });

        // 3. AI Analysis: Do we need a response?
        const analysisPrompt = `
      Analise o histórico da conversa abaixo.
      Objetivo: Determinar se a empresa (IA) fez uma pergunta ou enviou uma proposta que requer resposta do cliente, e o cliente NÃO respondeu.
      
      Regras:
      - Se a conversa terminou naturalmente (ex: cliente disse "obrigado, tchau", "não tenho interesse", "vou ver e te falo"), ou se a última mensagem foi do cliente encerrando -> NO_RESPONSE_NEEDED.
      - Se a IA perguntou algo (ex: "Qual seu bairro?", "Qual o tecido?", "Vamos agendar?") e o cliente não respondeu -> NEED_RESPONSE.
      - Se a IA mandou preço/proposta e cliente sumiu -> NEED_RESPONSE.
      
      Histórico:
      ${history}

      Responda APENAS: "NEED_RESPONSE" ou "NO_RESPONSE_NEEDED".
    `;

        const analysisCompletion = await openai.chat.completions.create({
            messages: [{ role: 'system', content: 'Você é um analista de CRM.' }, { role: 'user', content: analysisPrompt }],
            model: 'gpt-4o-mini',
            temperature: 0,
        });

        const analysisResult = analysisCompletion.choices[0].message.content?.trim();

        if (analysisResult === 'NO_RESPONSE_NEEDED') {
            // Disable follow-up
            await supabase.from('leads').update({ followup_enabled: false }).eq('id', lead_id);
            return new Response(JSON.stringify({ message: 'Follow-up disabled: Context indicates no response needed.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Generate Follow-up Message
        let baseScript = '';

        // Normalize time inputs if needed (check_followups sends '10min', '1hour', etc)
        const normalizedTime = elapsed_time.replace('min', 'm').replace('hours', 'h').replace('hour', 'h');

        switch (normalizedTime) {
            case '10m':
                baseScript = `
        Opção 1: "👀"
        Opção 2: "Oii"
        Escolha a que fizer mais sentido com o contexto imediatamente anterior. Se for início de conversa, Opção 2 é boa.
        `;
                break;
            case '1h':
                baseScript = `"Só para eu não te passar uma informação errada: você sabe me dizer qual é o tecido do seu móvel? Isso ajuda na técnica para fazer a blindagem ou limpeza sem danificar."`;
                break;
            case '24h':
                baseScript = `"Estava discutindo seu caso com meu técnico agora. Baseado na foto que você me mandou (ou no que me falou), conseguimos remover essas manchas/fazer o serviço, mas preciso te alertar sobre um detalhe se você demorar muito para impermeabilizar. Consegue falar rapidinho?"`;
                break;
            case '48h':
                baseScript = `"Pelo seu silêncio, estou assumindo que limpar o estofado deixou de ser uma prioridade e você vai manter ele assim por enquanto. É isso mesmo?"`;
                break;
            case '72h':
                baseScript = `"Como não tivemos retorno, vou arquivar seu atendimento para dar atenção aos clientes agendados da semana. Se decidir retomar a limpeza no futuro, estou à disposição."`;
                break;
            default:
                baseScript = `"Olá, ainda tem interesse na limpeza?"`;
        }

        const generationPrompt = `
      Você é a Tamires, assistente da Pura em Casa.
      
      Contexto: O cliente parou de responder há ${normalizedTime}.
      Histórico: 
      ${history}

      Script Base:
      ${baseScript}

      Tarefa: Reescreva/Adapte o Script Base para se encaixar naturalmente no histórico.
      
      REGRAS CRÍTICAS DE 10 MINUTOS:
      - Se for 10m: ENVIE EXATAMENTE A OPÇÃO ESCOLHIDA ("Oii" ou "👀").
      - PROIBIDO adicionar saudações extras, perguntas ou recapitulações.
      - PROIBIDO escrever "Só passando para saber...", "Oi tudo bem", etc.
      - O objetivo é parecer que a pessoa mandou uma mensagem rápida pq o cliente parou de responder. SEJA EXTREMAMENTE CURTO.

      Regras Gerais:
      - Mantenha a essência persuasiva do script.
      - Se for 1h, follow-up leve.
      - Se for 24h, gere curiosidade técnica.
      - Se for 48h, use o gatilho de "perda/despriorização".
      - Se for 72h, encerramento educado.
      - NÃO use saudações robóticas como "Olá [Nome]". Vá direto ao ponto.
      
      Gere APENAS o texto da mensagem.
    `;

        const genCompletion = await openai.chat.completions.create({
            messages: [{ role: 'system', content: 'Você é Tamires.' }, { role: 'user', content: generationPrompt }],
            model: 'gpt-4o-mini',
            temperature: 0.5,
        });

        const finalMessage = genCompletion.choices[0].message.content;

        // 5. Send Message via Evolution API
        const { data: evoConfigs } = await supabase
            .from('system_config')
            .select('key, value')
            .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

        const evoUrl = evoConfigs?.find(c => c.key === 'evolution_api_url')?.value || Deno.env.get('EVOLUTION_API_URL') || 'https://evo.advfunnel.com.br';
        const evoKey = evoConfigs?.find(c => c.key === 'evolution_api_key')?.value || Deno.env.get('EVOLUTION_API_KEY') || 'ESWH6B36nhfW3apMfQQAv3SU2CthsZCg';
        const instanceName = evoConfigs?.find(c => c.key === 'evolution_instance_name')?.value || Deno.env.get('EVOLUTION_INSTANCE_NAME');

        if (evoUrl && evoKey && instanceName && finalMessage) {
            await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': evoKey
                },
                body: JSON.stringify({
                    number: lead.phone.replace(/\D/g, ''),
                    text: finalMessage
                })
            });

            // Save to Messages DB
            await supabase.from('messages').insert({
                lead_id: lead_id,
                phone: lead.phone,
                message_text: finalMessage,
                direction: 'outbound',
                sender_name: 'AI Follow-up',
                timestamp: new Date().toISOString()
            });

            // Update status to 'Follow-up' if not already (and not 72h which goes to Sumiu)
            if (normalizedTime !== '72h' && lead.status !== 'Follow-up') {
                await supabase.from('leads').update({ status: 'Follow-up' }).eq('id', lead_id);
            }

            // If 72h, disable follow-ups AND move to Sumiu
            if (normalizedTime === '72h') {
                await supabase.from('leads').update({
                    followup_enabled: false,
                    status: 'Sumiu'
                }).eq('id', lead_id);
            }
        }

        return new Response(
            JSON.stringify({ success: true, message: finalMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error(error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

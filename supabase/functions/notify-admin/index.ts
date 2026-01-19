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
    const { lead_id, status } = await req.json();

    if (!lead_id) {
      throw new Error('lead_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get Alert Config
    const { data: configData, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'alert_notification_phone')
      .single();

    if (configError || !configData?.value) {
      console.log('No alert phone configured');
      return new Response(JSON.stringify({ message: 'No alert phone configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let alertPhone = '';
    try {
      alertPhone = JSON.parse(configData.value);
    } catch {
      alertPhone = configData.value.replace(/"/g, '');
    }

    if (!alertPhone) {
      return new Response(JSON.stringify({ message: 'Alert phone is empty' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Get Lead Data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('name, phone, budget, notes')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) throw new Error('Lead not found');

    // 3. Get Conversation History (Last 30 messages for better context)
    const { data: messages } = await supabase
      .from('messages')
      .select('role, message_text, sender_name, direction')
      .eq('lead_id', lead_id)
      .order('timestamp', { ascending: false })
      .limit(30);

    const history = (messages || []).reverse().map(m =>
      `${m.direction === 'outbound' ? 'IA' : 'Cliente'}: ${m.message_text}`
    ).join('\n');

    // 4. Generate Summary with OpenAI
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const openai = new OpenAI({ apiKey: openAiKey });

    let prompt = '';
    let header = '';

    if (status === 'Proposta') {
      header = '📄 *PROPOSTA ENVIADA* 📄';
      prompt = `
        Analise a conversa abaixo. O lead acabou de receber uma PROPOSTA.
        
        DADOS DO LEAD:
        Nome: ${lead.name}
        Telefone: ${lead.phone}
        Orçamento/Valor da Proposta: ${lead.budget || 'Não informado'}

        HISTÓRICO RECENTE:
        ${history}

        Gere um resumo curto para o time de vendas (WhatsApp) contendo:
        1. Nome e Telefone
        2. Valor da Proposta (R$)
        3. Resumo do que foi negociado (quais móveis, condições, etc.)
      `;
    } else {
      // Default to AGENDADO logic
      header = '🗓️ *AGENDA CONFIRMADA* 🗓️';
      prompt = `
        Analise a conversa abaixo. O lead acabou de ser AGENDADO.
        
        DADOS DO LEAD:
        Nome: ${lead.name}
        Telefone: ${lead.phone}
        Orçamento: ${lead.budget || 'Não informado'}
        
        HISTÓRICO RECENTE:
        ${history}

        Gere um resumo curto para o time de operações (WhatsApp) contendo:
        1. Nome e Telefone
        2. Data e Período do Agendamento (Extraia da conversa!)
        3. Tipo de Serviço e Móveis (O que vai ser limpo?)
        4. Valor Final
        5. Observações importantes (endereço, restrições, etc se houver)
      `;
    }

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'Você é um assistente CRM.' }, { role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    const summary = chatCompletion.choices[0].message.content;

    // 5. Send to Settings Phone via Evolution API
    const { data: evoConfigs } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    const evoUrl = evoConfigs?.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = evoConfigs?.find(c => c.key === 'evolution_api_key')?.value;
    const instanceName = evoConfigs?.find(c => c.key === 'evolution_instance_name')?.value;

    if (evoUrl && evoKey && instanceName && summary) {
      try {
        await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evoKey
          },
          body: JSON.stringify({
            number: alertPhone.replace(/\D/g, ''),
            text: `${header}\n\n${summary}`
          })
        });
        console.log('Alert sent to', alertPhone);
      } catch (e) {
        console.error('Failed to send WhatsApp alert', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
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

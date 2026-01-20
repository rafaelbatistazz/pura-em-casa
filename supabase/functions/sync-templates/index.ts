
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get Active Meta Instance
        const { data: instanceData, error: instanceError } = await supabaseClient
            .from('instances')
            .select('*')
            .eq('provider', 'meta')
            .eq('status', 'connected')
            .limit(1)
            .maybeSingle();

        if (instanceError) throw instanceError;
        if (!instanceData) {
            return new Response(JSON.stringify({ error: 'Nenhuma instância Meta conectada encontrada.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404
            });
        }

        const { meta_business_id, meta_access_token } = instanceData;

        if (!meta_business_id || !meta_access_token) {
            return new Response(JSON.stringify({ error: 'Credenciais da Meta incompletas na instância.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            });
        }

        // 2. Fetch Templates from Meta
        const metaUrl = `https://graph.facebook.com/v21.0/${meta_business_id}/message_templates?fields=id,name,status,language,category,components&limit=100`;

        console.log(`Fetching templates from: ${metaUrl}`);

        const response = await fetch(metaUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${meta_access_token}`
            }
        });

        const metaData = await response.json();

        if (metaData.error) {
            console.error('Meta API Error:', metaData.error);
            throw new Error(metaData.error.message);
        }

        const templates = metaData.data || [];
        console.log(`Found ${templates.length} templates.`);

        // 3. Upsert into Database
        const upsertData = templates.map((t: any) => ({
            meta_id: t.id,
            name: t.name,
            status: t.status,
            language: t.language,
            category: t.category,
            components: t.components,
            last_synced_at: new Date().toISOString()
        }));

        if (upsertData.length > 0) {
            const { error: upsertError } = await supabaseClient
                .from('whatsapp_templates')
                .upsert(upsertData, { onConflict: 'meta_id' });

            if (upsertError) throw upsertError;
        }

        return new Response(JSON.stringify({
            success: true,
            count: upsertData.length,
            message: `${upsertData.length} templates sincronizados.`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error syncing templates:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});

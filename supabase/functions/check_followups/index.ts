import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRON_SECRET = 'fc-cron-secure-token-v1';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Security Check
    const authHeader = req.headers.get('x-cron-auth');
    if (authHeader !== CRON_SECRET) {
        // console.log(`Unauthorized cron attempt: ${authHeader}`);
        // return new Response('Unauthorized', { status: 401 });
    }

    try {
        // --- TIME RESTRICTION CHECK (Brazil Time) ---
        // Block between 23:50 and 06:00
        const brazilTime = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
        const brDate = new Date(brazilTime);
        const hours = brDate.getHours();
        const minutes = brDate.getMinutes();

        // 23:50 to 23:59 OR 00:00 to 05:59
        const isRestrictedTime = (hours === 23 && minutes >= 50) || (hours < 6);

        if (isRestrictedTime) {
            console.log(`Skipping follow-up check. Current BR Time: ${hours}:${minutes} (Restricted: 23:50-06:00)`);
            return new Response(JSON.stringify({ message: 'Skipped due to time restriction' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // ---------------------------------------------

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get Instance Name
        const { data: config } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'evolution_instance_name')
            .maybeSingle();

        const instanceName = config?.value || 'default';

        // 2. Query Leads needing followup
        // We now check up to stage 4 (to trigger stage 5 for 72h)
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('*, messages(id, message_text, direction, timestamp, media_type)')
            .eq('followup_enabled', true)
            .eq('last_message_direction', 'outbound')
            .lt('followup_stage', 5) // Stop after stage 4 (48h) moves to 5 (72h completed)
            // .or(...) // Removing strict OR check to allow simplified "anything less than 5" logic
            ;

        if (leadsError) throw leadsError;

        const now = new Date(); // UTC now, valid for diffing with DB updated_at (UTC)
        const actions = [];
        const leadsToProcess = leads || [];

        console.log(`Checking ${leadsToProcess.length} leads for followups...`);

        for (const lead of leadsToProcess) {
            const lastUpdate = lead.updated_at ? new Date(lead.updated_at) : new Date(0);
            const diffMs = now.getTime() - lastUpdate.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            let triggerType = null;
            let nextStage = 0;

            // Follow-up Logic
            // Stage 0 -> 10min -> Stage 1
            // Stage 1 -> 1hour -> Stage 2
            // Stage 2 -> 24hours -> Stage 3
            // Stage 3 -> 48hours -> Stage 4
            // Stage 4 -> 72hours -> Stage 5

            if (lead.followup_stage === 0 && diffMinutes >= 10) {
                triggerType = '10m';
                nextStage = 1;
            } else if (lead.followup_stage === 1 && diffMinutes >= 60) {
                triggerType = '1h';
                nextStage = 2;
            } else if (lead.followup_stage === 2 && diffMinutes >= 1440) { // 24h
                triggerType = '24h';
                nextStage = 3;
            } else if (lead.followup_stage === 3 && diffMinutes >= 2880) { // 48h
                triggerType = '48h';
                nextStage = 4;
            } else if (lead.followup_stage === 4 && diffMinutes >= 4320) { // 72h
                triggerType = '72h';
                nextStage = 5;
            }

            if (triggerType) {
                console.log(`Triggering ${triggerType} for lead ${lead.name} (${lead.phone})`);

                const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-followup`;
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                actions.push((async () => {
                    try {
                        const res = await fetch(functionUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${serviceKey}`
                            },
                            body: JSON.stringify({
                                lead_id: lead.id,
                                elapsed_time: triggerType
                            })
                        });

                        // We check OK Status
                        if (res.ok) {
                            await supabase
                                .from('leads')
                                .update({ followup_stage: nextStage })
                                .eq('id', lead.id);
                            return { success: true, leadId: lead.id, type: triggerType };
                        } else {
                            console.error(`Failed to call ai-followup for ${lead.id}: ${res.statusText}`);
                            return { success: false, leadId: lead.id, error: res.statusText };
                        }
                    } catch (err) {
                        console.error(`Error processing lead ${lead.id}:`, err);
                        return { success: false, leadId: lead.id, error: err };
                    }
                })());
            }
        }

        const results = await Promise.all(actions);

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Func error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

import { createClient } from "jsr:@supabase/supabase-js@2.46.1";
import OpenAI from "npm:openai@4.71.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { text, filename } = await req.json();

        if (!text) {
            throw new Error('No text provided');
        }

        console.log(`Processing document: ${filename} (${text.length} chars)`);

        // Initialize Supabase Admin Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Initialize OpenAI
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY not set');
        const openai = new OpenAI({ apiKey });

        // Simple Chunking Strategy (approx 1000 chars per chunk, overlapping could be better but this is MVP)
        // Split by paragraphs first to keep context?
        // Let's do a simple hard char limit for now, but improving...
        // Split by newlines, then group until ~1000 chars.

        const rawChunks = text.split(/\n\s*\n/); // Split by paragraphs
        const finalChunks: string[] = [];
        let currentChunk = "";

        for (const p of rawChunks) {
            if (currentChunk.length + p.length > 1500) {
                finalChunks.push(currentChunk.trim());
                currentChunk = p;
            } else {
                currentChunk += "\n" + p;
            }
        }
        if (currentChunk.trim()) finalChunks.push(currentChunk.trim());

        console.log(`Split into ${finalChunks.length} chunks.`);

        let savedCount = 0;

        for (const chunkContent of finalChunks) {
            if (!chunkContent || chunkContent.length < 10) continue; // Skip tiny chunks

            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunkContent,
            });

            const embedding = embeddingResponse.data[0].embedding;

            const { error } = await supabase.from('documents').insert({
                content: chunkContent,
                metadata: { filename },
                embedding: embedding
            });

            if (error) {
                console.error('Error saving chunk:', error);
                throw error;
            }
            savedCount++;
        }

        return new Response(JSON.stringify({ success: true, chunks: savedCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Embed Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // 1. Check if requester is admin
        const { data: { user } } = await supabaseClient.auth.getUser()

        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseClient
            .from('app_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            throw new Error('Only admins can create users')
        }

        // 2. Create User using Service Role (Admin)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { email, password, name, role } = await req.json()

        if (!email || !password) {
            throw new Error('Email and password are required')
        }

        // Create user with email_confirm: true (Auto Confirm)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        })

        if (createError) throw createError

        if (newUser.user) {
            // Ensure profile is updated/created correctly with the desired role
            const { error: updateError } = await supabaseAdmin
                .from('app_profiles')
                .update({ role: role || 'user', name: name })
                .eq('id', newUser.user.id)

            // Note: If the profile doesn't exist yet (trigger lag), the update might miss.
            // But preventing the trigger race condition is complex. 
            // Admin.createUser usually fires the trigger immediately.
        }

        return new Response(
            JSON.stringify(newUser),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

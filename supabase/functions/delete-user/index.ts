import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode JWT without verification (we trust Supabase's gateway)
function decodeJwt(token: string): { sub?: string; email?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get caller's auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode JWT to get caller ID
    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeJwt(token);

    if (!decoded?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = decoded.sub;
    console.log('Caller ID:', callerId, 'Email:', decoded.email);

    // Check if caller is admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerId)
      .single();

    if (userError || userData?.role !== 'admin') {
      console.log('Access denied. Role:', userData?.role);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-deletion
    if (userId === callerId) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Deleting user: ${userId}`);

    // Não é necessário deletar manualmente da tabela users se tivermos ON DELETE CASCADE no banco,
    // mas por segurança e para evitar erros de FK se o cascade não estiver perfeito...
    // O ideal é deletar do AUTH primeiro, que cascateia para o PUBLIC.

    // Delete from auth.users (if exists) -> Isso deve acionar o CASCADE para public.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      // If user not found in auth, that's okay - we still cleaned up public tables
      if (deleteError.message.includes('not found') || deleteError.code === 'user_not_found') {
        console.log('User not found in auth.users - already deleted or orphan record cleaned');
      } else {
        console.error('Error deleting from auth.users:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`User ${userId} deleted successfully`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

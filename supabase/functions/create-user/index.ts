import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar autorização
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Requisição sem token de autorização')
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Decode JWT to get user ID
    const decoded = decodeJwt(token)
    if (!decoded?.sub) {
      console.log('Token JWT inválido')
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const callerId = decoded.sub
    console.log('Caller ID from JWT:', callerId, 'Email:', decoded.email)

    // Verificar se quem chamou é admin usando a tabela users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerId)
      .single()

    console.log('Role query result:', { userData, userError })

    if (userError) {
      console.log('Erro ao buscar role:', userError.message)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Role encontrada para ${decoded.email}: ${userData?.role}`)

    if (userData?.role !== 'admin') {
      console.log(`Usuário não é admin: ${decoded.email} (role: ${userData?.role})`)
      return new Response(JSON.stringify({ error: 'Apenas admins podem criar usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Admin verificado:', decoded.email)

    // Criar novo usuário
    const { name, email, password, role = 'user' } = await req.json()

    console.log(`Admin ${decoded.email} criando usuário: ${email} com role ${role}`)

    // Verificar se email já existe na tabela users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existingUser) {
      console.log('Email já existe na tabela users:', email)
      return new Response(JSON.stringify({ error: 'Este email já está cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Criar no auth COM user_metadata
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Já cria confirmado
      user_metadata: { name }
    })

    if (authError) {
      console.log('Erro ao criar usuário no auth:', authError.message)
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'Este email já está cadastrado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      throw authError
    }

    console.log(`Usuário criado no auth: ${newUser.user.id}`)

    // Aguardar trigger executar (insere na users)
    await new Promise(resolve => setTimeout(resolve, 300))

    // Atualizar dados na tabela users (para garantir role e name corretos)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ name, role })
      .eq('id', newUser.user.id)

    if (updateError) {
      console.log('Erro ao atualizar usuario na tabela:', updateError.message)
      // Não falhar completamente, pois o usuário foi criado
    }

    console.log(`Usuário criado e atualizado com sucesso: ${email}`)

    console.log(`Usuário criado com sucesso: ${email} (${newUser.user.id})`)

    return new Response(JSON.stringify({
      success: true,
      user: { id: newUser.user.id, email, name, role }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    console.error('Erro ao criar usuário:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

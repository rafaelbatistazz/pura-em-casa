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

    // Verificar se quem chamou é admin usando a tabela user_roles
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .single()
    
    if (roleError) {
      console.log('Erro ao buscar role:', roleError.message)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (roleData?.role !== 'admin') {
      console.log('Usuário não é admin:', decoded.email)
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

    // Criar no auth COM user_metadata (o trigger handle_new_user usará o name)
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }  // O trigger usará isso!
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

    // O trigger on_auth_user_created já inseriu em users e user_roles com role='user'
    // Agora apenas atualizamos o name e role se necessário
    
    // Aguardar um momento para o trigger executar
    await new Promise(resolve => setTimeout(resolve, 100))

    // Atualizar o name na tabela users (caso o trigger não tenha pego corretamente)
    const { error: updateNameError } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', newUser.user.id)

    if (updateNameError) {
      console.log('Erro ao atualizar name:', updateNameError.message)
    }

    // Se o role for diferente de 'user', atualizar nas duas tabelas
    if (role !== 'user') {
      console.log(`Atualizando role para: ${role}`)
      
      const { error: updateUsersRoleError } = await supabaseAdmin
        .from('users')
        .update({ role })
        .eq('id', newUser.user.id)

      if (updateUsersRoleError) {
        console.log('Erro ao atualizar role em users:', updateUsersRoleError.message)
      }

      const { error: updateUserRolesError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id)

      if (updateUserRolesError) {
        console.log('Erro ao atualizar role em user_roles:', updateUserRolesError.message)
      }
    }

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

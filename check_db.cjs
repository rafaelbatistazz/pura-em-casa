const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPrompt() {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'ai_chat_config')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const config = JSON.parse(data.value);
  const promptSnippet = config.system_prompt.substring(0, 800);
  console.log('Prompt snippet from database:');
  console.log(promptSnippet);
  
  if (promptSnippet.includes('atendimento –')) {
    console.log('\n❌ PROBLEMA: Ainda tem travessão no banco!');
  } else if (promptSnippet.includes('atendimento,')) {
    console.log('\n✅ CORRETO: Vírgula encontrada no banco!');
  }
}

checkPrompt();

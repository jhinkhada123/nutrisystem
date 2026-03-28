// js/supabase-client.js
const SUPABASE_URL = 'https://gawcpurvwihzppoqdtkd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdhd2NwdXJ2d2loenBwb3FkdGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjcxNDMsImV4cCI6MjA5MDMwMzE0M30.GUJ_fpDE2ZBIPokYHDoAldZtiVjHLSY9L5Mo-RiJd-Y';

// Verifica se a lib do Supabase foi carregada
if (typeof supabase === 'undefined') {
    console.error("A biblioteca do Supabase não foi carregada no escopo global.");
}

// Inicializa o cliente Supabase globalmente
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

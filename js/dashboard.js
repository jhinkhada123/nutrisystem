// js/dashboard.js

// Função para formatar data (YYYY-MM-DD para exibição)
function formatData(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de timezone
    return date.toLocaleDateString('pt-BR');
}

// Carregar Dados da Dashboard
async function loadDashboardData() {
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session) return; // auth.js já redireciona se não houver sessão

        const saudacaoEl = document.getElementById('user-greeting');
        const countPacientesEl = document.getElementById('count-pacientes');
        const countConsultasEl = document.getElementById('count-consultas');
        const listaSemRetornoEl = document.getElementById('lista-sem-retorno');

        if (saudacaoEl) {
            saudacaoEl.textContent = `Olá, ${session.user.user_metadata.full_name || 'Nutricionista'}!`;
        }

        // 1. Total de pacientes ativos
        // O RLS (Row Level Security) garante que apenas os pacientes ligados à nutricionista logada serão lidos
        const { count: countTotalPacientes, error: errorPacientes } = await supabaseClient
            .from('pacientes')
            .select('*', { count: 'exact', head: true });

        if (errorPacientes) throw errorPacientes;
        if (countPacientesEl) countPacientesEl.textContent = countTotalPacientes || 0;

        // 2. Consultas da semana
        // Pegar primeiro e último dia da semana atual baseada na máquina do usuário localmente
        const now = new Date();
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay())); // Domingo
        firstDay.setHours(0, 0, 0, 0);
        
        const lastDay = new Date(firstDay);
        lastDay.setDate(lastDay.getDate() + 6); // Sábado
        lastDay.setHours(23, 59, 59, 999);

        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];

        // O RLS cuidará para que somente as consultas dos pacientes da nutricionista sejam lidas
        const { count: countTotalConsultas, error: errorConsultas } = await supabaseClient
            .from('consultas')
            .select('*', { count: 'exact', head: true })
            .gte('data_consulta', firstDayStr)
            .lte('data_consulta', lastDayStr);

        if (errorConsultas) throw errorConsultas;
        if (countConsultasEl) countConsultasEl.textContent = countTotalConsultas || 0;

        // 3. Pacientes sem retorno
        // Pacientes com mais de 30 dias de sua última consulta e que não tem data agendada futura
        const { data: pacientesConsultas, error: erroListagem } = await supabaseClient
            .from('pacientes')
            .select(`
                id, 
                nome, 
                consultas ( 
                    data_consulta, 
                    proximo_retorno 
                )
            `);

        if (erroListagem) throw erroListagem;

        const limitDate30DaysAgo = new Date();
        limitDate30DaysAgo.setDate(limitDate30DaysAgo.getDate() - 30);
        limitDate30DaysAgo.setHours(0, 0, 0, 0);

        const todayStr = new Date().toISOString().split('T')[0];
        const semRetorno = [];

        pacientesConsultas.forEach(paciente => {
            // Se o paciente não tiver consultas, não entra nesse caso de uso,
            // ou pode ser tratado de outra forma. Aqui apenas os que têm consulta e não têm retorno agendado são processados.
            if (!paciente.consultas || paciente.consultas.length === 0) return;

            // Ordena as consultas pela data decrescente (a mais recente primeiro)
            const consultasOrdenadas = paciente.consultas.sort((a, b) => {
                return new Date(b.data_consulta) - new Date(a.data_consulta);
            });

            const ultimaConsulta = consultasOrdenadas[0];
            const dataUltimaConsulta = new Date(ultimaConsulta.data_consulta + "T00:00:00");

            // Verifica se a última consulta ocorreu há mais de 30 dias
            if (dataUltimaConsulta < limitDate30DaysAgo) {
                // Checa se o paciente não tem "proximo_retorno" agendado para o futuro em CADA consulta
                let temRetornoFuturo = false;
                
                for (let c of consultasOrdenadas) {
                    if (c.proximo_retorno && c.proximo_retorno >= todayStr) {
                        temRetornoFuturo = true;
                        break;
                    }
                }

                if (!temRetornoFuturo) {
                    semRetorno.push(paciente);
                }
            }
        });

        // Limpa o spinner e renderiza a lista
        if (listaSemRetornoEl) {
            listaSemRetornoEl.innerHTML = '';

            if (semRetorno.length === 0) {
                listaSemRetornoEl.innerHTML = '<div class="empty-state">Nenhum paciente sem retorno no momento</div>';
            } else {
                semRetorno.forEach(p => {
                    // Inicial de nome
                    const inicial = p.nome.charAt(0).toUpperCase();

                    const link = document.createElement('a');
                    link.href = `paciente.html?id=${p.id}`;
                    link.className = 'patient-listItem';
                    link.innerHTML = `
                        <div class="patient-avatar">${inicial}</div>
                        <span class="patient-name">${p.nome}</span>
                    `;
                    listaSemRetornoEl.appendChild(link);
                });
            }
        }

    } catch (error) {
        console.error("Erro ao carregar os dados do dashboard:", error.message);
        
        // Em caso de erro renderizar os cards com erro
        const listas = document.querySelectorAll('.stat-value');
        listas.forEach(l => l.innerHTML = '<span style="color:red; font-size:1rem">Erro ao carregar</span>');
        
        const cardLista = document.getElementById('lista-sem-retorno');
        if (cardLista) cardLista.innerHTML = '<div class="empty-state" style="color:red;">Erro na conexão com banco de dados</div>';
    }
}

// Dispara ao iniciar a tela se as credenciais e sessão validarem previamente pelo check do auth.js
document.addEventListener('DOMContentLoaded', () => {
    // Timeout breve apenas para garantir que a promessa de autenticação do Auth.js termine e valide antes
    setTimeout(() => {
        loadDashboardData();
    }, 100);
});

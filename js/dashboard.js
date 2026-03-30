// js/dashboard.js

// Função para formatar data (YYYY-MM-DD para exibição)
function formatData(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de timezone
    return date.toLocaleDateString('pt-BR');
}

// Removido showOnboardingState (substituído pela caixa estática de Beta no HTML)

async function createDemoPatient(event) {
    const btn = event?.currentTarget ?? document.getElementById('btn-create-demo');
    if (btn) { btn.disabled = true; btn.textContent = "Criando..."; }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        // Verifica se já existe um demo
        const { data: existing } = await supabaseClient.from('pacientes').select('id').eq('is_demo', true).limit(1);
        if (existing && existing.length > 0) {
            window.location.href = `paciente.html?id=${existing[0].id}&tab=plano`;
            return;
        }

        const { data: novoPac, error: errPac } = await supabaseClient.from('pacientes').insert([{
            nutricionista_id: session.user.id,
            nome: "Letícia Martins",
            email: "demo@nutriflow.app",
            telefone: "11999999999",
            data_nascimento: "1990-01-01",
            sexo: "F",
            peso_inicial: 65,
            altura: 165,
            objetivos: ["Emagrecimento", "Melhora do sono"],
            nivel_atividade: "Moderado",
            restricoes_alimentares: ["Sem lactose"],
            observacoes: "Paciente relata dificuldade para dormir e busca emagrecimento visando saúde geral. Não possui intolerância severa, mas prefere evitar lactose.",
            is_demo: true
        }]).select().single();
        
        if (errPac) throw errPac;
        
        const { error: errCons } = await supabaseClient.from('consultas').insert([{
            paciente_id: novoPac.id,
            data_consulta: new Date().toISOString().split('T')[0],
            peso: 65,
            observacoes: "Primeira anamnese realizada."
        }]);
        
        if (errCons) throw errCons;
        
        // Vai direto para o Paciente demo aba Plano para o "Aha! moment"
        window.location.href = `paciente.html?id=${novoPac.id}&tab=plano`;
        
    } catch (err) {
        console.error(err);
        alert("Erro ao criar paciente demo.");
        if (btn) { btn.disabled = false; btn.textContent = "Carregar Paciente de Demonstração"; }
    }
}

// Carregar Dados da Dashboard
async function loadDashboardData() {
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session) return; 

        const saudacaoEl = document.getElementById('user-greeting');
        if (saudacaoEl) {
            saudacaoEl.textContent = `Olá, ${session.user.user_metadata.full_name || 'Nutricionista'}!`;
        }

        // 0. Verifica Banners de Demo
        const { data: demoPacientes, count: countDemo } = await supabaseClient
            .from('pacientes')
            .select('id, nome', { count: 'exact' })
            .eq('is_demo', true);
            
        if(countDemo > 0 && demoPacientes && demoPacientes.length > 0) {
            const banner = document.getElementById('demo-banner');
            const nameEl = document.getElementById('demo-patient-name');
            if (nameEl) {
                nameEl.innerHTML = `<a href="paciente.html?id=${demoPacientes[0].id}" style="color:var(--primary-color); text-decoration:underline;"><em>${demoPacientes[0].nome}</em></a>`;
            }
            banner.classList.remove('hidden');
            banner.style.display = 'flex';
        }

        // 1. Lógica Multi-State de Onboarding
        const { data: realPatients, error: errReal } = await supabaseClient
            .from('pacientes')
            .select('id, nome, consultas(id), planos_alimentares(id)')
            .neq('is_demo', true)
            .order('created_at', { ascending: false });

        if (errReal) throw errReal;
        
        const totalRealPacientes = realPatients ? realPatients.length : 0;

        const dashboardMetricsEl = document.getElementById('dashboard-metrics');
        const onboardingStateEl = document.getElementById('onboarding-state');
        
        if (onboardingStateEl) {
            onboardingStateEl.classList.remove('hidden');
        }

        if (dashboardMetricsEl) {
            dashboardMetricsEl.classList.remove('hidden');
            if(totalRealPacientes === 0) {
                dashboardMetricsEl.classList.add('metrics-parallel');
            } else {
                dashboardMetricsEl.classList.remove('metrics-parallel');
            }
        }
        document.getElementById('quick-actions').classList.remove('hidden');

        // Renderiza botões de Demo na área de Onboarding Beta
        const onboardingDemoActions = document.getElementById('onboarding-demo-actions');
        if (onboardingDemoActions) {
            if (countDemo > 0 && demoPacientes && demoPacientes.length > 0) {
                onboardingDemoActions.innerHTML = `
                    <div style="display:flex; flex-wrap:wrap; gap:1rem; align-items:center;">
                        <a href="paciente.html?id=${demoPacientes[0].id}&tab=plano" class="btn btn-secondary" style="background:var(--primary-color); border-color:var(--primary-color); color:white; width:auto; padding: 0.75rem 1.5rem;">Acessar Letícia</a>
                        <button id="btn-onb-remove-demo" class="btn" style="background:transparent; border:1px solid #E8E0E6; color:#6A3E63; width:auto; padding: 0.7rem 1rem; border-radius:var(--radius-md);">Remover Demonstração</button>
                    </div>
                `;
                document.getElementById('btn-onb-remove-demo').addEventListener('click', async () => {
                    const btn = document.getElementById('btn-onb-remove-demo');
                    btn.textContent = "Removendo...";
                    document.getElementById('btn-remove-demo').click(); // Reutiliza a função já ligada a este botão oculto
                });
            } else {
                onboardingDemoActions.innerHTML = `
                    <button id="btn-create-demo" class="btn btn-secondary" style="background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); width: auto; padding: 0.75rem 1.5rem;">Gerar Paciente Teste</button>
                `;
                document.getElementById('btn-create-demo').addEventListener('click', createDemoPatient);
            }
        }

        // ==========================================
        //  Preenchimento de Dashboard Operacional
        // ==========================================

        document.getElementById('count-pacientes').textContent = totalRealPacientes;

        // Consultas da semana (apenas pacientes não-demo)
        const now = new Date();
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay())); 
        firstDay.setHours(0, 0, 0, 0);
        
        const lastDay = new Date(firstDay);
        lastDay.setDate(lastDay.getDate() + 6);
        lastDay.setHours(23, 59, 59, 999);

        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];

        // Precisamos filtrar consultas cujo paciente NÃO É demo. Como a view não está joinada na API JS simples,
        // E o volume de realPatients já tá em memória:
        const validPatientIds = realPatients.map(p => p.id);
        
        if(validPatientIds.length > 0) {
            const { count: countTotalConsultas } = await supabaseClient
                .from('consultas')
                .select('*', { count: 'exact', head: true })
                .gte('data_consulta', firstDayStr)
                .lte('data_consulta', lastDayStr)
                .in('paciente_id', validPatientIds);

            document.getElementById('count-consultas').textContent = countTotalConsultas || 0;
        } else {
            document.getElementById('count-consultas').textContent = 0;
        }

        // Pacientes sem retorno (>30 dias)
        const { data: pacientesConsultas } = await supabaseClient
            .from('pacientes')
            .select(`id, nome, consultas(data_consulta, proximo_retorno)`)
            .neq('is_demo', true);

        const limitDate30DaysAgo = new Date();
        limitDate30DaysAgo.setDate(limitDate30DaysAgo.getDate() - 30);
        limitDate30DaysAgo.setHours(0, 0, 0, 0);
        const todayStr = new Date().toISOString().split('T')[0];
        const semRetorno = [];

        if(pacientesConsultas) {
            pacientesConsultas.forEach(paciente => {
                if (!paciente.consultas || paciente.consultas.length === 0) return;

                const consultasOrdenadas = paciente.consultas.sort((a, b) => new Date(b.data_consulta) - new Date(a.data_consulta));
                const ultimaConsulta = consultasOrdenadas[0];
                const dataUltimaConsulta = new Date(ultimaConsulta.data_consulta + "T00:00:00");

                if (dataUltimaConsulta < limitDate30DaysAgo) {
                    let temRetornoFuturo = false;
                    for (let c of consultasOrdenadas) {
                        if (c.proximo_retorno && c.proximo_retorno >= todayStr) {
                            temRetornoFuturo = true;
                            break;
                        }
                    }
                    if (!temRetornoFuturo) semRetorno.push(paciente);
                }
            });
        }

        const listaSemRetornoEl = document.getElementById('lista-sem-retorno');
        if (listaSemRetornoEl) {
            listaSemRetornoEl.innerHTML = '';
            if (semRetorno.length === 0) {
                listaSemRetornoEl.innerHTML = '<div class="empty-state">Nenhum paciente com retorno pendente há mais de 30 dias.</div>';
            } else {
                semRetorno.forEach(p => {
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
        console.error("Erro ao carregar o dashboard:", error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Remover demo button
    const btnRemove = document.getElementById('btn-remove-demo');
    if(btnRemove) {
        btnRemove.addEventListener('click', async () => {
             if(!confirm('Isso apagará o paciente de demonstração, suas consultas e planos gerados. Confirmar?')) return;

             try {
                 // 1. Buscar IDs dos pacientes demo
                 const { data: demoPacs, error: errFind } = await supabaseClient
                     .from('pacientes')
                     .select('id')
                     .eq('is_demo', true);

                 if (errFind) {
                     alert('Erro ao buscar dados de demonstração: ' + errFind.message);
                     return;
                 }
                 if (!demoPacs || demoPacs.length === 0) {
                     alert('Nenhum dado de demonstração encontrado.');
                     return;
                 }

                 const demoIds = demoPacs.map(p => p.id);

                 // 2. Deletar filhos primeiro: planos_alimentares
                 const { error: errPlanos } = await supabaseClient
                     .from('planos_alimentares')
                     .delete()
                     .in('paciente_id', demoIds);
                 
                 if (errPlanos) {
                     alert('Erro ao excluir planos: ' + errPlanos.message);
                     return;
                 }

                 // 3. Deletar filhos: consultas
                 const { error: errConsultas } = await supabaseClient
                     .from('consultas')
                     .delete()
                     .in('paciente_id', demoIds);
                 
                 if (errConsultas) {
                     alert('Erro ao excluir consultas: ' + errConsultas.message);
                     return;
                 }

                 // 4. Deletar pais: pacientes demo (usando exclusivamente os IDs mapeados)
                 const { error: errPacs } = await supabaseClient
                     .from('pacientes')
                     .delete()
                     .in('id', demoIds);
                 
                 if (errPacs) {
                     alert('Erro ao excluir dados de demonstração: ' + errPacs.message);
                     return;
                 }

                 window.location.reload();

             } catch (err) {
                 console.error('Erro inesperado ao remover demo:', err);
                 alert('Ocorreu um erro inesperado ao remover os dados de demonstração. Tente novamente mais tarde.');
             }
        });
    }

    setTimeout(() => {
        loadDashboardData();
    }, 100);
});

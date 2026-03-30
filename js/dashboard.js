// js/dashboard.js

// Função para formatar data (YYYY-MM-DD para exibição)
function formatData(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de timezone
    return date.toLocaleDateString('pt-BR');
}

// Lógica de Renderização do Onboarding (Estados 1 a 3)
function showOnboardingState(state, targetPatient = null, demoActive = false) {
    document.getElementById('onboarding-state').classList.remove('hidden');
    
    const markDone = (stepNum) => {
        const circle = document.querySelector(`#step-${stepNum} .step-circle`);
        if(circle) {
            circle.style.background = 'var(--primary-color)';
            circle.style.color = 'white';
            circle.innerHTML = '✓';
            circle.style.border = 'none';
        }
    };
    
    const actionsContainer = document.getElementById('onboarding-actions-container');
    
    if (state === 1) {
        actionsContainer.innerHTML = `
            <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <a href="novo-paciente.html" class="btn btn-primary" style="padding: 0.8rem 1.5rem; font-size: 1.05rem; width: auto;">Cadastrar Paciente</a>
                ${!demoActive ? '<button id="btn-create-demo" class="btn btn-secondary" style="background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); width: auto; padding: 0.8rem 1.5rem;">Carregar Paciente de Demonstração</button>' : ''}
            </div>
        `;
        
        if (!demoActive) {
            const btnDemo = document.getElementById('btn-create-demo');
            if (btnDemo) btnDemo.addEventListener('click', createDemoPatient);
        }
    } 
    else if (state === 2) {
        markDone(1);
        actionsContainer.innerHTML = `
            <p style="width: 100%; margin: 0 0 1rem 0; color: var(--primary-color); font-weight: 500;">Paciente cadastrado. Próximo passo: registre as informações da primeira anamnese para habilitar a geração de cardápios.</p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <a href="paciente.html?id=${targetPatient.id}&tab=consultas" class="btn btn-primary" style="padding: 0.8rem 1.5rem; width: auto;">Iniciar Consulta de ${targetPatient.nome.split(' ')[0]}</a>
                ${!demoActive ? '<button onclick="createDemoPatient(event)" class="btn btn-secondary" style="background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); width: auto; padding: 0.8rem 1.5rem;">Carregar Paciente de Demonstração</button>' : ''}
            </div>
        `;
    }
    else if (state === 3) {
        markDone(1);
        markDone(2);
        actionsContainer.innerHTML = `
            <p style="width: 100%; margin: 0 0 1rem 0; color: var(--primary-color); font-weight: 500;">Ótimo! Agora gere o plano alimentar utilizando Inteligência Artificial com base na anamnese registrada.</p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <a href="paciente.html?id=${targetPatient.id}&tab=plano" class="btn btn-primary" style="padding: 0.8rem 1.5rem; width: auto;">Gerar Plano para ${targetPatient.nome.split(' ')[0]}</a>
                ${!demoActive ? '<button onclick="createDemoPatient(event)" class="btn btn-secondary" style="background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); width: auto; padding: 0.8rem 1.5rem;">Carregar Paciente de Demonstração</button>' : ''}
            </div>
        `;
    }
}

async function createDemoPatient(event) {
    const btn = event?.currentTarget ?? document.getElementById('btn-create-demo');
    if (btn) { btn.disabled = true; btn.textContent = "Criando..."; }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
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

        if (totalRealPacientes === 0) {
            showOnboardingState(1, null, countDemo > 0);
            return; // Interrompe fluxo operacional completamente
        }
        
        // Se temos pacientes, exibimos as métricas.
        document.getElementById('dashboard-metrics').classList.remove('hidden');
        document.getElementById('quick-actions').classList.remove('hidden');
        
        let state = 2; 
        let targetPatient = realPatients[0]; // Paciente mais recente por default
        
        const hasConsult = realPatients.some(p => p.consultas && p.consultas.length > 0);
        const hasPlan = realPatients.some(p => p.planos_alimentares && p.planos_alimentares.length > 0);
        
        if (hasPlan) {
            state = 4; // Totalmente Operacional
        } else if (hasConsult) {
            state = 3; 
            targetPatient = realPatients.find(p => p.consultas?.length > 0 && (!p.planos_alimentares || p.planos_alimentares.length === 0)) || targetPatient;
        } else {
            state = 2; // Tem paciente, mas 0 consultas
        }
        
        const dashboardMetricsEl = document.getElementById('dashboard-metrics');
        if (state !== 4) {
            showOnboardingState(state, targetPatient, countDemo > 0);
            if (dashboardMetricsEl) dashboardMetricsEl.classList.add('metrics-parallel');
        } else {
            document.getElementById('onboarding-state').classList.add('hidden');
            if (dashboardMetricsEl) dashboardMetricsEl.classList.remove('metrics-parallel');
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

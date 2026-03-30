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
            email: "demo@prescria.app",
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

        // 0. Verifica Banners de Demo / Tracker de Retorno
        let loginCount = parseInt(localStorage.getItem('prescria_login_count') || '0');
        loginCount += 1;
        localStorage.setItem('prescria_login_count', loginCount.toString());

        const meta = session.user.user_metadata || {};

        // Injeta Bloco do Protocolo da Nutri
        const protocolTrackerEl = document.getElementById('protocol-tracker-container');
        if (protocolTrackerEl) {
            const proto = meta.protocolo_clinico || {};
            const hasProtocol = proto.alimentos_priorizados || proto.alimentos_evitados || proto.observacoes_clinicas;
            
            if (hasProtocol) {
                // Estado: Ativo (Configurado)
                protocolTrackerEl.innerHTML = `
                <div style="background: #FAFAFA; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="color: #2E7D32; display: flex; align-items: center; justify-content: center; background: #E8F5E9; border-radius: 50%; width: 32px; height: 32px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 0.15rem 0; font-size: 0.95rem; color: var(--text-main);">Protocolo da Nutri ativo</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">A IA está gerando planos com base nas suas diretrizes clínicas.</p>
                        </div>
                    </div>
                    <a href="configuracoes.html#protocolo-clinico" class="btn btn-sm" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-main); font-weight: 500; text-decoration: none;">Revisar protocolo</a>
                </div>
                `;
            } else {
                // Estado: Vazio (Não configurado)
                protocolTrackerEl.innerHTML = `
                <div style="background: #FAF8F9; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem 1.5rem; display: flex; align-items: flex-start; gap: 1rem;">
                    <div style="background: #F4EFF3; padding: 10px; border-radius: var(--radius-sm); color: var(--primary-color); display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <div style="flex-grow: 1;">
                        <h3 style="margin: 0 0 0.15rem 0; font-size: 1.05rem; color: var(--text-main);">Aqui, a IA segue a nutricionista</h3>
                        <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: var(--text-muted); line-height: 1.4; max-width: 600px;">
                            Ensine ao Prescria como você prefere prescrever. Quanto mais claro o seu protocolo, mais alinhados ficam os planos gerados.
                        </p>
                        <a href="configuracoes.html#protocolo-clinico" class="btn btn-primary btn-sm" style="width: auto; padding: 0.5rem 1rem; display: inline-block; text-decoration: none;">Configurar Protocolo da Nutri</a>
                    </div>
                </div>
                `;
            }
        }

        const titleOnboarding = document.getElementById('onboarding-title');
        if (titleOnboarding && loginCount > 1) {
            titleOnboarding.innerHTML = 'Bem-vindo de volta ao Beta do <span style="color: var(--primary-color);">Prescria</span>!';
        }
        const { data: demoPacientes, count: countDemo } = await supabaseClient
            .from('pacientes')
            .select('id, nome', { count: 'exact' })
            .eq('is_demo', true);

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
            // As métricas agora estão dentro de uma Aba separada e renderizam normal.
            if(totalRealPacientes === 0) {
                dashboardMetricsEl.classList.add('metrics-parallel');
            } else {
                dashboardMetricsEl.classList.remove('metrics-parallel');
            }
        }
        // document.getElementById('quick-actions').classList.remove('hidden');

        // Lógica de Tabs
        const tabBtnInicio = document.getElementById('tab-btn-inicio');
        const tabBtnMetricas = document.getElementById('tab-btn-metricas');
        const tabContentInicio = document.getElementById('tab-content-inicio');
        const tabContentMetricas = document.getElementById('tab-content-metricas');

        if (tabBtnInicio && tabBtnMetricas) {
            tabBtnInicio.addEventListener('click', () => {
                tabBtnInicio.classList.add('active');
                tabBtnMetricas.classList.remove('active');
                tabContentInicio.classList.remove('hidden');
                tabContentMetricas.classList.add('hidden');
            });

            tabBtnMetricas.addEventListener('click', () => {
                tabBtnMetricas.classList.add('active');
                tabBtnInicio.classList.remove('active');
                tabContentMetricas.classList.remove('hidden');
                tabContentInicio.classList.add('hidden');
            });
        }

        // Renderiza botões de Demo na área de Onboarding Beta
        const onboardingDemoActions = document.getElementById('onboarding-demo-actions');
        if (onboardingDemoActions) {
            if (countDemo > 0 && demoPacientes && demoPacientes.length > 0) {
                onboardingDemoActions.innerHTML = `
                    <div style="display:flex; flex-wrap:wrap; gap:0.75rem; align-items:stretch; width: 100%; margin-top: 0.5rem;">
                        <a href="paciente.html?id=${demoPacientes[0].id}&tab=plano" class="btn btn-primary" style="flex: 1; min-width: 140px; text-decoration: none; margin-top: 0;">Acessar Letícia</a>
                        <button id="btn-onb-remove-demo" class="btn btn-secondary" style="flex: 1; min-width: 140px; margin-top: 0;">Remover Demonstração</button>
                    </div>
                `;
                document.getElementById('btn-onb-remove-demo').addEventListener('click', async () => {
                    await handleRemoveDemo();
                });
            } else {
                onboardingDemoActions.innerHTML = `
                    <button id="btn-create-demo" class="btn btn-secondary" style="width: 100%; margin-top: 0.5rem;">Gerar Paciente Teste</button>
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
                listaSemRetornoEl.innerHTML = '<div class="empty-state">Sem contatos pendentes para hoje.</div>';
            } else {
                semRetorno.forEach(p => {
                    const inicial = p.nome.charAt(0).toUpperCase();
                    const link = document.createElement('a');
                    link.href = `paciente.html?id=${p.id}`;
                    link.className = 'patient-listItem';
                    const avatar = document.createElement('div');
                    avatar.className = 'patient-avatar';
                    avatar.textContent = inicial;

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'patient-name';
                    nameSpan.textContent = p.nome;

                    link.appendChild(avatar);
                    link.appendChild(nameSpan);

                    listaSemRetornoEl.appendChild(link);
                });
            }
        }

    } catch (error) {
        console.error("Erro ao carregar o dashboard:", error.message);
    }
}

// Função Centralizada para Remover Dados de Demonstração
async function handleRemoveDemo() {
     const confirmed = await showCustomConfirm(
        'Remover Demonstração',
        'Isso apagará o paciente de demonstração, suas consultas e planos gerados. Esta ação não pode ser desfeita.',
        true // isDanger
     );

     if(!confirmed) return;

     const btn = document.getElementById('btn-onb-remove-demo');
     if(btn) btn.textContent = "Removendo...";

     try {
         // 1. Buscar IDs dos pacientes demo
         const { data: demoPacs, error: errFind } = await supabaseClient
             .from('pacientes')
             .select('id')
             .eq('is_demo', true);

         if (errFind) {
             alert('Erro ao buscar dados de demonstração: ' + errFind.message);
             if(btn) btn.textContent = "Remover Demonstração";
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
             if(btn) btn.textContent = "Remover Demonstração";
             return;
         }

         // 3. Deletar filhos: consultas
         const { error: errConsultas } = await supabaseClient
             .from('consultas')
             .delete()
             .in('paciente_id', demoIds);
         
         if (errConsultas) {
             alert('Erro ao excluir consultas: ' + errConsultas.message);
             if(btn) btn.textContent = "Remover Demonstração";
             return;
         }

         // 4. Deletar pais: pacientes demo (usando exclusivamente os IDs mapeados)
         const { error: errPacs } = await supabaseClient
             .from('pacientes')
             .delete()
             .in('id', demoIds);
         
         if (errPacs) {
             alert('Erro ao excluir dados de demonstração: ' + errPacs.message);
             if(btn) btn.textContent = "Remover Demonstração";
             return;
         }

         window.location.reload();

     } catch (err) {
         console.error('Erro inesperado ao remover demo:', err);
         alert('Ocorreu um erro inesperado ao remover os dados de demonstração. Tente novamente mais tarde.');
         if(btn) btn.textContent = "Remover Demonstração";
     }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadDashboardData();
    }, 100);
});

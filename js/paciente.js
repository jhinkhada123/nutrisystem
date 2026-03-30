// js/paciente.js

let currentPatientId = null;
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Pegar ID da URL
    const urlParams = new URLSearchParams(window.location.search);
    currentPatientId = urlParams.get('id');

    if (!currentPatientId) {
        alert("Paciente não encontrado!");
        window.location.href = "pacientes.html";
        return;
    }

    // Identifica aba via param
    const tabTarget = urlParams.get('tab');

    setTimeout(() => {
        setupTabs(tabTarget);
        setupCalculations();
        loadPatientProfile();
    }, 100);

    // Eventos do Modal
    setupModal();
    setupAIPlanos();
    
    // Evento Form principal (Update)
    const updateForm = document.getElementById('form-edicao-paciente');
    if (updateForm) {
        updateForm.addEventListener('submit', handleUpdatePatient);
    }
});

/* =======================================================
   CARREGAMENTO E BIND DOS DADOS (READ)
======================================================= */
async function loadPatientProfile() {
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session) return;

        // Pega paciente
        const { data: paciente, error: pacError } = await supabaseClient
            .from('pacientes')
            .select(`*, consultas(*), planos_alimentares(*)`)
            .eq('id', currentPatientId)
            .single();

        if (pacError || !paciente) throw pacError || new Error("Não encontrado");

        // Título
        document.getElementById('paciente-nome-header').textContent = paciente.nome;

        // BIND: Aba Pessoal
        document.getElementById('nome').value = paciente.nome || '';
        document.getElementById('data_nascimento').value = paciente.data_nascimento || '';
        document.getElementById('sexo').value = paciente.sexo || '';
        document.getElementById('telefone').value = paciente.telefone || '';
        document.getElementById('whatsapp').value = paciente.whatsapp || '';
        document.getElementById('email').value = paciente.email || '';

        // Dispara trigger de idade
        document.getElementById('data_nascimento').dispatchEvent(new Event('change'));

        // BIND: Aba Clínico
        document.getElementById('peso').value = paciente.peso_inicial || '';
        document.getElementById('altura').value = paciente.altura || '';
        document.getElementById('peso').dispatchEvent(new Event('input')); // Calc IMC

        document.getElementById('nivel_atividade').value = paciente.nivel_atividade || '';
        document.getElementById('medicamentos').value = paciente.medicamentos || '';
        document.getElementById('suplementos').value = paciente.suplementos || '';

        // BIND: Checkboxes Multi (Objetivos, Patologias, etc)
        bindCheckboxesAndText('grid-objetivos', 'objetivo_texto', paciente.objetivos, paciente.objetivo_texto);
        bindCheckboxesAndText('grid-patologias', 'patologias_extra', paciente.patologias);
        bindCheckboxesAndText('grid-restricoes', 'restricoes_extra', paciente.restricoes_alimentares);
        bindCheckboxesAndText('grid-alergias', 'alergias_extra', paciente.alergias);

        // BIND: Aba Hábitos
        document.getElementById('refeicoes').value = paciente.refeicoes_por_dia || '';
        document.getElementById('litros_agua').value = paciente.litros_agua || '';
        document.getElementById('hora_acorda').value = paciente.horario_acorda || '';
        document.getElementById('hora_dorme').value = paciente.horario_dorme || '';
        
        const chkPratica = document.getElementById('pratica_fisica');
        chkPratica.checked = paciente.atividade_fisica === true;
        chkPratica.dispatchEvent(new Event('change'));
        document.getElementById('atividade_descricao').value = paciente.atividade_fisica_descricao || '';
        document.getElementById('observacoes').value = paciente.observacoes || '';

        // Novo: Realidade e Contexto
        if (document.getElementById('orcamento_alimentar')) document.getElementById('orcamento_alimentar').value = paciente.orcamento_alimentar || '';
        if (document.getElementById('tempo_cozinhar')) document.getElementById('tempo_cozinhar').value = paciente.tempo_cozinhar || '';
        if (document.getElementById('alimentos_preferidos')) document.getElementById('alimentos_preferidos').value = paciente.alimentos_preferidos || '';
        if (document.getElementById('alimentos_evitados')) document.getElementById('alimentos_evitados').value = paciente.alimentos_evitados || '';
        if (document.getElementById('contexto_social')) document.getElementById('contexto_social').value = paciente.contexto_social || '';

        /* PROCESSAR CONSULTAS E PLANOS */
        renderConsultations(paciente.consultas || []);
        renderPlanHistory(paciente.planos_alimentares || []);

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        alert("Erro ao carregar os dados do paciente.");
    }
}

// Lógica de repopular Multi-Checkboxes
function bindCheckboxesAndText(gridId, extraInputId, arrayValues, extraValueOpt) {
    if (!arrayValues) arrayValues = [];
    
    const wrapper = document.getElementById(gridId);
    if (!wrapper) return;

    const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]');
    const extraInput = document.getElementById(extraInputId);
    let remaining = [];

    // Marcar as caixas que tem valor exato e separar os "extras"
    arrayValues.forEach(val => {
        let found = false;
        checkboxes.forEach(cb => {
            if (cb.value === val) {
                cb.checked = true;
                found = true;
            }
        });
        if (!found && val !== 'Nenhum') remaining.push(val);
    });

    // Se existe apenas 1 extra e for string direta (como o objetivo_texto do banco)
    if (extraValueOpt) {
        extraInput.value = extraValueOpt;
    } else {
        // Se vieram itens arrays livres (como patologia extra embutida no array)
        if (remaining.length > 0) {
            extraInput.value = remaining.join(', ');
        } else {
            extraInput.value = '';
        }
    }

    // Acionar lógica do checkbox "Nenhum" caso ele seja a única array ('Nenhum')
    if (arrayValues.includes('Nenhum')) {
        const noneCb = wrapper.querySelector('.chk-none');
        if (noneCb) {
            noneCb.checked = true;
            noneCb.dispatchEvent(new Event('change'));
        }
    }
}

/* =======================================================
   SALVAMENTO DO PERFIL (UPDATE)
======================================================= */
async function handleUpdatePatient(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const extractChecks = (gridId) => {
        const arr = [];
        document.querySelectorAll(`#${gridId} input:checked`).forEach(n => {
            if(n.value !== 'Nenhum') arr.push(n.value);
        });
        return arr;
    };

    const payload = {
        nome: document.getElementById('nome').value.trim(),
        data_nascimento: document.getElementById('data_nascimento').value || null,
        sexo: document.getElementById('sexo').value || null,
        telefone: document.getElementById('telefone').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        email: document.getElementById('email').value.trim(),
        
        peso_inicial: parseFloat(document.getElementById('peso').value) || null,
        altura: parseFloat(document.getElementById('altura').value) || null,
        
        objetivos: extractChecks('grid-objetivos'),
        objetivo_texto: document.getElementById('objetivo_texto').value.trim(),
        nivel_atividade: document.getElementById('nivel_atividade').value || null,
        
        patologias: extractChecks('grid-patologias'),
        restricoes_alimentares: extractChecks('grid-restricoes'),
        alergias: extractChecks('grid-alergias'),
        
        medicamentos: document.getElementById('medicamentos').value.trim(),
        suplementos: document.getElementById('suplementos').value.trim(),
        
        refeicoes_por_dia: parseInt(document.getElementById('refeicoes').value) || null,
        horario_acorda: document.getElementById('hora_acorda').value.trim(),
        horario_dorme: document.getElementById('hora_dorme').value.trim(),
        litros_agua: parseFloat(document.getElementById('litros_agua').value) || null,
        
        atividade_fisica: document.getElementById('pratica_fisica').checked,
        atividade_fisica_descricao: document.getElementById('atividade_descricao').value.trim(),
        observacoes: document.getElementById('observacoes').value.trim(),
        
        // Novo: Realidade e Contexto
        orcamento_alimentar: document.getElementById('orcamento_alimentar') ? document.getElementById('orcamento_alimentar').value : null,
        tempo_cozinhar: document.getElementById('tempo_cozinhar') ? document.getElementById('tempo_cozinhar').value : null,
        alimentos_preferidos: document.getElementById('alimentos_preferidos') ? document.getElementById('alimentos_preferidos').value.trim() : null,
        alimentos_evitados: document.getElementById('alimentos_evitados') ? document.getElementById('alimentos_evitados').value.trim() : null,
        contexto_social: document.getElementById('contexto_social') ? document.getElementById('contexto_social').value.trim() : null
    };

    // Concatenar texto extra dos checks
    const pExtra = document.getElementById('patologias_extra').value.trim();
    if(pExtra) payload.patologias.push(pExtra);
    
    const rExtra = document.getElementById('restricoes_extra').value.trim();
    if(rExtra) payload.restricoes_alimentares.push(rExtra);

    const aExtra = document.getElementById('alergias_extra').value.trim();
    if(aExtra) payload.alergias.push(aExtra);

    try {
        const { error } = await supabaseClient
            .from('pacientes')
            .update(payload)
            .eq('id', currentPatientId);

        if (error) throw error;
        
        showAlert('Alterações salvas com sucesso!', 'success');
        document.getElementById('paciente-nome-header').textContent = payload.nome;

    } catch (err) {
        console.error(err);
        showAlert('Erro ao atualizar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Alterações';
    }
}

/* =======================================================
   SISTEMA DE CONSULTAS (CHART E MODAL)
======================================================= */
function renderConsultations(consultasArray) {
    const listEl = document.getElementById('consultation-list-container');
    const msgEmpty = document.getElementById('chart-empty-message');
    
    if (!consultasArray || consultasArray.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Nenhuma anamnese registrada</h4>
                <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem auto;">Registre os dados clínicos, exames e restrições alimentares do paciente para gerar um plano personalizado com IA.</p>
                <button onclick="document.getElementById('modal-consulta').classList.remove('hidden')" class="btn btn-primary" style="width: auto; padding: 0.6rem 1.2rem;">+ Iniciar Primeira Consulta</button>
            </div>
        `;
        msgEmpty.style.display = 'none';
        if (chartInstance) chartInstance.destroy();
        return;
    }

    msgEmpty.style.display = 'none';

    // Ordenar Listagem: Mais recentes primeiro (Decrescente)
    const viewList = [...consultasArray].sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta));
    
    listEl.innerHTML = '';
    viewList.forEach(c => {
        let obs = c.observacoes ? `<p style="margin-top:0.5rem; font-size:0.9rem; color:var(--text-muted); padding: 0.5rem; background: #FAF8F9; border-radius:4px;">${c.observacoes}</p>` : '';
        let prox = c.proximo_retorno ? `<br><strong style="font-size:0.85rem; color:var(--primary-color);">Prox. Retorno: ${formatDateDisplay(c.proximo_retorno)}</strong>` : '';
        
        // Formatar % gordura / CM com condicional
        let cint = c.cintura ? ` &bull; <span>Cintura: ${c.cintura}cm</span>` : '';
        let quad = c.quadril ? ` &bull; <span>Quadril: ${c.quadril}cm</span>` : '';
        let gord = c.percentual_gordura ? ` &bull; <span>Gordura: ${c.percentual_gordura}%</span>` : '';

        // Montar DOM 
        const card = document.createElement('div');
        card.className = 'consultation-card';
        card.innerHTML = `
            <div class="consultation-header">
                <span style="font-weight:600; font-size:1.1rem; color:var(--text-main);">${formatDateDisplay(c.data_consulta)}</span>
            </div>
            <div style="font-size:0.95rem; color: #4A5568;">
                <strong>Peso: ${c.peso}kg</strong> ${cint} ${quad} ${gord}
                ${prox}
            </div>
            ${obs}
        `;
        listEl.appendChild(card);
    });

    // Ordenar Chart: Mais antigas primeiro (Crescente) na linha do tempo
    const chartList = [...consultasArray].sort((a,b) => new Date(a.data_consulta) - new Date(b.data_consulta));
    renderWeightChart(chartList);
}

function formatDateDisplay(dStr) {
    const d = new Date(dStr + "T00:00:00");
    return d.toLocaleDateString('pt-BR');
}

// Criar o Gráfico de Evolução de Peso
function renderWeightChart(chartData) {
    const ctx = document.getElementById('weight-chart');
    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy(); // Limpar antígo pra ñ sobrepor
    }

    const labels = chartData.map(c => {
        const d = new Date(c.data_consulta + "T00:00:00");
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    });
    
    const dataPoints = chartData.map(c => parseFloat(c.peso) || 0);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso Histórico (kg)',
                data: dataPoints,
                borderColor: '#6A3E63', // primary-color
                backgroundColor: 'rgba(106, 62, 99, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#FFF',
                pointBorderColor: '#6A3E63',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(28, 43, 32, 0.9)'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#E2E8E4' } // border-color
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Injeção de Modal Events
function setupModal() {
    const modal = document.getElementById('modal-consulta');
    if (!modal) return;
    
    const btnOpen = document.getElementById('btn-open-modal-consulta');
    const btnClose = document.getElementById('btn-close-modal');
    
    btnOpen.addEventListener('click', () => {
        // Preencher data default hoje
        document.getElementById('cons_data').value = new Date().toISOString().split('T')[0];
        // Opcional: puxar o último peso p/ facilitar? (Neste prompt ñ dizia explicitamente, farei o básico vazio)
        modal.classList.remove('hidden');
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        document.getElementById('form-nova-consulta').reset();
    }

    btnClose.addEventListener('click', closeModal);
    
    // Auto-Close Fora do Modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Gravar nova consulta (INSERT)
    const formConsulta = document.getElementById('form-nova-consulta');
    formConsulta.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSave = document.getElementById('btn-save-consulta');
        btnSave.disabled = true;
        btnSave.textContent = 'Salvando...';

        const cData = document.getElementById('cons_data').value;
        const cPeso = parseFloat(document.getElementById('cons_peso').value);

        if (!cData || !cPeso) return; // Native required faz isso na vdd

        const payload = {
            paciente_id: currentPatientId,
            data_consulta: cData,
            peso: cPeso,
            cintura: parseFloat(document.getElementById('cons_cintura').value) || null,
            quadril: parseFloat(document.getElementById('cons_quadril').value) || null,
            percentual_gordura: parseFloat(document.getElementById('cons_gordura').value) || null,
            observacoes: document.getElementById('cons_obs').value.trim(),
            proximo_retorno: document.getElementById('cons_retorno').value || null
        };

        try {
            const { error } = await supabaseClient.from('consultas').insert([payload]);
            if (error) throw error;
            
            // Recarrega paciente pra pegar a nova query sem mt fardo
            closeModal();
            loadPatientProfile();
            
            // Sucesso opcional toast
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar consulta: " + err.message);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar Consulta';
        }
    });
}

function showAlert(message, type = 'error') {
    const alertEl = document.getElementById('alert-message');
    if (!alertEl) return;
    alertEl.textContent = message;
    if (type === 'success') {
        alertEl.style.backgroundColor = '#F3EAF1';
        alertEl.style.color = 'var(--primary-color)';
        alertEl.style.borderColor = 'var(--secondary-color)';
    } else {
        alertEl.style.backgroundColor = 'var(--error-bg)';
        alertEl.style.color = 'var(--error-color)';
        alertEl.style.borderColor = 'rgba(211, 47, 47, 0.2)';
    }
    alertEl.className = `alert alert-${type}`;
    alertEl.classList.remove('hidden');
    
    // Auto hide
    setTimeout(() => { alertEl.classList.add('hidden'); }, 4000);
}

// Utilidades base
function setupTabs(initialTab) {
    const tabBtns = document.querySelectorAll('.main-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const formContainer = document.getElementById('form-edicao-paciente');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            // Toggle visual state mapping
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            // Toggle parent Form visibility if navigating away
            if (['tab-pessoal', 'tab-clinico', 'tab-habitos'].includes(targetId)) {
                formContainer.style.display = 'block';
            } else {
                formContainer.style.display = 'none';
            }
        });
    });

    // Interações mutuais em Multi-selects "Nenhum"
    ['grid-patologias', 'grid-restricoes', 'grid-alergias'].forEach(id => {
        const wrap = document.getElementById(id);
        if(!wrap) return;
        const bN = wrap.querySelector('.chk-none');
        const bI = wrap.querySelectorAll('.chk-item');
        if(bN) {
            bN.addEventListener('change', (e) => { if(e.target.checked) bI.forEach(b => b.checked = false); });
            bI.forEach(b => b.addEventListener('change', (e) => { if(e.target.checked) bN.checked = false; }));
        }
    });

    // Set Initial Tab if provided in URL (e.g., ?tab=plano)
    if (initialTab) {
        let triggerDataTarget = 'tab-pessoal';
        if (initialTab === 'plano') triggerDataTarget = 'tab-planos';
        else if (initialTab === 'consultas') triggerDataTarget = 'tab-consultas';

        const btnQuery = document.querySelector(`.main-tabs .tab-btn[data-target="${triggerDataTarget}"]`);
        if (btnQuery) {
            btnQuery.click();
        }
    }
}

function setupCalculations() {
    const dtNascInput = document.getElementById('data_nascimento');
    const idadeDisplay = document.getElementById('idade-display');
    dtNascInput.addEventListener('change', (e) => {
        if (!e.target.value) { idadeDisplay.textContent = '-'; return; }
        const r = new Date(e.target.value); const t = new Date();
        let a = t.getFullYear() - r.getFullYear();
        if ((t.getMonth() - r.getMonth()) < 0 || ((t.getMonth() - r.getMonth()) === 0 && t.getDate() < r.getDate())) a--;
        idadeDisplay.textContent = `${a} anos`;
    });

    const pI = document.getElementById('peso'); const aI = document.getElementById('altura');
    const imcD = document.getElementById('imc-display');
    const calc = () => {
        let p = parseFloat(pI.value); let a = parseFloat(aI.value)/100;
        imcD.textContent = (p > 0 && a > 0) ? (p / (a*a)).toFixed(2) : '--';
    };
    pI.addEventListener('input', calc); aI.addEventListener('input', calc);
    
    const docTel = document.getElementById('telefone');
    const docWpp = document.getElementById('whatsapp');
    const maskPh = (v) => {
        v = v.replace(/\D/g, "");
        if (v.length <= 10) { v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); v = v.replace(/(\d{4})(\d)/, "$1-$2"); } 
        else { v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); v = v.replace(/(\d{5})(\d)/, "$1-$2"); }
        return v.substring(0, 15);
    };
    docTel.addEventListener('input', (e) => e.target.value = maskPh(e.target.value));
    docWpp.addEventListener('input', (e) => e.target.value = maskPh(e.target.value));
    
    const atvChk = document.getElementById('pratica_fisica');
    const atvDx = document.getElementById('pratica_fisica_extra');
    atvChk.addEventListener('change', (e) => {
        atvDx.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) document.getElementById('atividade_descricao').value = '';
    });
}

/* =======================================================
   GERAÇÃO DE PLANOS ALIMENTARES (IA)
======================================================= */
let currentGeneratedPlan = null;

function setupAIPlanos() {
    const btnGerar = document.getElementById('btn-gerar-plano');
    const loadingDiv = document.getElementById('ai-loading');
    const editorDiv = document.getElementById('plan-editor');
    const cardsContainer = document.getElementById('plan-cards-container');
    const btnSalvar = document.getElementById('btn-salvar-plano');

    if (!btnGerar) return;

    btnGerar.addEventListener('click', async () => {
        // Obter os dados atuais preenchidos da UI
        const payload = extractPatientDataForAI();

        loadingDiv.classList.remove('hidden');
        editorDiv.classList.add('hidden');
        
        btnGerar.disabled = true;
        btnGerar.textContent = "Gerando...";

        try {
            const res = await fetch('/api/gerar-plano', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(()=>({}));
                throw new Error(errData.error || 'Erro na comunicação com a API de Inteligência Artificial.');
            }

            currentGeneratedPlan = await res.json();
            
            // Restaura o formato "Edição" caso venha do modo Histórico visual
            btnSalvar.style.display = 'block';
            const h3 = editorDiv.querySelector('h3');
            if(h3) h3.innerHTML = `✨ Plano Alimentar da Consulta`;
            const spanTag = editorDiv.querySelector('span');
            if(spanTag) spanTag.style.display = 'inline-block';
            
            renderEditablePlan(currentGeneratedPlan);
            
            loadingDiv.classList.add('hidden');
            editorDiv.classList.remove('hidden');
            
            showAlert('Plano gerado com sucesso! Revise e edite as opções.', 'success');

        } catch (error) {
            console.error(error);
            loadingDiv.classList.add('hidden');
            showAlert(error.message, 'error');
        } finally {
            btnGerar.disabled = false;
            btnGerar.textContent = "Re-gerar Plano Alimentar";
        }
    });

    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            if (!currentGeneratedPlan) return;
            
            btnSalvar.disabled = true;
            btnSalvar.textContent = "Salvando...";
            
            // Reconstrói o JSON verificando o Schema Version
            let finalPlan;
            if (currentGeneratedPlan && currentGeneratedPlan.schema_version === "2.0") {
                // Para v2.0, o objeto na memória já foi atualizado pelo oninput dos campos
                finalPlan = currentGeneratedPlan;
            } else {
                // Fallback legado v1.0
                finalPlan = {
                    cafe_da_manha: getEditedOptions('cafe_da_manha'),
                    lanche_da_manha: getEditedOptions('lanche_da_manha'),
                    almoco: getEditedOptions('almoco'),
                    lanche_da_tarde: getEditedOptions('lanche_da_tarde'),
                    jantar: getEditedOptions('jantar')
                };
            }

            try {
                const { error } = await supabaseClient
                    .from('planos_alimentares')
                    .insert([{
                        paciente_id: currentPatientId,
                        conteudo: finalPlan
                    }]);

                if (error) throw error;
                
                showAlert('Plano salvo com sucesso no histórico!', 'success');
                editorDiv.classList.add('hidden');
                btnGerar.textContent = "Gerar Plano Alimentar";
                
                // Recarrega paciente para pegar novo plano no histórico
                loadPatientProfile();
                
            } catch (error) {
                 console.error(error);
                 showAlert("Erro ao salvar plano: " + error.message, 'error');
            } finally {
                 btnSalvar.disabled = false;
                 btnSalvar.textContent = "Salvar Plano";
            }
        });
    }

    // Print listener com trava contra duplicação
    const btnImprimir = document.getElementById('btn-imprimir-plano');
    if (btnImprimir && !btnImprimir.dataset.bound) {
        btnImprimir.dataset.bound = 'true';
        btnImprimir.addEventListener('click', handlePrintPlan);
    }
}

/* =======================================================
   PRINT / EXPORT — Monta o #print-layer e dispara print
======================================================= */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function handlePrintPlan() {
    if (!currentGeneratedPlan) return;

    const plan = currentGeneratedPlan;
    const printLayer = document.getElementById('print-layer');
    if (!printLayer) return;

    const patientName = escapeHtml(
        document.getElementById('paciente-nome-header')?.textContent ?? 'Paciente'
    );

    let html = '';

    // Header
    html += `<div class="print-header">
        <h1>${patientName}</h1>
        <h2>Plano Alimentar Personalizado</h2>
    </div>`;

    // Orientações (para o paciente — uso_interno_nutricionista EXCLUÍDO por arquitetura)
    if (plan.orientacoes_paciente) {
        const msg = escapeHtml(plan.orientacoes_paciente.mensagem_motivacional);
        const dicas = escapeHtml(plan.orientacoes_paciente.dicas_gerais);
        if (msg || dicas) {
            html += `<div class="print-motivational">${msg}${dicas ? '<br><br>' + dicas : ''}</div>`;
        }
    }

    // Refeições (nota_clinica_refeicao EXCLUÍDA por arquitetura)
    if (plan.refeicoes) {
        plan.refeicoes.forEach(ref => {
            html += `<div class="print-meal-card">`;
            html += `<div class="print-meal-header">
                <span class="print-meal-title">${escapeHtml(ref.nome)}</span>
                ${ref.horario_sugerido ? `<span class="print-meal-time">${escapeHtml(ref.horario_sugerido)}</span>` : ''}
            </div>`;

            if (ref.opcoes) {
                ref.opcoes.forEach((op, opIdx) => {
                    html += `<div class="print-option">`;
                    html += `<div class="print-option-title"><span class="print-op-badge">${opIdx + 1}</span> ${escapeHtml(op.titulo_opcao)}</div>`;

                    if (op.itens && op.itens.length > 0) {
                        html += `<ul class="print-items">`;
                        op.itens.forEach(item => {
                            const qty = item.quantidade != null ? `<strong>${escapeHtml(String(item.quantidade))}${escapeHtml(item.unidade)}</strong> ` : '';
                            const med = item.medida_caseira ? `<span class="print-medida">(${escapeHtml(item.medida_caseira)})</span>` : '';
                            const obs = item.observacao ? `<span class="print-obs">${escapeHtml(item.observacao)}</span>` : '';
                            html += `<li><span class="print-bullet"></span>${qty}<strong>${escapeHtml(item.alimento)}</strong> ${med} ${obs}</li>`;
                        });
                        html += `</ul>`;
                    }

                    if (op.substituicoes && op.substituicoes.length > 0) {
                        html += `<div class="print-subs">`;
                        html += `<div class="print-subs-title">🔄 Substituições Equivalentes</div>`;
                        html += `<ul class="print-subs-list">`;
                        op.substituicoes.forEach(sub => {
                            const qty = sub.quantidade != null ? `${escapeHtml(String(sub.quantidade))}${escapeHtml(sub.unidade)} de ` : '';
                            const med = sub.medida_caseira ? ` (${escapeHtml(sub.medida_caseira)})` : '';
                            const obs = sub.observacao ? ` — ${escapeHtml(sub.observacao)}` : '';
                            html += `<li>Trocar por: <strong>${qty}${escapeHtml(sub.alimento_substituto)}</strong>${med}${obs}</li>`;
                        });
                        html += `</ul></div>`;
                    }

                    html += `</div>`;
                });
            }

            html += `</div>`;
        });
    }

    // Footer
    const now = new Date();
    html += `<div class="print-footer">
        Documento gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — NutriFlow
    </div>`;

    printLayer.innerHTML = html;

    // Cleanup após impressão
    const cleanup = () => {
        printLayer.innerHTML = '';
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Aguarda render do DOM antes de disparar print
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.print();
        });
    });
}

function extractPatientDataForAI() {
    const extractChecks = (gridId) => {
        const arr = [];
        document.querySelectorAll(`#${gridId} input:checked`).forEach(n => {
            if(n.value !== 'Nenhum') arr.push(n.value);
        });
        return arr;
    };
    
    // Concatena extras
    const pE = document.getElementById('patologias_extra').value.trim();
    const patts = extractChecks('grid-patologias'); if(pE) patts.push(pE);
    
    const rE = document.getElementById('restricoes_extra').value.trim();
    const rests = extractChecks('grid-restricoes'); if(rE) rests.push(rE);
    
    const aE = document.getElementById('alergias_extra').value.trim();
    const aler = extractChecks('grid-alergias'); if(aE) aler.push(aE);

    return {
        nome: document.getElementById('nome').value.trim(),
        idade: document.getElementById('idade-display').textContent.replace('anos','').trim(),
        peso: document.getElementById('peso').value,
        altura: document.getElementById('altura').value,
        imc: document.getElementById('imc-display').textContent,
        objetivos: extractChecks('grid-objetivos'),
        objetivo_texto: document.getElementById('objetivo_texto').value,
        nivel_atividade: document.getElementById('nivel_atividade').value,
        patologias: patts,
        restricoes_alimentares: rests,
        alergias: aler,
        refeicoes_por_dia: document.getElementById('refeicoes').value,
        horario_acorda: document.getElementById('hora_acorda').value,
        horario_dorme: document.getElementById('hora_dorme').value,
        suplementos: document.getElementById('suplementos').value,
        
        orcamento_alimentar: document.getElementById('orcamento_alimentar') ? document.getElementById('orcamento_alimentar').value : '',
        tempo_cozinhar: document.getElementById('tempo_cozinhar') ? document.getElementById('tempo_cozinhar').value : '',
        alimentos_preferidos: document.getElementById('alimentos_preferidos') ? document.getElementById('alimentos_preferidos').value : '',
        alimentos_evitados: document.getElementById('alimentos_evitados') ? document.getElementById('alimentos_evitados').value : '',
        contexto_social: document.getElementById('contexto_social') ? document.getElementById('contexto_social').value : ''
    };
}

function renderEditablePlan(planJson) {
    const btnImprimir = document.getElementById('btn-imprimir-plano');
    if (planJson.schema_version === "2.0") {
        if(btnImprimir) btnImprimir.style.display = 'inline-block';
        renderPlanV2(planJson);
    } else {
        if(btnImprimir) btnImprimir.style.display = 'none';
        renderPlanLegacyV1(planJson);
    }
}

function renderPlanLegacyV1(planJson) {
    const container = document.getElementById('plan-cards-container');
    container.innerHTML = '';
    
    const meals = [
        { key: 'cafe_da_manha', icon: '☀️', title: 'Café da manhã' },
        { key: 'lanche_da_manha', icon: '🍎', title: 'Lanche da manhã' },
        { key: 'almoco', icon: '🥗', title: 'Almoço' },
        { key: 'lanche_da_tarde', icon: '🍊', title: 'Lanche da tarde' },
        { key: 'jantar', icon: '🌙', title: 'Jantar' }
    ];

    meals.forEach(m => {
        const ops = planJson[m.key] || [];
        
        let htmlOps = ops.map(op => `
            <div class="meal-option-row">
                <span class="meal-option-bullet">&bull;</span>
                <input type="text" class="meal-option-input editing-input-${m.key}" value="${op.replace(/"/g, '&quot;')}">
            </div>
        `).join('');

        const card = document.createElement('div');
        card.className = 'meal-card';
        card.innerHTML = `
            <div class="meal-header">
                <span style="font-size: 1.2rem;">${m.icon}</span> ${m.title}
            </div>
            <div class="meal-options">
                ${htmlOps}
            </div>
        `;
        container.appendChild(card);
    });
}

function getEditedOptions(mealKey) {
    const inputs = document.querySelectorAll(`.editing-input-${mealKey}`);
    const arr = [];
    inputs.forEach(input => {
        if(input.value.trim() !== '') arr.push(input.value.trim());
    });
    return arr;
}

function renderPlanV2(plan) {
    const container = document.getElementById('plan-cards-container');
    container.innerHTML = '';

    // Uso Interno
    if (plan.uso_interno_nutricionista) {
        const notes = document.createElement('div');
        notes.className = 'v2-internal-panel';
        notes.innerHTML = `
            <h4><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: -3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Notas da Prescrição Clínica (Apenas Nutricionista)</h4>
            <div class="v2-field-group">
                <label>Racional Clínico & Metas</label>
                <textarea class="v2-edit-input internal-txt" oninput="if(currentGeneratedPlan) currentGeneratedPlan.uso_interno_nutricionista.racional_clinico = this.value">${plan.uso_interno_nutricionista.racional_clinico || ''}</textarea>
            </div>
            ${plan.uso_interno_nutricionista.alertas_prescricao ? `
            <div class="v2-field-group">
                <label style="color: #D32F2F;">Restrições Mapeadas & Alertas (Risco Clínico)</label>
                <div class="v2-alert-text">⚠️ ${plan.uso_interno_nutricionista.alertas_prescricao}</div>
            </div>` : ''}
        `;
        container.appendChild(notes);
    }

    if (plan.orientacoes_paciente) {
        const orient = document.createElement('div');
        orient.className = 'v2-orientations-panel';
        orient.innerHTML = `
            <h4>🗣️ Orientações ao Paciente</h4>
            <textarea class="v2-edit-input" oninput="if(currentGeneratedPlan) currentGeneratedPlan.orientacoes_paciente.mensagem_motivacional = this.value">${plan.orientacoes_paciente.mensagem_motivacional || ''}</textarea>
            <textarea class="v2-edit-input" oninput="if(currentGeneratedPlan) currentGeneratedPlan.orientacoes_paciente.dicas_gerais = this.value" placeholder="Dicas de água, etc.">${plan.orientacoes_paciente.dicas_gerais || ''}</textarea>
        `;
        container.appendChild(orient);
    }

    if (!plan.refeicoes) return;

    plan.refeicoes.forEach((ref, refIndex) => {
        const card = document.createElement('div');
        card.className = 'meal-card v2-meal-card';
        
        // Header
        let html = `
            <div class="v2-meal-header">
                <input type="text" class="v2-edit-input v2-title-input" value="${ref.nome || ''}" oninput="if(currentGeneratedPlan) currentGeneratedPlan.refeicoes[${refIndex}].nome = this.value">
                <div class="v2-time-box">
                    <span>⏰</span>
                    <input type="text" class="v2-edit-input v2-time-input" value="${ref.horario_sugerido || ''}" oninput="if(currentGeneratedPlan) currentGeneratedPlan.refeicoes[${refIndex}].horario_sugerido = this.value">
                </div>
            </div>
        `;

        if (ref.nota_clinica_refeicao) {
            html += `<div class="v2-clinic-note">🔒 <strong>Foco:</strong> ${ref.nota_clinica_refeicao}</div>`;
        }

        if (ref.opcoes) {
            html += `<div class="v2-options-container">`;
            ref.opcoes.forEach((op, opIndex) => {
                html += `
                    <div class="v2-option">
                        <div class="v2-option-title"><span>Opção ${op.ordem || (opIndex + 1)}:</span> <input type="text" class="v2-edit-input" style="flex:1" value="${op.titulo_opcao || ''}" oninput="if(currentGeneratedPlan) currentGeneratedPlan.refeicoes[${refIndex}].opcoes[${opIndex}].titulo_opcao = this.value"></div>
                `;

                const makeEd = (val, field, isNum, rIdx, oIdx, iIdx, sIdx, placeholder = '') => {
                    const v = escapeHtml(String(val ?? ''));
                    const fArgs = `${rIdx}, ${oIdx}, ${iIdx !== null ? iIdx : 'null'}, ${sIdx !== null ? sIdx : 'null'}, '${field}', ${isNum}`;
                    return `<span class="v2-edit-inline" contenteditable="true" spellcheck="false" data-placeholder="${placeholder}"
                            oninput="handleV2InlineEdit(${fArgs}, event)"
                            onblur="handleV2InlineEdit(${fArgs}, event)"
                            onpaste="handleV2InlineEdit(${fArgs}, event)"
                            onkeydown="handleV2InlineEdit(${fArgs}, event)">${v}</span>`;
                };

                if (op.itens && op.itens.length > 0) {
                    html += `<div class="v2-items">`;
                    op.itens.forEach((item, itemIndex) => {
                        const qty = makeEd(item.quantidade, 'quantidade', true, refIndex, opIndex, itemIndex, null, '0');
                        const un = makeEd(item.unidade, 'unidade', false, refIndex, opIndex, itemIndex, null, 'un');
                        const al = makeEd(item.alimento, 'alimento', false, refIndex, opIndex, itemIndex, null, 'Alimento');
                        const med = makeEd(item.medida_caseira, 'medida_caseira', false, refIndex, opIndex, itemIndex, null, 'medida');
                        const obs = makeEd(item.observacao, 'observacao', false, refIndex, opIndex, itemIndex, null, 'obs');

                        html += `
                            <div class="v2-item-row">
                                <span class="v2-bullet"></span>
                                <div class="v2-item-content">
                                    <div class="v2-item-main">
                                        <strong>${qty} ${un}</strong> 
                                        <strong>${al}</strong> 
                                        <span class="v2-medida">( ${med} )</span>
                                    </div>
                                    <div class="v2-item-obs">${obs}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }

                if (op.substituicoes && op.substituicoes.length > 0) {
                    html += `<div class="v2-subs">
                        <div class="v2-subs-title">🔄 Menu de Substituições Equivalentes:</div>
                        <ul>`;
                    op.substituicoes.forEach((sub, subIndex) => {
                        const qty = makeEd(sub.quantidade, 'quantidade', true, refIndex, opIndex, null, subIndex, '0');
                        const un = makeEd(sub.unidade, 'unidade', false, refIndex, opIndex, null, subIndex, 'un');
                        const al = makeEd(sub.alimento_substituto, 'alimento_substituto', false, refIndex, opIndex, null, subIndex, 'Alimento');
                        const med = makeEd(sub.medida_caseira, 'medida_caseira', false, refIndex, opIndex, null, subIndex, 'medida');
                        const obs = makeEd(sub.observacao, 'observacao', false, refIndex, opIndex, null, subIndex, 'obs');

                        html += `<li>Trocar por: <strong>${qty} ${un} de ${al}</strong> <span class="v2-medida">( ${med} )</span> <br><small class="v2-sub-obs">${obs}</small></li>`;
                    });
                    html += `</ul></div>`;
                }

                html += `</div>`; 
            });
            html += `</div>`; 
        }
        card.innerHTML = html;
        container.appendChild(card);
    });
}

function renderPlanHistory(planosArray) {
    const listContainer = document.getElementById('planos-list-container');
    if (!planosArray || planosArray.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state" style="padding: 3rem 1rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Nenhum plano alimentar gerado</h4>
                <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 0 auto;">Gere o primeiro cardápio utilizando Inteligência Artificial com base na consulta recém-registrada.</p>
            </div>
        `;
        return;
    }
    
    // Mais recentes primeiro
    const sorted = [...planosArray].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    listContainer.innerHTML = '';
    
    sorted.forEach(plano => {
        const d = new Date(plano.created_at);
        const card = document.createElement('div');
        card.className = 'plan-card plan-history-item';
        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h4 style="margin: 0; color: var(--primary-color);">🥗 Plano Alimentar Gerado</h4>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div style="color: var(--primary-color);">&#10140;</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
             const editorDiv = document.getElementById('plan-editor');
             const btnSalvar = document.getElementById('btn-salvar-plano');
             
             // Atualiza a memória global para o Print Dialog enxergar o plano atual
             currentGeneratedPlan = plano.conteudo;
             
             editorDiv.classList.remove('hidden');
             
             // Oculta botão de salvar pq é apenas visualização do histórico
             btnSalvar.style.display = 'none'; 
             
             // Altera titulo
             const h3 = editorDiv.querySelector('h3');
             h3.innerHTML = `📖 Histórico: Plano de ${d.toLocaleDateString('pt-BR')}`;
             
             // Oculta tag mode edição livre
             const spanTag = editorDiv.querySelector('span');
             if(spanTag) spanTag.style.display = 'none';

             renderEditablePlan(plano.conteudo);
             
             // Desabilitar edição — cobre V1 (.meal-option-input), V2 (inputs, textareas) e contenteditable
             editorDiv.querySelectorAll('input, textarea, [contenteditable]').forEach(i => {
                 i.readOnly = true;
                 i.disabled = true;
                 i.style.border = 'none';
                 i.style.pointerEvents = 'none';
                 i.removeAttribute('contenteditable');
             });
             
             editorDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        
        listContainer.appendChild(card);
    });
}

/* =======================================================
   V2 INLINE EDIT HELPER — Edição Granular
======================================================= */
window.handleV2InlineEdit = function(refIdx, opIdx, itemIdx, subIdx, field, isNum, event) {
    if (!currentGeneratedPlan) return;
    const el = event.target;
    let val = el.textContent;
    
    // Tratamento defensivo de paste (strip HTML)
    if (event.type === 'paste') {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text.replace(/[\r\n]+/g, ' '));
        return;
    }
    
    // Tratamento defensivo de quebra de linha
    if (event.type === 'keydown' && event.key === 'Enter') {
        event.preventDefault();
        el.blur();
        return;
    }

    // Localiza target na árvore JSON
    let targetObj;
    if (subIdx !== null) {
        targetObj = currentGeneratedPlan.refeicoes[refIdx].opcoes[opIdx].substituicoes[subIdx];
    } else {
        targetObj = currentGeneratedPlan.refeicoes[refIdx].opcoes[opIdx].itens[itemIdx];
    }

    if (event.type === 'blur') {
        if (isNum) {
            val = val.replace(/,/g, '.').replace(/[^\d.]/g, '');
            const num = parseFloat(val);
            targetObj[field] = isNaN(num) ? null : num;
            el.textContent = isNaN(num) ? '' : num;
        } else {
            targetObj[field] = val.trim() || null;
            el.textContent = targetObj[field] || '';
        }
    } else if (event.type === 'input') {
        if (isNum) {
            const num = parseFloat(val.replace(/,/g, '.'));
            targetObj[field] = isNaN(num) ? null : num;
        } else {
            targetObj[field] = val;
        }
    }
};

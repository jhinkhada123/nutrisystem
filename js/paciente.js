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

    setTimeout(() => {
        setupTabs();
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
        observacoes: document.getElementById('observacoes').value.trim()
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
        listEl.innerHTML = '<div class="empty-state">Nenhuma consulta registrada ainda</div>';
        msgEmpty.style.display = 'block';
        if (chartInstance) chartInstance.destroy();
        return;
    }

    msgEmpty.style.display = 'none';

    // Ordenar Listagem: Mais recentes primeiro (Decrescente)
    const viewList = [...consultasArray].sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta));
    
    listEl.innerHTML = '';
    viewList.forEach(c => {
        let obs = c.observacoes ? `<p style="margin-top:0.5rem; font-size:0.9rem; color:var(--text-muted); padding: 0.5rem; background: #F9FAFB; border-radius:4px;">${c.observacoes}</p>` : '';
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
                borderColor: '#2E7D32', // primary-color
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#FFF',
                pointBorderColor: '#2E7D32',
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
        alertEl.style.backgroundColor = '#E8F5E9';
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
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // Checkboxes behavior mutual "Nenhum"
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
            if(h3) h3.innerHTML = `✨ Projeto de Plano Alimentar`;
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
            
            // Reconstrói o JSON baseado nos inputs visuais editados
            const finalPlan = {
                cafe_da_manha: getEditedOptions('cafe_da_manha'),
                lanche_da_manha: getEditedOptions('lanche_da_manha'),
                almoco: getEditedOptions('almoco'),
                lanche_da_tarde: getEditedOptions('lanche_da_tarde'),
                jantar: getEditedOptions('jantar')
            };

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
        suplementos: document.getElementById('suplementos').value
    };
}

function renderEditablePlan(planJson) {
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

function renderPlanHistory(planosArray) {
    const listContainer = document.getElementById('planos-list-container');
    if (!planosArray || planosArray.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">Nenhum plano alimentar gerado ainda</div>';
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
             
             // Desabilitar edição
             document.querySelectorAll('.meal-option-input').forEach(i => {
                 i.readOnly = true;
                 i.style.border = 'none';
                 i.style.pointerEvents = 'none';
             });
             
             editorDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        
        listContainer.appendChild(card);
    });
}


// js/paciente.js

let currentPatientId = null;
let chartInstance = null;
let hasUnsavedChanges = false;

// Helpers Globais de Sanitização (Prevenção XSS)
const escapeHTML = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Exibe um Card de Confirmação customizado (Premium)
 * substitui o confirm() nativo do navegador.
 * @returns {Promise<boolean>}
 */
window.showCustomConfirm = (title, message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');

        if (!modal || !btnOk || !btnCancel) {
            resolve(confirm(message)); // Fallback seguro
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        // Trigger de animação
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.confirm-card').style.transform = 'translateY(0)';
        }, 10);

        const close = (result) => {
            modal.style.opacity = '0';
            modal.querySelector('.confirm-card').style.transform = 'translateY(15px)';
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.add('hidden');
                resolve(result);
            }, 250);
        };

        btnOk.onclick = () => close(true);
        btnCancel.onclick = () => close(false);
        
        // Clique fora para cancelar
        modal.onclick = (e) => {
            if (e.target === modal) close(false);
        };
    });
};

window.handleV2FieldUpdate = function(obj, field, newVal) {
    if (!obj) return;
    if (obj[field] !== newVal) {
        obj[field] = newVal;
        hasUnsavedChanges = true;
    }
};

// Guarda contra perda de alterações não salvas
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Pegar ID da URL
    const urlParams = new URLSearchParams(window.location.search);
    currentPatientId = urlParams.get('id');

    if (!currentPatientId) {
        showAlert("Paciente não encontrado!", "error");
        setTimeout(() => { window.location.href = "pacientes.html"; }, 2000);
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
        // Detectar alterações no formulário
        updateForm.addEventListener('input', () => { hasUnsavedChanges = true; });
        updateForm.addEventListener('change', () => { hasUnsavedChanges = true; });
    }

    // Eventos Logomarca In-line (PDF)
    const btnUploadLogo = document.getElementById('btn-upload-logo-inline');
    const inputLogo = document.getElementById('inline-logo-upload');
    if (btnUploadLogo && inputLogo) {
        btnUploadLogo.addEventListener('click', () => inputLogo.click());

        inputLogo.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const originalText = btnUploadLogo.innerHTML;
            btnUploadLogo.innerHTML = '⏳ Subindo...';
            btnUploadLogo.disabled = true;

            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/png', 0.9);

                try {
                    await supabaseClient.auth.updateUser({ data: { logomarca_url: dataUrl } });
                    btnUploadLogo.innerHTML = '✅ OK!';
                    setTimeout(() => { btnUploadLogo.innerHTML = '🖼️ Trocar Logo'; btnUploadLogo.disabled = false; }, 2000);
                } catch(err) {
                    console.error('Erro ao salvar logomarca:', err);
                    btnUploadLogo.innerHTML = '❌ Erro';
                    setTimeout(() => { btnUploadLogo.innerHTML = originalText; btnUploadLogo.disabled = false; }, 2000);
                }
            };
            img.src = URL.createObjectURL(file);
        });
    }

    // Exclusão de paciente
    const btnExcluir = document.getElementById('btn-excluir-paciente');
    if (btnExcluir) {
        btnExcluir.addEventListener('click', handleDeletePatient);
    }
});

/* =======================================================
   EXCLUSÃO DE PACIENTE
======================================================= */
async function handleDeletePatient() {
    const patientName = document.getElementById('paciente-nome-header')?.textContent || 'este paciente';

    // Monta modal de confirmação
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(26,28,25,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:#fff;width:90%;max-width:420px;padding:2rem;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:slideUpFade 0.3s cubic-bezier(0.16,1,0.3,1);text-align:center;">
            <div style="width:48px;height:48px;border-radius:50%;background:var(--error-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 style="font-size:1.15rem;color:var(--text-main);margin-bottom:0.5rem;">Excluir este paciente permanentemente?</h3>
            <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.35rem;">
                <strong style="color:var(--text-main);">${patientName}</strong>
            </p>
            <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;margin-bottom:1.5rem;">
                Esta ação apagará todo o histórico e não poderá ser desfeita.
            </p>
            <div style="display:flex;gap:0.75rem;">
                <button id="btn-cancel-delete" style="flex:1;padding:0.7rem;border-radius:10px;border:1px solid var(--border-color);background:transparent;color:var(--text-main);font-size:0.9rem;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:inherit;">Cancelar</button>
                <button id="btn-confirm-delete" style="flex:1;padding:0.7rem;border-radius:10px;border:none;background:var(--error-color);color:white;font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;">Excluir paciente</button>
            </div>
            <p id="delete-error-msg" style="display:none;margin-top:1rem;font-size:0.8rem;color:var(--error-color);"></p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cancelar
    overlay.querySelector('#btn-cancel-delete').addEventListener('click', () => {
        overlay.style.animation = 'fadeIn 0.15s ease reverse';
        setTimeout(() => overlay.remove(), 150);
    });

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.animation = 'fadeIn 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
        }
    });

    // Confirmar exclusão
    overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
        const btnConfirm = overlay.querySelector('#btn-confirm-delete');
        const btnCancel = overlay.querySelector('#btn-cancel-delete');
        const errorMsg = overlay.querySelector('#delete-error-msg');

        btnConfirm.textContent = 'Excluindo...';
        btnConfirm.disabled = true;
        btnCancel.disabled = true;
        errorMsg.style.display = 'none';

        try {
            // CASCADE no banco cuida de consultas e planos_alimentares
            const { error } = await supabaseClient
                .from('pacientes')
                .delete()
                .eq('id', currentPatientId);

            if (error) throw error;

            // Sucesso — redireciona
            window.location.href = 'pacientes.html';
        } catch (err) {
            console.error('Erro ao excluir paciente:', err);
            errorMsg.textContent = 'Não foi possível excluir. Tente novamente.';
            errorMsg.style.display = 'block';
            btnConfirm.textContent = 'Excluir permanentemente';
            btnConfirm.disabled = false;
            btnCancel.disabled = false;
        }
    });
}

/* =======================================================
   EXCLUSÃO DE CONSULTA
======================================================= */
window.handleDeleteConsulta = function(consultaId) {
    const modal = document.getElementById('delete-modal');
    if (!modal) return;
    
    const btnCancel = document.getElementById('btn-cancel-delete');
    const btnConfirm = document.getElementById('btn-confirm-delete');
    const modalBox = modal.children[0];

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.style.opacity = '1';
    modalBox.style.transform = 'translateY(0)';

    const closeModal = () => {
        modal.style.opacity = '0';
        modalBox.style.transform = 'translateY(10px)';
        setTimeout(() => { 
            modal.style.display = 'none'; 
            let newCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newCancel, btnCancel);
            let newConfirm = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        }, 200);
    };

    btnCancel.onclick = closeModal;
    
    btnConfirm.onclick = async () => {
        // UI Otimista: Fecha modal e remove card imediatamente
        closeModal();
        const cardToRemove = document.getElementById(`card-consulta-${consultaId}`);
        if (cardToRemove) {
            cardToRemove.style.transition = 'all 0.4s ease';
            cardToRemove.style.opacity = '0';
            cardToRemove.style.transform = 'translateX(20px)';
            setTimeout(() => {
                if (cardToRemove.parentNode) cardToRemove.remove();
                // Se a lista ficar vazia após remover, recarregar para mostrar Empty State
                const listEl = document.getElementById('consultation-list');
                if (listEl && listEl.children.length === 0) {
                    loadPatientProfile();
                }
            }, 400);
        }

        try {
            const { error } = await supabaseClient
                .from('consultas')
                .delete()
                .eq('id', consultaId);
                
            if (error) throw error;
            
            // Recarrega em background para atualizar métricas e gráficos sem travar a UI
            loadPatientProfile();
        } catch(err) {
            console.error(err);
            showAlert('Erro ao excluir consulta: ' + err.message, 'error');
            // Opcional: recarregar a lista caso tenha falhado para o item voltar
            loadPatientProfile();
        }
    };
}

/* =======================================================
   EDIÇÃO INLINE DE OBSERVAÇÃO
======================================================= */
window.toggleEditObs = function(consultaId) {
    const viewEl = document.getElementById(`view-obs-${consultaId}`);
    const editEl = document.getElementById(`edit-obs-${consultaId}`);
    
    if (viewEl.style.display === 'none') {
        viewEl.style.display = 'block';
        editEl.style.display = 'none';
    } else {
        viewEl.style.display = 'none';
        editEl.style.display = 'flex';
    }
};

window.saveEditObs = async function(consultaId) {
    const textarea = document.getElementById(`input-obs-${consultaId}`);
    const newText = textarea.value.trim();
    
    try {
        const { error } = await supabaseClient
            .from('consultas')
            .update({ observacoes: newText })
            .eq('id', consultaId);
            
        if (error) throw error;
        
        showAlert('Observação atualizada.', 'success');
        
        // Atualiza a memória local rápida pra não re-fetch do banco intero, mas ideal re-load
        loadPatientProfile();
    } catch (err) {
        console.error(err);
        showAlert('Erro ao atualizar observação: ' + err.message, 'error');
    }
};

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
    btn.textContent = 'Gravando...';

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
        
        hasUnsavedChanges = false;
        showAlert('Cadastro atualizado.', 'success');
        document.getElementById('paciente-nome-header').textContent = payload.nome;

    } catch (err) {
        console.error(err);
        showAlert('Erro ao atualizar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Atualizar cadastro';
    }
}

/* =======================================================
   SISTEMA DE CONSULTAS (CHART E MODAL)
======================================================= */
function renderConsultations(consultasArray) {
    window.currentConsultations = consultasArray || [];
    const listEl = document.getElementById('consultation-list-container');
    const chartContainer = document.querySelector('.chart-container');
    const msgEmpty = document.getElementById('chart-empty-message');
    
    if (!consultasArray || consultasArray.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Nenhuma consulta registrada.</h4>
                <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem auto;">Registre os dados clínicos, exames e restrições alimentares do paciente para gerar um plano personalizado com IA.</p>
                <button onclick="document.getElementById('modal-consulta').classList.remove('hidden')" class="btn btn-primary" style="width: auto; padding: 0.6rem 1.2rem;">+ Adicionar Consulta</button>
            </div>
        `;
        if (chartContainer) chartContainer.classList.add('chart-hidden');
        if (chartInstance) chartInstance.destroy();
        return;
    }

    // Gerenciamento de Escalonamento do Gráfico
    if (chartContainer) {
        if (consultasArray.length === 1) {
            chartContainer.classList.add('chart-hidden');
        } else if (consultasArray.length >= 2 && consultasArray.length <= 3) {
            chartContainer.classList.remove('chart-hidden');
            chartContainer.classList.add('mini');
        } else {
            chartContainer.classList.remove('chart-hidden', 'mini');
        }
    }

    // Ordenar Listagem: Mais recentes primeiro (Decrescente)
    const viewList = [...consultasArray].sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta));
    
    // Identificar a consulta mais antiga para marcar como Baseline
    const oldestTimestamp = Math.min(...consultasArray.map(c => new Date(c.data_consulta).getTime()));

    listEl.innerHTML = '';
    viewList.forEach(c => {
        const isBaseline = new Date(c.data_consulta).getTime() === oldestTimestamp;
        const textEscaped = escapeHTML(c.observacoes || '');
        let obsContainer = `
            <div style="margin-top:0.85rem; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Anotações</span>
                    <button onclick="window.toggleEditObs('${c.id}')" title="Editar Observação" style="background:none; border:none; cursor:pointer; color: var(--text-muted); transition: color 0.15s; padding: 0;" onmouseover="this.style.color='var(--primary-color)'" onmouseout="this.style.color='var(--text-muted)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
                <!-- View Mode -->
                <div id="view-obs-${c.id}" onclick="window.toggleEditObs('${c.id}')" style="font-size:0.9rem; color: #4A5568; padding: 0.75rem; background: #FAF8F9; border-radius:6px; border: 1px solid #E2E8E4; white-space: pre-wrap; cursor: text; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.backgroundColor='#FFF';" onmouseout="this.style.borderColor='#E2E8E4'; this.style.backgroundColor='#FAF8F9';">${textEscaped ? textEscaped : '<i style="color:#A0AEC0;">Clique aqui para adicionar anotações sobre este retorno...</i>'}</div>
                
                <!-- Edit Mode -->
                <div id="edit-obs-${c.id}" style="display: none; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
                    <textarea id="input-obs-${c.id}" rows="4" maxlength="800" style="width: 100%; border: 1px solid var(--primary-color); border-radius: var(--radius-md); padding: 0.85rem; font-family: inherit; font-size: 0.95rem; line-height: 1.5; color: var(--text-main); background: #FFF; transition: all 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">${textEscaped}</textarea>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn btn-primary" onclick="window.saveEditObs('${c.id}')" style="width: 100%; padding: 0.85rem; font-size: 1rem; font-weight: 600; box-shadow: 0 4px 12px rgba(106, 62, 99, 0.15);">Salvar</button>
                        <button class="btn" onclick="window.toggleEditObs('${c.id}')" style="background: transparent; color: var(--text-muted); font-size: 0.85rem; font-weight: 500; border: none; padding: 0.4rem; cursor: pointer;">Cancelar edição</button>
                    </div>
                </div>
            </div>
        `;

        let prox = c.proximo_retorno ? `<strong style="font-size:0.85rem; color:var(--primary-color);">Prox. Retorno: ${escapeHTML(formatDateDisplay(c.proximo_retorno))}</strong>` : '';
        
        // Formatar % gordura / CM com condicional
        let cint = c.cintura ? ` &bull; <span>Cintura: ${escapeHTML(String(c.cintura))}cm</span>` : '';
        let quad = c.quadril ? ` &bull; <span>Quadril: ${escapeHTML(String(c.quadril))}cm</span>` : '';
        let gord = c.percentual_gordura ? ` &bull; <span>Gordura: ${escapeHTML(String(c.percentual_gordura))}%</span>` : '';

        const badgeText = isBaseline ? 'Avaliação Inicial' : 'Retorno';
        const badgeBg = isBaseline ? '#F3EAF1' : '#F0F4F8';
        const badgeCol = isBaseline ? 'var(--primary-color)' : '#2C5282';

        // Montar DOM 
        const card = document.createElement('div');
        card.id = `card-consulta-${c.id}`;
        card.className = `consultation-card ${isBaseline ? 'baseline' : ''}`;
        card.style.position = 'relative';
        card.innerHTML = `
            <div class="consultation-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                <div>
                    <span style="font-weight:600; font-size:1.1rem; color:var(--text-main); margin-right: 0.75rem;">${escapeHTML(formatDateDisplay(c.data_consulta))}</span>
                    <span style="background: ${badgeBg}; color: ${badgeCol}; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${badgeText}</span>
                </div>
                <button title="Excluir Consulta" onclick="window.handleDeleteConsulta('${c.id}')" style="background:none; border:none; cursor:pointer; color: var(--text-muted); transition: color 0.15s; padding: 0 4px; margin-top:-2px;" onmouseover="this.style.color='var(--error-color)'" onmouseout="this.style.color='var(--text-muted)'">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            <div style="font-size:0.95rem; color: #4A5568;">
                <strong>Peso: ${escapeHTML(String(c.peso))}kg</strong>${cint}${quad}${gord}
            </div>
            ${obsContainer}
            <div style="margin-top: 0.85rem;">${prox}</div>
        `;
        listEl.appendChild(card);
    });

    // Só renderiza gráfico se houver 2 ou mais pontos
    if (consultasArray.length >= 2) {
        const chartList = [...consultasArray].sort((a,b) => new Date(a.data_consulta) - new Date(b.data_consulta));
        // Pequeno delay para garantir que o container mudou de tamanho antes do Chart.js ler o offsetHeight
        setTimeout(() => renderWeightChart(chartList), 50);
    } else {
        if (chartInstance) chartInstance.destroy();
    }
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

    const minWeight = Math.min(...dataPoints);
    const maxWeight = Math.max(...dataPoints);

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
                    suggestedMin: minWeight > 5 ? minWeight - 2 : 0,
                    suggestedMax: maxWeight + 2,
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
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('cons_data');
        dateInput.value = today;
        dateInput.setAttribute('max', today);
        
        // Puxar o peso atual como placeholder/sugestão
        let lastWeight = (window.currentConsultations && window.currentConsultations.length > 0) ? 
                           window.currentConsultations.sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta))[0].peso : '';
        
        if (lastWeight) {
            lastWeight = String(lastWeight).replace('.', ',');
        }
        
        const pesoInput = document.getElementById('cons_peso');
        pesoInput.value = lastWeight;

        modal.classList.remove('hidden');
        setTimeout(() => pesoInput.focus(), 100);
    });

    // Máscaras Dinâmicas e Inteligentes
    const applyMetricMask = (input, type) => {
        let digits = input.value.replace(/\D/g, ''); 
        
        if (type === 'decimal') {
            if (digits.length > 4) digits = digits.slice(0, 4);
            
            // Validação de Range para Decimais (XXX,X)
            const numValue = parseFloat(digits) / 10;
            if (input.id === 'cons_gordura' && numValue > 100) digits = '1000';
            if (input.id === 'cons_peso' && numValue > 500) digits = '5000';
            
            if (digits.length > 1) {
                input.value = digits.slice(0, -1) + ',' + digits.slice(-1);
            } else {
                input.value = digits;
            }
        } else {
            // Inteiro (Cintura/Quadril) - max 3 dígitos (ex: 120)
            if (digits.length > 3) digits = digits.slice(0, 3);
            if (parseInt(digits) > 300) digits = '300';
            input.value = digits;
        }
    };

    ['cons_peso','cons_gordura'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => applyMetricMask(e.target, 'decimal'));
    });

    ['cons_cintura','cons_quadril'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => applyMetricMask(e.target, 'integer'));
    });

    // Inicialização do Flatpickr (Calendário Moderno)
    if (typeof flatpickr !== 'undefined') {
        const fpConfig = {
            locale: "pt",
            dateFormat: "d/m/Y",
            allowInput: true,
            disableMobile: "true",
            onOpen: (selectedDates, dateStr, instance) => {
                instance.calendarContainer.style.zIndex = "9999";
            }
        };
        flatpickr("#cons_data", { ...fpConfig, defaultDate: "today" });
        flatpickr("#cons_retorno", fpConfig);
    }

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
    if (formConsulta) {
        formConsulta.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSave = document.getElementById('btn-save-consulta');
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = 'Gravando...';
            }

            // Helper para converter "dd/mm/aaaa" (Flatpickr) -> "aaaa-mm-dd" (Database)
            const parseFpDate = (id) => {
                const el = document.getElementById(id);
                if (!el) return null;
                const val = el.value;
                if (!val) return null;
                const pts = val.split('/');
                if (pts.length !== 3) return val; 
                return `${pts[2]}-${pts[1]}-${pts[0]}`;
            };

            const cData = parseFpDate('cons_data');
            const cRetorno = parseFpDate('cons_retorno');
            
            // Helper para converter "70,5" -> 70.5
            const parseValue = (id) => {
                const el = document.getElementById(id);
                if (!el) return null;
                const val = el.value.replace(',', '.');
                return val ? parseFloat(val) : null;
            };

            const cPeso = parseValue('cons_peso');

            const resetSaveBtn = () => {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = 'Gravar atendimento';
                }
            };

            if (!cData || !cPeso) {
                showAlert('Por favor, informe a data e o peso do paciente.', 'error');
                resetSaveBtn();
                return;
            }

            // Validação Temporal
            if (cRetorno && cRetorno < cData) {
                showAlert('A data de retorno não pode ser anterior à data da consulta.', 'error');
                resetSaveBtn();
                return;
            }

            // Validação de Duplicidade / Retrospectividade
            const existingDates = (window.currentConsultations || []).map(c => c.data_consulta);
            if (existingDates.includes(cData)) {
                const confirmDuplicity = await window.showCustomConfirm(
                    'Data Duplicada', 
                    'Já existe um registro para esta data. Deseja registrar outra consulta neste mesmo dia?'
                );
                if (!confirmDuplicity) {
                    resetSaveBtn();
                    return;
                }
            } else if (existingDates.length > 0) {
                const mostRecentDate = existingDates.reduce((a, b) => a > b ? a : b);
                if (cData < mostRecentDate) {
                    const confirmRetro = await window.showCustomConfirm(
                        'Inclusão Retroativa',
                        `Esta data é anterior à última avaliação registrada (${formatDateDisplay(mostRecentDate)}). Confirma inclusão no histórico?`
                    );
                    if (!confirmRetro) {
                        resetSaveBtn();
                        return;
                    }
                }
            }

            const payload = {
                paciente_id: currentPatientId,
                data_consulta: cData,
                peso: cPeso,
                cintura: parseValue('cons_cintura'),
                quadril: parseValue('cons_quadril'),
                percentual_gordura: parseValue('cons_gordura'),
                observacoes: document.getElementById('cons_obs').value.trim(),
                proximo_retorno: document.getElementById('cons_retorno').value || null
            };

            try {
                const { error } = await supabaseClient.from('consultas').insert([payload]);
                if (error) throw error;
                
                closeModal();
                loadPatientProfile();
                showAlert('Atendimento registrado.', 'success');
            } catch (err) {
                console.error(err);
                showAlert("Erro ao salvar consulta: " + err.message, 'error');
            } finally {
                resetSaveBtn();
            }
        });
    }
}

function showAlert(message, type = 'error') {
    const alertEl = document.getElementById('alert-message');
    if (!alertEl) return;
    alertEl.textContent = message;
    
    // Reset classes and add specific type
    alertEl.className = 'alert';
    alertEl.classList.add(`alert-${type}`);
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

    // Verificar se a nutricionista possui protocolo configurado
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
        if (user && user.user_metadata && user.user_metadata.protocolo_clinico) {
            window._protocoloNutri = user.user_metadata.protocolo_clinico;
            const badge = document.createElement('div');
            badge.style.marginTop = '0.5rem';
            badge.style.fontSize = '0.85rem';
            badge.style.color = 'var(--text-muted)';
            badge.innerHTML = '🟢 Protocolo da Nutri ativo';
            btnGerar.parentNode.insertBefore(badge, btnGerar.nextSibling);
        }
    });

    btnGerar.addEventListener('click', async () => {
        if (hasUnsavedChanges) {
            const confirmDiscard = confirm("Atenção! Você possui alterações não salvas neste plano alimentar. Se gerar um novo, perderá todo o progresso não salvo. Deseja mesmo sobrepor o rascunho atual?");
            if (!confirmDiscard) return;
        }

        // Obter os dados atuais preenchidos da UI
        const payload = extractPatientDataForAI();

        loadingDiv.classList.remove('hidden');
        editorDiv.classList.add('hidden');
        
        btnGerar.disabled = true;
        btnGerar.textContent = "Gerando...";

        try {
            const session = await supabaseClient.auth.getSession();
            const token = session.data.session?.access_token;
            if(!token) throw new Error("Sessão expirada. Faça login novamente.");

            const res = await fetch('/api/gerar-plano', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
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
            if(h3) h3.textContent = `✨ Plano Alimentar da Consulta`;
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
            btnSalvar.textContent = "Gravando...";
            
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
                
                hasUnsavedChanges = false;
                showAlert('Prescrição gravada.', 'success');
                editorDiv.classList.add('hidden');
                btnGerar.textContent = "Gerar Plano Alimentar";
                
                // Recarrega paciente para pegar novo plano no histórico
                loadPatientProfile();
                
            } catch (error) {
                 console.error(error);
                 showAlert("Erro ao salvar plano: " + error.message, 'error');
            } finally {
                 btnSalvar.disabled = false;
                 btnSalvar.textContent = "Gravar prescrição";
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

async function handlePrintPlan() {
    if (!currentGeneratedPlan) return;

    const plan = currentGeneratedPlan;

    const patientName = escapeHtml(
        document.getElementById('paciente-nome-header')?.textContent ?? 'Paciente'
    );

    // Buscar logomarca no perfil do usuário
    const { data: { user } } = await supabaseClient.auth.getUser();
    const logoUrl = user?.user_metadata?.logomarca_url;

    let body = '';

    // Header
    body += `<div class="print-header">`;
    if (logoUrl) {
        body += `
        <div style="text-align: center; margin-bottom: 0.5rem;">
            <img src="${logoUrl}" alt="Logo da Clínica" style="max-height: 50px; max-width: 240px; object-fit: contain;">
        </div>`;
    }
    body += `
        <h1>${patientName}</h1>
        <h2>Plano Alimentar Personalizado</h2>
    </div>`;

    // Orientações
    if (plan.orientacoes_paciente) {
        const msg = escapeHtml(plan.orientacoes_paciente.mensagem_motivacional);
        const dicas = escapeHtml(plan.orientacoes_paciente.dicas_gerais);
        if (msg || dicas) {
            body += `<div class="print-motivational">${msg}${dicas ? '<br><br>' + dicas : ''}</div>`;
        }
    }

    // Refeições
    if (plan.refeicoes) {
        plan.refeicoes.forEach(ref => {
            body += `<div class="print-meal-card">`;
            body += `<div class="print-meal-header">
                <span class="print-meal-title">${escapeHtml(ref.nome)}</span>
                ${ref.horario_sugerido ? `<span class="print-meal-time">${escapeHtml(ref.horario_sugerido)}</span>` : ''}
            </div>`;

            if (ref.opcoes) {
                ref.opcoes.forEach((op, opIdx) => {
                    body += `<div class="print-option">`;
                    body += `<div class="print-option-title"><span class="print-op-badge">${opIdx + 1}</span> ${escapeHtml(op.titulo_opcao)}</div>`;

                    if (op.itens && op.itens.length > 0) {
                        body += `<ul class="print-items">`;
                        op.itens.forEach(item => {
                            const qty = item.quantidade != null ? `<strong>${escapeHtml(String(item.quantidade))}${escapeHtml(item.unidade)}</strong> ` : '';
                            const med = item.medida_caseira ? `<span class="print-medida">(${escapeHtml(item.medida_caseira)})</span>` : '';
                            const obs = item.observacao ? `<span class="print-obs">${escapeHtml(item.observacao)}</span>` : '';
                            body += `<li><span class="print-bullet"></span>${qty}<strong>${escapeHtml(item.alimento)}</strong> ${med} ${obs}</li>`;
                        });
                        body += `</ul>`;
                    }

                    if (op.substituicoes && op.substituicoes.length > 0) {
                        body += `<div class="print-subs">`;
                        body += `<div class="print-subs-title">🔄 Substituições Equivalentes</div>`;
                        body += `<ul class="print-subs-list">`;
                        op.substituicoes.forEach(sub => {
                            const qty = sub.quantidade != null ? `${escapeHtml(String(sub.quantidade))}${escapeHtml(sub.unidade)} de ` : '';
                            const med = sub.medida_caseira ? ` (${escapeHtml(sub.medida_caseira)})` : '';
                            const obs = sub.observacao ? ` — ${escapeHtml(sub.observacao)}` : '';
                            body += `<li>Trocar por: <strong>${qty}${escapeHtml(sub.alimento_substituto)}</strong>${med}${obs}</li>`;
                        });
                        body += `</ul></div>`;
                    }

                    body += `</div>`;
                });
            }

            body += `</div>`;
        });
    }

    // Footer — discreto, assinatura leve
    const now = new Date();
    body += `<div class="print-footer">
        Documento elaborado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Prescria
    </div>`;

    // Monta um documento HTML completo e isolado — sem herança do app
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Plano Alimentar — ${patientName}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
        font-family: 'Inter', -apple-system, sans-serif;
        background: white;
        color: #2D3036;
        line-height: 1.35;
        padding: 0;
        margin: 0;
        font-size: 9.5pt;
    }

    @page { size: A4; margin: 8mm 20mm 14mm 20mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* ─── Header ─── */
    .print-header {
        text-align: center;
        margin-bottom: 0.6rem;
        padding-bottom: 0.45rem;
        border-bottom: 1px solid #E8E0E6;
    }
    .print-header h1 {
        font-family: 'Playfair Display', Georgia, serif;
        color: #1F1720;
        font-size: 18pt;
        font-weight: 600;
        margin: 0 0 2px 0;
        letter-spacing: -0.3px;
    }
    .print-header h2 {
        font-family: 'Inter', sans-serif;
        color: #9B7094;
        font-size: 8.5pt;
        margin: 0;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 2.5px;
    }

    /* ─── Motivational ─── */
    .print-motivational {
        background: #FAF8F9;
        border-left: 3px solid #C9A8C2;
        padding: 0.4rem 0.8rem;
        margin-bottom: 0.5rem;
        font-size: 9pt;
        color: #4A4550;
        border-radius: 0 4px 4px 0;
        line-height: 1.4;
        font-style: italic;
    }

    /* ─── Meal Cards ─── */
    .print-meal-card {
        margin-bottom: 0.35rem;
        border: 1px solid #EDE8EB;
        border-radius: 5px;
        padding: 0.4rem 0.7rem;
        break-inside: avoid;
        page-break-inside: avoid;
        display: inline-block;
        width: 100%;
        box-sizing: border-box;
    }
    .print-meal-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding-bottom: 0.2rem;
        margin-bottom: 0.25rem;
        border-bottom: 1px solid #F3EEF2;
        break-after: avoid;
        page-break-after: avoid;
    }
    .print-meal-title {
        font-family: 'Inter', sans-serif;
        font-size: 11pt;
        font-weight: 600;
        color: #1F1720;
        letter-spacing: -0.2px;
    }
    .print-meal-time {
        font-size: 9pt;
        color: #6A3E63;
        font-weight: 600;
        background: #F5EFF4;
        padding: 2px 10px;
        border-radius: 20px;
        letter-spacing: 0.3px;
    }

    /* ─── Options ─── */
    .print-option {
        margin-bottom: 0.2rem;
        padding-bottom: 0.2rem;
        border-bottom: 1px solid #F3EEF2;
        break-inside: avoid;
        page-break-inside: avoid;
    }
    .print-option:last-child {
        border-bottom: none;
        padding-bottom: 0;
        margin-bottom: 0;
    }
    .print-option-title {
        font-size: 9.5pt;
        font-weight: 600;
        color: #6A3E63;
        margin-bottom: 0.2rem;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .print-op-badge {
        background: #6A3E63;
        color: white;
        font-size: 7.5pt;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
        line-height: 1.4;
    }

    /* ─── Items ─── */
    ul.print-items { list-style: none; padding: 0; margin: 0; }
    ul.print-items li {
        margin-bottom: 0.15rem;
        font-size: 9pt;
        line-height: 1.35;
        color: #2D3036;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 3px;
    }
    .print-bullet {
        display: inline-block;
        width: 4px;
        height: 4px;
        background: #C9A8C2;
        border-radius: 50%;
        margin-right: 6px;
        flex-shrink: 0;
        margin-top: 7px;
    }
    .print-medida {
        color: #6B7280;
        font-size: 8.5pt;
        font-weight: 400;
    }
    .print-obs {
        color: #9CA3AF;
        font-size: 8pt;
        font-style: italic;
    }

    /* ─── Substitutions ─── */
    .print-subs {
        margin-top: 0.35rem;
        background: #FAFAFA;
        padding: 0.35rem 0.6rem;
        border-left: 2px solid #C9A8C2;
        border-radius: 0 3px 3px 0;
        font-size: 8.5pt;
    }
    .print-subs-title {
        font-weight: 600;
        color: #6A3E63;
        margin-bottom: 0.2rem;
        font-size: 8.5pt;
    }
    ul.print-subs-list { padding-left: 1rem; margin: 0; }
    ul.print-subs-list li {
        margin-bottom: 0.1rem;
        color: #4A5568;
        font-size: 8.5pt;
    }

    /* ─── Footer ─── */
    .print-footer {
        margin-top: 0.5rem;
        text-align: center;
        font-size: 7.5pt;
        color: #B8B0B6;
        padding-top: 0.5rem;
        letter-spacing: 0.3px;
    }
</style>
</head>
<body>${body}</body>
</html>`;

    // Abre janela limpa, escreve o documento, e dispara print
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
        alert('Por favor, permita pop-ups para imprimir o plano.');
        return;
    }
    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();

    // Aguarda fontes carregarem via document.fonts.ready, com timeout como fallback
    const triggerPrint = () => {
        printWin.print();
        printWin.onafterprint = () => printWin.close();
    };

    printWin.onload = () => {
        if (printWin.document.fonts && printWin.document.fonts.ready) {
            const timeout = setTimeout(triggerPrint, 800); // fallback
            printWin.document.fonts.ready.then(() => {
                clearTimeout(timeout);
                setTimeout(triggerPrint, 50); // micro-delay pós-fonts
            }).catch(() => {
                clearTimeout(timeout);
                triggerPrint();
            });
        } else {
            // Navegador sem suporte a document.fonts — fallback direto
            setTimeout(triggerPrint, 500);
        }
    };
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
        contexto_social: document.getElementById('contexto_social') ? document.getElementById('contexto_social').value : '',
        
        protocolo_nutri: window._protocoloNutri || null
    };
}

function renderEditablePlan(planJson) {
    const btnImprimir = document.getElementById('btn-imprimir-plano');
    const btnUpload = document.getElementById('btn-upload-logo-inline');
    if (planJson.schema_version === "2.0") {
        if(btnImprimir) btnImprimir.style.display = 'inline-block';
        if(btnUpload) btnUpload.style.display = 'inline-block';
        renderPlanV2(planJson);
    } else {
        if(btnImprimir) btnImprimir.style.display = 'none';
        if(btnUpload) btnUpload.style.display = 'none';
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
                <label>Racional Clínico & Metas <span style="color:rgba(106,62,99,0.3); font-size:1.1rem; pointer-events:none; margin-left:4px;" title="Campo editável">&#9998;</span></label>
                <textarea class="v2-edit-input internal-txt" oninput="handleV2FieldUpdate(currentGeneratedPlan?.uso_interno_nutricionista, 'racional_clinico', this.value)">${plan.uso_interno_nutricionista.racional_clinico || ''}</textarea>
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
            <h4>🗣️ Orientações ao Paciente <span style="color:rgba(106,62,99,0.3); font-size:1.1rem; pointer-events:none; margin-left:4px;" title="Seção editável">&#9998;</span></h4>
            <textarea class="v2-edit-input" oninput="handleV2FieldUpdate(currentGeneratedPlan?.orientacoes_paciente, 'mensagem_motivacional', this.value)">${plan.orientacoes_paciente.mensagem_motivacional || ''}</textarea>
            <textarea class="v2-edit-input" oninput="handleV2FieldUpdate(currentGeneratedPlan?.orientacoes_paciente, 'dicas_gerais', this.value)" placeholder="Dicas de água, etc.">${plan.orientacoes_paciente.dicas_gerais || ''}</textarea>
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
                <div style="display:flex; align-items:center; gap:8px; flex:1;">
                    <input type="text" class="v2-edit-input v2-title-input" style="max-width:none;" value="${ref.nome || ''}" oninput="handleV2FieldUpdate(currentGeneratedPlan?.refeicoes[${refIndex}], 'nome', this.value)">
                    <span style="color:rgba(106,62,99,0.3); font-size:1.1rem; pointer-events:none;" title="Título editável">&#9998;</span>
                </div>
                <div class="v2-time-box">
                    <span>⏰</span>
                    <input type="text" class="v2-edit-input v2-time-input" value="${ref.horario_sugerido || ''}" oninput="handleV2FieldUpdate(currentGeneratedPlan?.refeicoes[${refIndex}], 'horario_sugerido', this.value)">
                </div>
                <button class="v2-delete-meal" onclick="handleV2DeleteMeal(${refIndex})" title="Excluir esta refeição">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
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
                        <div class="v2-option-title">
                            <span>Opção ${op.ordem || (opIndex + 1)}:</span> 
                            <input type="text" class="v2-edit-input" style="flex:1" value="${op.titulo_opcao || ''}" oninput="handleV2FieldUpdate(currentGeneratedPlan?.refeicoes[${refIndex}]?.opcoes[${opIndex}], 'titulo_opcao', this.value)">
                            <span style="color:rgba(106,62,99,0.3); font-size:1.1rem; pointer-events:none; margin-left:-4px;" title="Título editável">&#9998;</span>
                        </div>
                `;

                const makeEd = (val, field, isNum, rIdx, oIdx, iIdx, sIdx, placeholder = '') => {
                    const v = escapeHTML(String(val ?? ''));
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

    // Botão "+ Adicionar Refeição"
    const addWrap = document.createElement('div');
    addWrap.className = 'v2-add-meal-container';
    addWrap.innerHTML = `
        <button class="btn-add-meal" onclick="handleV2AddMeal()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Adicionar outra refeição ao plano
        </button>
    `;
    container.appendChild(addWrap);
}

window.handleV2DeleteMeal = function(index) {
    if (!currentGeneratedPlan || !currentGeneratedPlan.refeicoes) return;
    
    nutriConfirmDelete(() => {
        currentGeneratedPlan.refeicoes.splice(index, 1);
        hasUnsavedChanges = true;
        renderPlanV2(currentGeneratedPlan);
        showAlert('Refeição removida.', 'info');
    });
};

window.nutriConfirmDelete = function(onConfirm) {
    const modalRoot = document.getElementById('modal-root') || document.body;
    const modalMarkup = `
        <div id="nutri-confirm-modal" class="nutri-modal-overlay">
            <div class="nutri-modal-card">
                <div class="nutri-modal-icon">⚠️</div>
                <h3>Excluir Refeição?</h3>
                <p>Esta ação removerá todos os alimentos e opções cadastrados nesta refeição. Não poderá ser desfeito.</p>
                <div class="nutri-modal-actions">
                    <button class="btn-secondary" onclick="closeNutriModal()">Manter</button>
                    <button class="btn-danger" id="btn-confirm-delete">Sim, Remover</button>
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = modalMarkup;
    modalRoot.appendChild(div.firstElementChild);
    
    document.getElementById('btn-confirm-delete').onclick = () => {
        onConfirm();
        closeNutriModal();
    };
};

window.closeNutriModal = function() {
    const modal = document.getElementById('nutri-confirm-modal');
    if (modal) modal.remove();
};

window.handleV2AddMeal = function() {
    if (!currentGeneratedPlan) return;
    if (!currentGeneratedPlan.refeicoes) currentGeneratedPlan.refeicoes = [];

    const newMeal = {
        nome: 'Nova Refeição',
        horario_sugerido: '',
        nota_clinica_refeicao: '',
        opcoes: [{
            ordem: 1,
            titulo_opcao: 'Opção Principal',
            itens: [{
                quantidade: null,
                unidade: '',
                alimento: '',
                medida_caseira: '',
                observacao: ''
            }],
            substituicoes: []
        }]
    };

    currentGeneratedPlan.refeicoes.push(newMeal);
    hasUnsavedChanges = true;
    renderPlanV2(currentGeneratedPlan);

    // Scroll suave até o novo card
    setTimeout(() => {
        const cards = document.querySelectorAll('.v2-meal-card');
        if (cards.length > 0) {
            cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);

    showAlert('Nova refeição adicionada ao plano.', 'info');
};

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
        const oldVal = targetObj[field];
        if (isNum) {
            val = val.replace(/,/g, '.').replace(/[^\d.]/g, '');
            const num = parseFloat(val);
            const finalVal = isNaN(num) ? null : num;
            if (oldVal !== finalVal) {
                targetObj[field] = finalVal;
                hasUnsavedChanges = true;
            }
            el.textContent = finalVal !== null ? finalVal : '';
        } else {
            const strVal = val.trim() || null;
            if (oldVal !== strVal) {
                targetObj[field] = strVal;
                hasUnsavedChanges = true;
            }
            el.textContent = strVal || '';
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

window.handleV2FieldUpdate = function(obj, field, val) {
    if(!obj) return;
    obj[field] = val;
    hasUnsavedChanges = true;
};

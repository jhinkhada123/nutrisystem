// js/pacientes.js

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadPatientsList();
    }, 100);
});

let allPatients = []; // Variável global para cache da busca

// Formatar data para DD/MM/YYYY
function formatDate(dateStr) {
    if (!dateStr) return 'Sem consultas';
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString('pt-BR');
}

// Carrega os pacientes do banco de dados
async function loadPatientsList() {
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session) return; // session verification covered by auth.js
        
        // Pega todos os pacientes com suas consultas (para sabermos a última consulta)
        const { data: pacientes, error } = await supabaseClient
            .from('pacientes')
            .select(`
                id, 
                nome, 
                objetivo_texto, 
                objetivos,
                telefone,
                email,
                consultas ( data_consulta ),
                planos_alimentares ( created_at ),
                is_demo
            `)
            .order('nome', { ascending: true });

        if (error) throw error;
        
        allPatients = pacientes || [];
        renderPatients(allPatients);

    } catch (err) {
        console.error("Erro ao carregar pacientes:", err.message);
        const container = document.getElementById('patients-list-container');
        if (container) container.innerHTML = '<div class="empty-state" style="color:red;">Erro ao carregar a lista de pacientes</div>';
    }
}

// Renderiza a lista no DOM
function renderPatients(patientsArray) {
    const container = document.getElementById('patients-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (patientsArray.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 3rem 1rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Nenhum paciente cadastrado</h4>
                <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem auto;">Seu consultório começa aqui. Comece registrando seu primeiro paciente para gerenciar anamneses e dietas.</p>
                <a href="novo-paciente.html" class="btn btn-primary" style="width: auto; padding: 0.6rem 1.2rem;">✚ Cadastrar Paciente</a>
            </div>
        `;
        return;
    }

    patientsArray.forEach(p => {
        let ultimaConsultaTexto = "Sem consultas";
        if (p.consultas && p.consultas.length > 0) {
            const sortByDate = p.consultas.sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta));
            ultimaConsultaTexto = formatDate(sortByDate[0].data_consulta);
        }

        let ultimoPlanoTexto = null;
        if (p.planos_alimentares && p.planos_alimentares.length > 0) {
            const sortByCreated = p.planos_alimentares.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const planoDate = new Date(sortByCreated[0].created_at);
            ultimoPlanoTexto = planoDate.toLocaleDateString('pt-BR');
        }

        const inicial = p.nome.charAt(0).toUpperCase();

        let objetivo = "Objetivo não definido";
        if (p.objetivos && p.objetivos.length > 0) {
            objetivo = p.objetivos.join(", ");
        } else if (p.objetivo_texto) {
            objetivo = p.objetivo_texto;
        }

        const card = document.createElement('div');
        card.className = 'patient-card';
        card.dataset.patientId = p.id;

        card.innerHTML = `
            <div class="patient-info">
                <div class="patient-avatar" style="width: 48px; height: 48px; font-size: 1.2rem;">${inicial}</div>
                <div class="patient-details">
                    <h4 style="display:flex; align-items:center; gap:8px;">
                        ${p.nome}
                        ${p.is_demo ? '<span style="font-size: 0.65rem; background:#F3EAF1; color:#6A3E63; padding: 2px 6px; border-radius:10px; font-weight:600;">DEMO</span>' : ''}
                    </h4>
                    <p class="patient-meta">${objetivo}</p>
                </div>
            </div>
            <div class="patient-status">
                <div>Última consulta</div>
                <strong style="color: var(--text-main); font-size: 0.95rem;">${ultimaConsultaTexto}</strong>
                ${ultimoPlanoTexto ? `<div style="margin-top: 0.35rem; font-size: 0.8rem; color: var(--primary-color);">Plano: ${ultimoPlanoTexto}</div>` : ''}
            </div>
            <div class="patient-card-actions">
                <button class="btn-ctx-menu" title="Mais ações" aria-label="Mais ações" data-patient-id="${p.id}" data-patient-name="${p.nome}">⋮</button>
            </div>
        `;

        // Clique na área principal → abre ficha (ignora se clicou no botão ⋮ ou no menu)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-ctx-menu') || e.target.closest('.patient-context-menu')) return;
            window.location.href = `paciente.html?id=${p.id}`;
        });

        // Clique no botão ⋮ → abre/fecha context menu
        const btnCtx = card.querySelector('.btn-ctx-menu');
        btnCtx.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleContextMenu(card, p.id, p.nome);
        });
        
        container.appendChild(card);
    });
}

/* =======================================================
   CONTEXT MENU — Toggle, Build, Close
======================================================= */
function closeAllContextMenus() {
    document.querySelectorAll('.patient-context-menu').forEach(m => {
        if (m.parentElement) m.parentElement.style.zIndex = '';
        m.remove();
    });
}

function toggleContextMenu(cardEl, patientId, patientName) {
    const existing = cardEl.querySelector('.patient-context-menu');
    closeAllContextMenus();

    // Se já existia neste card, apenas feche (toggle)
    if (existing) return;

    // Elevar card acima dos irmãos
    cardEl.style.zIndex = '100';

    const menu = document.createElement('div');
    menu.className = 'patient-context-menu';
    menu.innerHTML = `
        <button class="ctx-item" data-action="open">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Abrir ficha
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item ctx-item--danger" data-action="delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Excluir paciente
        </button>
    `;

    // Handlers do menu
    menu.querySelector('[data-action="open"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `paciente.html?id=${patientId}`;
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllContextMenus();
        deletePatientFromList(patientId, patientName);
    });

    // Impedir propagação de cliques no menu
    menu.addEventListener('click', (e) => e.stopPropagation());

    cardEl.appendChild(menu);
}

// Fechar menus ao clicar fora
document.addEventListener('click', () => {
    closeAllContextMenus();
});

/* =======================================================
   EXCLUSÃO DE PACIENTE (a partir da lista)
======================================================= */
async function deletePatientFromList(patientId, patientName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(26,28,25,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:#fff;width:90%;max-width:420px;padding:2rem;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:slideUpFade 0.3s cubic-bezier(0.16,1,0.3,1);text-align:center;">
            <div style="width:48px;height:48px;border-radius:50%;background:var(--error-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 style="font-size:1.15rem;color:var(--text-main);margin-bottom:0.5rem;">Excluir paciente</h3>
            <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.35rem;">
                <strong style="color:var(--text-main);">${patientName}</strong>
            </p>
            <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;margin-bottom:1.5rem;">
                Tem certeza que deseja excluir este paciente e todos os dados associados? Consultas e planos alimentares serão removidos.<br>
                <strong style="color:var(--error-color);">Esta ação não poderá ser desfeita.</strong>
            </p>
            <div style="display:flex;gap:0.75rem;">
                <button id="btn-cancel-delete" style="flex:1;padding:0.7rem;border-radius:10px;border:1px solid var(--border-color);background:transparent;color:var(--text-main);font-size:0.9rem;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:inherit;">Cancelar</button>
                <button id="btn-confirm-delete" style="flex:1;padding:0.7rem;border-radius:10px;border:none;background:var(--error-color);color:white;font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;">Excluir permanentemente</button>
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
                .eq('id', patientId);

            if (error) throw error;

            // Sucesso — fecha modal e recarrega a lista
            overlay.style.animation = 'fadeIn 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
            loadPatientsList();
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

// Lógica de Busca no campo input (Filtragem em tempo real local)
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (!query) {
            renderPatients(allPatients);
            return;
        }

        const queryDigits = query.replace(/\D/g, '');
        const filtered = allPatients.filter(p => 
            p.nome.toLowerCase().includes(query) ||
            (p.email && p.email.toLowerCase().includes(query)) ||
            (queryDigits && p.telefone && p.telefone.replace(/\D/g, '').includes(queryDigits))
        );
        renderPatients(filtered);
    });
}


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
        if (container) container.innerHTML = '<div class="empty-state" style="color:red;">Não foi possível carregar a lista de pacientes. Por favor, tente novamente mais tarde.</div>';
    }
}

// Renderiza a lista no DOM
function renderPatients(patientsArray) {
    const container = document.getElementById('patients-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (patientsArray.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 4rem 1rem; text-align: center; background: var(--bg-main); border: 2px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 1rem;">
                <div style="width: 64px; height: 64px; background: var(--primary-light); color: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                </div>
                <h3 style="color: var(--text-main); margin-bottom: 0.75rem; font-size: 1.25rem;">Nenhum paciente ainda</h3>
                <p style="color: var(--text-muted); max-width: 440px; margin: 0 auto 2rem; line-height: 1.6;">O seu consultório digital começa aqui. Cadastre seu primeiro paciente real para começar a aplicar o seu protocolo com ajuda da nossa IA.</p>
                <a href="novo-paciente.html" class="btn btn-primary" style="width: auto; padding: 0.8rem 2rem; display: inline-flex; align-items: center; gap: 8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Cadastrar Primeiro Paciente
                </a>
            </div>
        `;
        return;
    }

    const escapeHTML = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

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

        const safeNome = escapeHTML(p.nome || 'Sem Nome');
        const inicial = safeNome.charAt(0).toUpperCase();

        let objetivo = "Objetivo não definido";
        if (p.objetivos && p.objetivos.length > 0) {
            objetivo = p.objetivos.join(", ");
        } else if (p.objetivo_texto) {
            objetivo = p.objetivo_texto;
        }
        const safeObjetivo = escapeHTML(objetivo);

        const card = document.createElement('div');
        card.className = 'patient-card';
        card.dataset.patientId = p.id;

        card.innerHTML = `
            <div class="patient-info">
                <div class="patient-avatar" style="width: 48px; height: 48px; font-size: 1.2rem;">${inicial}</div>
                <div class="patient-details">
                    <h4 style="display:flex; align-items:center; gap:8px;">
                        ${safeNome}
                        ${p.is_demo ? '<span style="font-size: 0.65rem; background:#F3EAF1; color:#6A3E63; padding: 2px 6px; border-radius:10px; font-weight:600;">DEMO</span>' : ''}
                    </h4>
                    <p class="patient-meta">${safeObjetivo}</p>
                </div>
            </div>
            <div class="patient-status">
                <div>Última consulta</div>
                <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(ultimaConsultaTexto)}</strong>
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
    const confirmDelete = await showCustomConfirm(
        'Excluir Paciente',
        `Tem certeza que deseja excluir permanentemente o paciente ${patientName}? Esta ação apagará todas as consultas e planos alimentares associados.`
    );

    if (confirmDelete) {
        try {
            const { error } = await supabaseClient
                .from('pacientes')
                .delete()
                .eq('id', patientId);

            if (error) throw error;
            showAlert('Paciente excluído com sucesso.', 'success');
            loadPatientsList();
        } catch (err) {
            console.error('Erro ao excluir paciente:', err);
            showAlert('Erro ao excluir: ' + err.message, 'error');
        }
    }
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


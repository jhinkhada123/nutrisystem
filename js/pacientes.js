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
                consultas ( data_consulta )
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
        container.innerHTML = '<div class="empty-state">Nenhum paciente cadastrado ainda.</div>';
        return;
    }

    patientsArray.forEach(p => {
        let ultimaConsultaTexto = "Sem consultas";
        if (p.consultas && p.consultas.length > 0) {
            // Ordenar por data decrescente
            const sortByDate = p.consultas.sort((a,b) => new Date(b.data_consulta) - new Date(a.data_consulta));
            ultimaConsultaTexto = formatDate(sortByDate[0].data_consulta);
        }

        const inicial = p.nome.charAt(0).toUpperCase();

        // Determinar objetivo visual
        let objetivo = "Objetivo não definido";
        if (p.objetivos && p.objetivos.length > 0) {
            objetivo = p.objetivos.join(", ");
        } else if (p.objetivo_texto) {
            objetivo = p.objetivo_texto;
        }

        const card = document.createElement('a');
        card.href = `paciente.html?id=${p.id}`; // Redirecionamento ao perfil
        card.className = 'patient-card';
        card.innerHTML = `
            <div class="patient-info">
                <div class="patient-avatar" style="width: 48px; height: 48px; font-size: 1.2rem;">${inicial}</div>
                <div class="patient-details">
                    <h4>${p.nome}</h4>
                    <p class="patient-meta">${objetivo}</p>
                </div>
            </div>
            <div class="patient-status">
                <div>Última consulta</div>
                <strong style="color: var(--text-main); font-size: 0.95rem;">${ultimaConsultaTexto}</strong>
            </div>
        `;
        
        container.appendChild(card);
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

        const filtered = allPatients.filter(p => p.nome.toLowerCase().includes(query));
        renderPatients(filtered);
    });
}

// js/novo-paciente.js

document.addEventListener('DOMContentLoaded', () => {

    /* =======================================================
       SISTEMA DE ABAS (TABS)
    ======================================================= */
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Aplicar na atual
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    /* =======================================================
       CÁLCULOS E MÁSCARAS AUTOMÁTICAS
    ======================================================= */
    
    // 1. Idade pela Data de Nascimento
    const dtNascInput = document.getElementById('data_nascimento');
    const idadeDisplay = document.getElementById('idade-display');

    dtNascInput.addEventListener('change', (e) => {
        if (!e.target.value) {
            idadeDisplay.textContent = '-';
            return;
        }
        const born = new Date(e.target.value);
        const today = new Date();
        let age = today.getFullYear() - born.getFullYear();
        const m = today.getMonth() - born.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < born.getDate())) {
            age--;
        }
        idadeDisplay.textContent = `${age} anos`;
    });

    // 2. Cálculo do IMC (Peso e Altura)
    const pesoInput = document.getElementById('peso');
    const alturaInput = document.getElementById('altura');
    const imcDisplay = document.getElementById('imc-display');

    function calcularIMC() {
        const p = parseFloat(pesoInput.value);
        const a = parseFloat(alturaInput.value); 
        
        if (p > 0 && a > 0) {
            // Altura está em cm, converter para metros para o IMC
            const aEmMetros = a / 100;
            const imc = p / (aEmMetros * aEmMetros);
            imcDisplay.textContent = imc.toFixed(2);
        } else {
            imcDisplay.textContent = '--';
        }
    }
    pesoInput.addEventListener('input', calcularIMC);
    alturaInput.addEventListener('input', calcularIMC);

    // 3. Formatação simples de Telefone/Whats
    function maskPhone(v) {
        v = v.replace(/\D/g, "");
        if (v.length <= 10) { // Fixo
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d{4})(\d)/, "$1-$2");
        } else { // Celular
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d{5})(\d)/, "$1-$2");
        }
        return v.substring(0, 15);
    }

    const docTel = document.getElementById('telefone');
    const docWpp = document.getElementById('whatsapp');

    docTel.addEventListener('input', (e) => e.target.value = maskPhone(e.target.value));
    docWpp.addEventListener('input', (e) => e.target.value = maskPhone(e.target.value));

    // 4. Formatação Inteligente de Horário (e.g. 6 -> 06:00, 630 -> 06:30, 22 -> 22:00)
    function autoFormatHora(input) {
        input.addEventListener('blur', (e) => {
            let val = e.target.value.replace(/\D/g, ''); // só extrai nums
            if (!val) return;

            // Se digitou apenas de 1 a 2 chars (Ex: 6, 06, 23)
            if (val.length <= 2) {
                let hh = parseInt(val);
                if (hh > 23) hh = 23;
                e.target.value = String(hh).padStart(2, '0') + ':00';
            } 
            // Se digitou 3 chars (Ex: 630 -> 06:30)
            else if (val.length === 3) {
                let hh = val.substring(0, 1);
                let mm = val.substring(1, 3);
                e.target.value = `0${hh}:${mm.padStart(2, '0')}`;
            }
            // Se digitou 4 chars (Ex: 2230 -> 22:30)
            else if (val.length >= 4) {
                let hh = val.substring(0, 2);
                let mm = val.substring(2, 4);
                if (parseInt(hh) > 23) hh = '23';
                if (parseInt(mm) > 59) mm = '59';
                e.target.value = `${hh}:${mm}`;
            }
        });
    }

    autoFormatHora(document.getElementById('hora_acorda'));
    autoFormatHora(document.getElementById('hora_dorme'));

    // 5. Exibir Input extra se praticar Física
    const checkPratica = document.getElementById('pratica_fisica');
    const divFisicaExt = document.getElementById('pratica_fisica_extra');
    checkPratica.addEventListener('change', (e) => {
        divFisicaExt.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) {
            document.getElementById('atividade_descricao').value = '';
        }
    });

    // 6. Lógica dos Checkboxes Múltiplos com o Padrão do "Nenhum"
    function setupCheckboxesGroup(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;
        const boxNenhum = wrapper.querySelector('.chk-none');
        const boxItems = wrapper.querySelectorAll('.chk-item');

        if(boxNenhum) {
            // Se clicar no Nenhum, tira todos os outros
            boxNenhum.addEventListener('change', (e) => {
                if (e.target.checked) {
                    boxItems.forEach(b => b.checked = false);
                }
            });
            // Se clicar num Normal, retira o Nenhum
            boxItems.forEach(b => {
                b.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        boxNenhum.checked = false;
                    }
                });
            });
        }
    }

    setupCheckboxesGroup('grid-patologias');
    setupCheckboxesGroup('grid-restricoes');
    setupCheckboxesGroup('grid-alergias');

    /* =======================================================
       SUBMIT E SALVAMENTO NO SUPABASE
    ======================================================= */
    const form = document.getElementById('form-novo-paciente');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btn-save');
        btnSave.disabled = true;
        btnSave.innerHTML = 'Salvando...';
        
        // Pega Uid atual
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session) {
            alert('Sua sessão expirou. Redirecionando...');
            window.location.href = 'index.html';
            return;
        }

        try {
            // Recoleta dados dos "Múltiplos Checks" e retorna Array<string> // Patologias
            const extractChecks = (gridId) => {
                const arr = [];
                const nodes = document.querySelectorAll(`#${gridId} input:checked`);
                nodes.forEach(n => {
                    if(n.value !== 'Nenhum') arr.push(n.value);
                });
                return arr;
            };

            const payload = {
                nutricionista_id: session.user.id,
                nome: document.getElementById('nome').value.trim(),
                data_nascimento: document.getElementById('data_nascimento').value || null,
                sexo: document.getElementById('sexo').value || null,
                telefone: document.getElementById('telefone').value.trim(),
                whatsapp: document.getElementById('whatsapp').value.trim(),
                email: document.getElementById('email').value.trim(),
                
                peso_inicial: parseFloat(document.getElementById('peso').value) || null,
                altura: parseFloat(document.getElementById('altura').value) || null,
                
                // Múltipla checkbox Objets + Texto
                objetivos: extractChecks('grid-objetivos'),
                objetivo_texto: document.getElementById('objetivo_texto').value.trim(),
                
                nivel_atividade: document.getElementById('nivel_atividade').value || null,
                
                patologias: extractChecks('grid-patologias'),
                restricoes_alimentares: extractChecks('grid-restricoes'),
                alergias: extractChecks('grid-alergias'),
                
                // Os campos de texto extra que acompanham checkbox no UI mapearei pro array diretamente ou manterei no campo livre na UI. O banco não previu 'patologias_extra'. Ou concatenamos com Array, ou ignoramos. 
                // Decisão tática: Adiciona a observação extra diretamente na Array! 
                
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

            // Anexam as caixas de texto soltas pros array se digitadas (Prompt Rules)
            const pExtra = document.getElementById('patologias_extra').value.trim();
            if(pExtra) payload.patologias.push(pExtra);
            
            const rExtra = document.getElementById('restricoes_extra').value.trim();
            if(rExtra) payload.restricoes_alimentares.push(rExtra);

            const aExtra = document.getElementById('alergias_extra').value.trim();
            if(aExtra) payload.alergias.push(aExtra);

            // POST no Banco — Verificação de duplicados antes de inserir
            const checkNome = payload.nome;
            const checkTel = payload.telefone.replace(/\D/g, '');
            const checkEmail = payload.email;

            let orFilters = [];
            if (checkNome) orFilters.push(`nome.ilike.%${checkNome}%`);
            if (checkTel.length >= 8) orFilters.push(`telefone.ilike.%${checkTel.slice(-8)}%`);
            if (checkEmail) orFilters.push(`email.eq.${checkEmail}`);

            if (orFilters.length > 0) {
                const { data: possibleDups } = await supabaseClient
                    .from('pacientes')
                    .select('id, nome, telefone, email')
                    .or(orFilters.join(','))
                    .limit(3);

                if (possibleDups && possibleDups.length > 0) {
                    const dupNames = possibleDups.map(d => `• ${d.nome}`).join('\n');
                    const shouldContinue = confirm(
                        `Já existe(m) paciente(s) com dados semelhantes:\n\n${dupNames}\n\nDeseja continuar o cadastro mesmo assim?`
                    );
                    if (!shouldContinue) {
                        btnSave.disabled = false;
                        btnSave.innerHTML = 'Salvar Paciente';
                        return;
                    }
                }
            }

            const { data, error } = await supabaseClient
                .from('pacientes')
                .insert([payload])
                .select();

            if (error) throw error;

            hideAlert();
            showAlert('Paciente cadastrado com sucesso!', 'success'); // Estilizar como success prov se precisar
            
            setTimeout(() => {
                if(data && data.length > 0) {
                    window.location.href = `paciente.html?id=${data[0].id}`;
                } else {
                    window.location.href = `pacientes.html`;
                }
            }, 1000);

        } catch (error) {
            btnSave.disabled = false;
            btnSave.innerHTML = 'Salvar Paciente';
            showAlert("Erro ao cadastrar paciente: " + error.message, 'error');
            // Scroll pra cima pro user ver erro
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    function showAlert(message, type = 'error') {
        const alertEl = document.getElementById('alert-message');
        if (!alertEl) return;
        alertEl.textContent = message;
        // Se sucesso usamos cor diferente
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
    }

    function hideAlert() {
        const alertEl = document.getElementById('alert-message');
        if (alertEl) alertEl.classList.add('hidden');
    }

});

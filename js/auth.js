// js/auth.js

// Utilitário para exibir mensagens
function showAlert(message, type = 'error') {
    const alertEl = document.getElementById('alert-message');
    if (!alertEl) return;
    
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.classList.remove('hidden');
}

// Utilitário para ocultar mensagens
function hideAlert() {
    const alertEl = document.getElementById('alert-message');
    if (alertEl) {
        alertEl.classList.add('hidden');
    }
}

// 1. Manter sessão ativa / Redirecionar se já logado
async function checkCurrentSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    const path = window.location.pathname;
    const isAuthPage = path.endsWith('index.html') || path.endsWith('cadastro.html') || path === '/';
    
    if (session) {
        // Se logado e tentando acessar login/cadastro -> vai pro dashboard
        if (isAuthPage) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // Se deslogado e tentando acessar qualquer página protegida -> vai pro login
        if (!isAuthPage) {
            window.location.href = 'index.html';
        }
    }
}

// 2. Fluxo de Signup (Cadastro)
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const btn = document.getElementById('btn-signup');
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validações
        if (password.length < 6) {
            return showAlert('A senha deve ter no mínimo 6 caracteres.');
        }
        if (password !== confirmPassword) {
            return showAlert('As senhas não coincidem!');
        }

        btn.disabled = true;
        btn.textContent = "Criando conta...";

        try {
            // Cria usuário no Auth
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });

            if (authError) throw authError;

            // O perfil na tabela 'nutricionistas' agora é criado AUTOMATICAMENTE
            // por um Database Trigger no Supabase no exato momento do signUp.
            // Redirecionamento direto após sucesso:
            if (authData.user) {
                window.location.href = 'dashboard.html';
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = "Criar conta";
            
            // Tradução amigável dos erros comuns
            if (error.message.includes("User already registered")) {
                showAlert('Este e-mail já está em uso.');
            } else {
                showAlert(error.message || 'Erro ao criar conta. Tente novamente.');
            }
        }
    });
}

// 3. Fluxo de SignIn (Login)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const btn = document.getElementById('btn-login');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        btn.disabled = true;
        btn.textContent = "Entrando...";

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            if (data.session) {
                window.location.href = 'dashboard.html';
            }

        } catch (error) {
            btn.disabled = false;
            btn.textContent = "Entrar";
            
            if (error.message.includes("Invalid login credentials")) {
                showAlert('E-mail ou senha incorretos.');
            } else {
                showAlert(error.message || 'Erro ao efetuar login.');
            }
        }
    });
}

// Fluxo de SignOut (Logout)
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    });
}

// Checar sessão toda vez que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    checkCurrentSession();
    initProfileAvatar();
});

// Avatar Dinâmico e Modal de Conta
async function initProfileAvatar() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; // Nao carrega em paginas deslogadas
    
    // Obter URL do avatar salva nos metadados ou criar fallback
    const user = session.user;
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata.full_name || 'NS')}&background=E8F5E9&color=2E7D32&bold=true`;
    let currentAvatarUrl = user.user_metadata.avatar_url || fallbackUrl;

    // 1. Atualizar a Sidebar Header dinamicamente
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.innerHTML = `
            <img id="sidebar-avatar" class="logo-icon-sm" src="${currentAvatarUrl}" alt="Avatar">
            <h1 class="sidebar-title" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${user.user_metadata.full_name || 'NutriSystem'}">${user.user_metadata.full_name || 'NutriSystem'}</h1>
        `;
        
        // 2. Injetar o Modal de Perfil no DOM de forma elegante
        const modalHtml = `
            <div id="profile-modal-overlay" class="overlay-modal hidden">
                <div class="profile-modal">
                    <button id="close-profile-modal" class="close-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h3>Minha Conta</h3>
                    <p style="margin-bottom: 1.5rem;">Crie sua marca! Atualize a foto do seu menu lateral.</p>
                    
                    <div class="avatar-preview-container">
                        <img id="modal-avatar-preview" src="${currentAvatarUrl}" alt="Sua foto">
                    </div>
                    
                    <div class="input-group" style="text-align: left; margin-bottom: 1.5rem;">
                        <label style="color: var(--text-main); font-weight: 500;">Link (URL) da imagem:</label>
                        <input type="url" id="avatar-url-input" placeholder="Cole o link da foto de uma rede social..." value="${user.user_metadata.avatar_url || ''}">
                    </div>
                    
                    <button id="btn-save-avatar" class="btn btn-primary" style="margin-top: 0; padding: 0.95rem;">Aplicar Foto</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 3. Adicionar Eventos do Modal
        sidebarHeader.addEventListener('click', () => {
            document.getElementById('profile-modal-overlay').classList.remove('hidden');
        });
        
        // Clicar no botão voltar/fechar
        document.getElementById('close-profile-modal').addEventListener('click', () => {
            document.getElementById('profile-modal-overlay').classList.add('hidden');
        });

        // Fechar clicando fora (no overlay escuro)
        document.getElementById('profile-modal-overlay').addEventListener('click', (e) => {
            if(e.target.id === 'profile-modal-overlay') e.target.classList.add('hidden');
        });

        // Evento de Super Update no Supabase Auth
        document.getElementById('btn-save-avatar').addEventListener('click', async () => {
            const btn = document.getElementById('btn-save-avatar');
            const newUrl = document.getElementById('avatar-url-input').value.trim();
            
            btn.disabled = true;
            btn.textContent = 'Aplicando magia...';
            
            try {
                // Atualiza exclusivamento os User_MetaData da autenticação atual (sem mexer na row original)
                const { error } = await supabaseClient.auth.updateUser({
                    data: { avatar_url: newUrl }
                });
                
                if (error) throw error;
                
                // Muta as props visuais
                const finalUrl = newUrl || fallbackUrl;
                document.getElementById('sidebar-avatar').src = finalUrl;
                document.getElementById('modal-avatar-preview').src = finalUrl;
                
                // Feedback visual do botão estilo Cinematic
                btn.textContent = 'Foto Salva! ✨';
                btn.style.backgroundColor = 'var(--secondary-color)';
                setTimeout(() => {
                    document.getElementById('profile-modal-overlay').classList.add('hidden');
                    btn.textContent = 'Aplicar Foto';
                    btn.style.backgroundColor = '';
                }, 1300);
                
            } catch (err) {
                console.error(err);
                alert("Erro ao validar foto: " + err.message);
                btn.disabled = false;
                btn.textContent = 'Aplicar Foto';
            }
        });
    }
}

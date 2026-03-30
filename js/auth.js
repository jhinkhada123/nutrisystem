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
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Verifica se já existe o modal para não duplicar
        if (document.getElementById('logout-confirm-modal')) return;

        // Cria o modal de confirmação dinamicamente
        const overlay = document.createElement('div');
        overlay.id = 'logout-confirm-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.backdropFilter = 'blur(2px)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';

        const card = document.createElement('div');
        card.style.background = 'white';
        card.style.padding = '2.5rem 2rem';
        card.style.borderRadius = 'var(--radius-lg, 12px)';
        card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
        card.style.textAlign = 'center';
        card.style.width = '320px';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'transform 0.2s ease';

        card.innerHTML = `
            <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF0F0; color: #D32F2F; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            <h2 style="margin: 0 0 0.5rem 0; color: var(--text-main); font-size: 1.5rem;">Sair</h2>
            <p style="margin: 0 0 2rem 0; color: var(--text-muted); font-size: 1rem;">Tem certeza que quer sair?</p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
                <button id="btn-cancel-logout" class="btn btn-secondary" style="flex: 1; padding: 0.85rem 0; margin: 0;">Cancelar</button>
                <button id="btn-confirm-logout" style="flex: 1; padding: 0.85rem 0; margin: 0; background-color: #D32F2F; color: white; border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#B71C1C'" onmouseout="this.style.backgroundColor='#D32F2F'">Sair</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Animação de entrada
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });

        // Fechar modal
        const closeModal = () => {
            overlay.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if(document.body.contains(overlay)) document.body.removeChild(overlay);
            }, 200);
        };

        document.getElementById('btn-cancel-logout').addEventListener('click', closeModal);
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) closeModal();
        });

        // Confirmar logout
        document.getElementById('btn-confirm-logout').addEventListener('click', async () => {
            const btnConfirm = document.getElementById('btn-confirm-logout');
            btnConfirm.textContent = 'Saindo...';
            btnConfirm.disabled = true;
            const { error } = await supabaseClient.auth.signOut();
            if (!error) {
                window.location.href = 'index.html';
            } else {
                closeModal();
                showAlert('Erro ao sair da conta.');
            }
        });
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
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata.full_name || 'NF')}&background=F3EAF1&color=6A3E63&bold=true`;
    let currentAvatarUrl = user.user_metadata.avatar_url || fallbackUrl;

    // 1. Atualizar a Sidebar Header dinamicamente
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.innerHTML = `
            <img id="sidebar-avatar" class="logo-icon-sm" src="${currentAvatarUrl}" alt="Avatar">
            <h1 class="sidebar-title" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${user.user_metadata.full_name || 'NutriFlow'}">${user.user_metadata.full_name || 'NutriFlow'}</h1>
        `;
        
        // 2. Injetar o Modal de Perfil no DOM de forma elegante
        const modalHtml = `
            <div id="profile-modal-overlay" class="overlay-modal hidden">
                <div class="profile-modal">
                    <button id="close-profile-modal" class="close-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h3>Minha Conta</h3>
                    <p style="margin-bottom: 1.5rem;">Personalize seu perfil com uma foto do seu dispositivo.</p>
                    
                    <div class="avatar-preview-container" id="avatar-upload-trigger" style="cursor: pointer; transition: opacity 0.2s ease;">
                        <img id="modal-avatar-preview" src="${currentAvatarUrl}" alt="Sua foto" style="transition: opacity 0.2s ease;">
                    </div>
                    <input type="file" id="avatar-file-input" accept="image/*" style="display: none;">
                    <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0.75rem 0 1.5rem 0;">Clique na foto para alterar</p>
                    
                    <button id="btn-save-avatar" class="btn btn-primary" style="margin-top: 0; padding: 0.95rem;" disabled>Aplicar Foto</button>
                    ${user.user_metadata.avatar_url ? '<button id="btn-remove-avatar" style="margin-top: 0.75rem; background: none; border: none; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; text-decoration: underline;">Remover foto</button>' : ''}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 3. Adicionar Eventos do Modal
        sidebarHeader.addEventListener('click', () => {
            document.getElementById('profile-modal-overlay').classList.remove('hidden');
        });
        
        document.getElementById('close-profile-modal').addEventListener('click', () => {
            document.getElementById('profile-modal-overlay').classList.add('hidden');
        });

        document.getElementById('profile-modal-overlay').addEventListener('click', (e) => {
            if(e.target.id === 'profile-modal-overlay') e.target.classList.add('hidden');
        });

        // File Upload: trigger input ao clicar no avatar
        let pendingAvatarData = null;
        
        document.getElementById('avatar-upload-trigger').addEventListener('click', () => {
            document.getElementById('avatar-file-input').click();
        });

        document.getElementById('avatar-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Redimensionar automaticamente para avatar (256x256, JPEG comprimido)
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 256;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Crop centralizado (quadrado)
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                pendingAvatarData = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('modal-avatar-preview').src = pendingAvatarData;
                document.getElementById('btn-save-avatar').disabled = false;
            };
            img.src = URL.createObjectURL(file);
        });

        // Evento de salvar avatar
        document.getElementById('btn-save-avatar').addEventListener('click', async () => {
            const btn = document.getElementById('btn-save-avatar');
            if (!pendingAvatarData) return;
            
            btn.disabled = true;
            btn.textContent = 'Salvando...';
            
            try {
                const { error } = await supabaseClient.auth.updateUser({
                    data: { avatar_url: pendingAvatarData }
                });
                
                if (error) throw error;
                
                document.getElementById('sidebar-avatar').src = pendingAvatarData;
                
                btn.textContent = 'Foto Salva! ✨';
                btn.style.backgroundColor = 'var(--secondary-color)';
                pendingAvatarData = null;
                
                setTimeout(() => {
                    document.getElementById('profile-modal-overlay').classList.add('hidden');
                    btn.textContent = 'Aplicar Foto';
                    btn.style.backgroundColor = '';
                    btn.disabled = true;
                }, 1300);
                
            } catch (err) {
                console.error(err);
                alert("Erro ao salvar foto: " + err.message);
                btn.disabled = false;
                btn.textContent = 'Aplicar Foto';
            }
        });

        // Evento de remover avatar
        const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
        if (btnRemoveAvatar) {
            btnRemoveAvatar.addEventListener('click', async () => {
                try {
                    await supabaseClient.auth.updateUser({ data: { avatar_url: null } });
                    document.getElementById('sidebar-avatar').src = fallbackUrl;
                    document.getElementById('modal-avatar-preview').src = fallbackUrl;
                    pendingAvatarData = null;
                    document.getElementById('btn-save-avatar').disabled = true;
                    btnRemoveAvatar.remove();
                } catch (err) {
                    console.error(err);
                }
            });
        }
    }
}

// js/auth.js

// showAlert and hideAlert are now handled by ui-utils.js

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
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const confirmLogout = await showCustomConfirm(
            'Sair da Conta',
            'Tem certeza que deseja encerrar sua sessão atual?'
        );

        if (confirmLogout) {
            // UI Otimista / Transição Imediata
            const fadeOverlay = document.createElement('div');
            fadeOverlay.style.position = 'fixed';
            fadeOverlay.style.inset = '0';
            fadeOverlay.style.background = 'white';
            fadeOverlay.style.zIndex = '10000';
            fadeOverlay.style.opacity = '0';
            fadeOverlay.style.transition = 'opacity 0.4s ease';
            fadeOverlay.style.display = 'flex';
            fadeOverlay.style.alignItems = 'center';
            fadeOverlay.style.justifyContent = 'center';
            fadeOverlay.innerHTML = `<div class="logo-icon" style="transform: scale(1.5); animation: pulse 1.5s infinite;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: auto;"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"></path></svg></div>`;
            document.body.appendChild(fadeOverlay);
            
            requestAnimationFrame(() => {
                fadeOverlay.style.opacity = '1';
            });

            // Executa o logout em background
            await supabaseClient.auth.signOut();
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 400); 
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
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata.full_name || 'NF')}&background=F3EAF1&color=6A3E63&bold=true`;
    let currentAvatarUrl = user.user_metadata.avatar_url || fallbackUrl;

    // 1. Atualizar a Sidebar Header dinamicamente
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.innerHTML = `
            <img id="sidebar-avatar" class="logo-icon-sm" src="${currentAvatarUrl}" alt="Avatar">
            <h1 class="sidebar-title" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${user.user_metadata.full_name || 'Prescria'}">${user.user_metadata.full_name || 'Prescria'}</h1>
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

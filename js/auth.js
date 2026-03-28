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
    
    const isDashboard = window.location.pathname.includes('dashboard.html');
    
    if (session) {
        // Se usuário logado e tentar abrir login/cadastro -> vai pro dashboard
        if (!isDashboard) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // Se usuário deslogado e tentar abrir dashboard -> vai pro login
        if (isDashboard) {
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

            // Inserir registro na tabela nutricionistas (Regra do prompt)
            if (authData.user) {
                const { error: dbError } = await supabaseClient
                    .from('nutricionistas')
                    .insert([
                        { id: authData.user.id, nome: name, email: email }
                    ]);

                if (dbError) throw dbError;
                
                // Redirecionamento após sucesso
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
document.addEventListener('DOMContentLoaded', checkCurrentSession);

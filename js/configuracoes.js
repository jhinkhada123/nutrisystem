// js/configuracoes.js
// Lógica da página de Configurações — perfil, conta, segurança

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const meta = user.user_metadata || {};

    // ─── Preencher campos ────────────────────────────
    document.getElementById('settings-name').value = meta.full_name || meta.name || '';
    document.getElementById('settings-email').value = user.email || '';

    // Protocolo
    if (meta.protocolo_clinico) {
        document.getElementById('proto-priorizados').value = meta.protocolo_clinico.alimentos_priorizados || '';
        document.getElementById('proto-evitados').value = meta.protocolo_clinico.alimentos_evitados || '';
        document.getElementById('proto-perfil').value = meta.protocolo_clinico.perfil_plano || 'acessível';
        document.getElementById('proto-especificidade').value = meta.protocolo_clinico.grau_especificidade || 'detalhado';
        document.getElementById('proto-obs').value = meta.protocolo_clinico.observacoes_clinicas || '';
    }

    // Avatar
    const avatarImg = document.getElementById('settings-avatar-img');
    const removeBtn = document.getElementById('btn-remove-avatar');

    if (meta.avatar_url) {
        avatarImg.src = meta.avatar_url;
        removeBtn.style.display = 'inline';
    } else {
        // Fallback: iniciais
        const initials = (meta.full_name || meta.name || user.email || '?').charAt(0).toUpperCase();
        avatarImg.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="36" fill="#E8DDE6"/><text x="36" y="44" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#6A3E63" text-anchor="middle">${initials}</text></svg>`)}`;
        removeBtn.style.display = 'none';
    }

    // ─── Toast ───────────────────────────────────────
    function showToast(message, type = 'success') {
        const toast = document.getElementById('settings-toast');
        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        if (type === 'success') {
            toast.style.background = '#E8F5E9';
            toast.style.color = '#2E7D32';
            toast.style.border = '1px solid #C8E6C9';
        } else {
            toast.style.background = '#FFEBEE';
            toast.style.color = '#C62828';
            toast.style.border = '1px solid #FFCDD2';
        }
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 3500);
    }

    // ─── Avatar Upload ───────────────────────────────
    const avatarInput = document.getElementById('settings-avatar-input');

    document.getElementById('btn-change-avatar').addEventListener('click', () => avatarInput.click());
    document.getElementById('settings-avatar-container').addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Resize via canvas
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            try {
                const { error } = await supabaseClient.auth.updateUser({
                    data: { avatar_url: dataUrl }
                });
                if (error) throw error;
                avatarImg.src = dataUrl;
                removeBtn.style.display = 'inline';
                showToast('Foto atualizada.');
            } catch (err) {
                showToast(err.message || 'Erro ao atualizar foto.', 'error');
            }
        };
        img.src = URL.createObjectURL(file);
    });

    // Remover avatar
    removeBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { avatar_url: null }
            });
            if (error) throw error;
            const initials = (meta.full_name || meta.name || user.email || '?').charAt(0).toUpperCase();
            avatarImg.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="36" fill="#E8DDE6"/><text x="36" y="44" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#6A3E63" text-anchor="middle">${initials}</text></svg>`)}`;
            removeBtn.style.display = 'none';
            showToast('Foto removida.');
        } catch (err) {
            showToast(err.message || 'Erro ao remover foto.', 'error');
        }
    });

    // ─── Logomarca Upload (PDF) ──────────────────────
    const logoImg = document.getElementById('settings-logo-img');
    const logoPlaceholder = document.getElementById('settings-logo-placeholder');
    const removeLogoBtn = document.getElementById('btn-remove-logo');
    const logoInput = document.getElementById('settings-logo-input');

    if (meta.logomarca_url) {
        logoImg.src = meta.logomarca_url;
        logoImg.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        removeLogoBtn.style.display = 'inline-block';
    }

    document.getElementById('btn-change-logo').addEventListener('click', () => logoInput.click());
    document.getElementById('settings-logo-container').addEventListener('click', () => logoInput.click());

    logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Resize via canvas keeping aspect ratio (max 600x200)
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png', 0.9); // PNG to preserve transparency if any

            try {
                const { error } = await supabaseClient.auth.updateUser({
                    data: { logomarca_url: dataUrl }
                });
                if (error) throw error;
                logoImg.src = dataUrl;
                logoImg.style.display = 'block';
                logoPlaceholder.style.display = 'none';
                removeLogoBtn.style.display = 'inline-block';
                showToast('Logomarca atualizada.');
            } catch (err) {
                showToast(err.message || 'Erro ao atualizar logomarca.', 'error');
            }
        };
        img.src = URL.createObjectURL(file);
    });

    // Remover logomarca
    removeLogoBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { logomarca_url: null }
            });
            if (error) throw error;
            logoImg.src = '';
            logoImg.style.display = 'none';
            logoPlaceholder.style.display = 'block';
            removeLogoBtn.style.display = 'none';
            showToast('Logomarca removida.');
        } catch (err) {
            showToast(err.message || 'Erro ao remover logomarca.', 'error');
        }
    });



    // ─── Salvar Perfil (nome) ────────────────────────
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-profile');
        const name = document.getElementById('settings-name').value.trim();

        if (!name) {
            showToast('O nome não pode ficar vazio.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Gravando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { full_name: name, name: name }
            });
            if (error) throw error;
            showToast('Nome atualizado.');
        } catch (err) {
            showToast(err.message || 'Erro ao salvar nome.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Atualizar perfil';
        }
    });

    // ─── Atualizar E-mail ────────────────────────────
    document.getElementById('btn-save-email').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-email');
        const newEmail = document.getElementById('settings-email').value.trim();

        if (!newEmail || !newEmail.includes('@')) {
            showToast('Insira um e-mail válido.', 'error');
            return;
        }

        if (newEmail === user.email) {
            showToast('Este já é o seu e-mail atual.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Processando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                email: newEmail
            });
            if (error) throw error;
            showToast('Link de confirmação enviado para ' + newEmail + '.');
        } catch (err) {
            showToast(err.message || 'Erro ao atualizar e-mail.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Alterar e-mail';
        }
    });

    // ─── Atualizar Senha ─────────────────────────────
    document.getElementById('btn-save-password').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-password');
        const newPw = document.getElementById('settings-new-password').value;
        const confirmPw = document.getElementById('settings-confirm-password').value;

        if (!newPw || newPw.length < 6) {
            showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }

        if (newPw !== confirmPw) {
            showToast('As senhas não coincidem.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Gravando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPw
            });
            if (error) throw error;
            showToast('Senha atualizada.');
            document.getElementById('settings-new-password').value = '';
            document.getElementById('settings-confirm-password').value = '';
        } catch (err) {
            showToast(err.message || 'Erro ao atualizar senha.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Alterar senha';
        }
    });

    // ─── Salvar Protocolo da Nutri ───────────────────
    document.getElementById('btn-save-protocolo').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-protocolo');
        
        const protocolo = {
            alimentos_priorizados: document.getElementById('proto-priorizados').value.trim(),
            alimentos_evitados: document.getElementById('proto-evitados').value.trim(),
            perfil_plano: document.getElementById('proto-perfil').value,
            grau_especificidade: document.getElementById('proto-especificidade').value,
            observacoes_clinicas: document.getElementById('proto-obs').value.trim()
        };

        btn.disabled = true;
        btn.textContent = 'Gravando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { protocolo_clinico: protocolo }
            });
            if (error) throw error;
            showToast('Protocolo salvo. A IA seguirá suas diretrizes a partir da próxima geração.');
        } catch (err) {
            showToast(err.message || 'Erro ao salvar protocolo.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar Protocolo';
        }
    });

    // ─── Hover states nos inputs ─────────────────────
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
        input.addEventListener('focus', () => { input.style.borderColor = 'var(--primary-color)'; input.style.outline = 'none'; });
        input.addEventListener('blur', () => { input.style.borderColor = 'var(--border-color)'; });
    });
});

// js/configuracoes.js
// Lógica da página de Configurações — perfil, conta, segurança

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const meta = user.user_metadata || {};

    // ─── Preencher campos ────────────────────────────
    document.getElementById('settings-name').value = meta.full_name || meta.name || '';
    document.getElementById('settings-email').value = user.email || '';

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
                showToast('Foto atualizada com sucesso.');
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

    // ─── Salvar Perfil (nome) ────────────────────────
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-profile');
        const name = document.getElementById('settings-name').value.trim();

        if (!name) {
            showToast('O nome não pode ficar vazio.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { full_name: name, name: name }
            });
            if (error) throw error;
            showToast('Nome atualizado com sucesso.');
        } catch (err) {
            showToast(err.message || 'Erro ao salvar nome.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar Perfil';
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
        btn.textContent = 'Enviando...';

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
            btn.textContent = 'Atualizar E-mail';
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
        btn.textContent = 'Atualizando...';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPw
            });
            if (error) throw error;
            showToast('Senha atualizada com sucesso.');
            document.getElementById('settings-new-password').value = '';
            document.getElementById('settings-confirm-password').value = '';
        } catch (err) {
            showToast(err.message || 'Erro ao atualizar senha.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Atualizar Senha';
        }
    });

    // ─── Hover states nos inputs ─────────────────────
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
        input.addEventListener('focus', () => { input.style.borderColor = 'var(--primary-color)'; input.style.outline = 'none'; });
        input.addEventListener('blur', () => { input.style.borderColor = 'var(--border-color)'; });
    });
});

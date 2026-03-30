/**
 * Common UI Utilities for Prescria
 * Unified Alert and Confirmation system
 */

window.showAlert = function(message, type = 'error') {
    const alertEl = document.getElementById('alert-message');
    if (!alertEl) return;
    
    alertEl.textContent = message;
    alertEl.className = 'alert';
    alertEl.classList.add(`alert-${type}`);
    alertEl.classList.remove('hidden');
    
    // Auto hide
    if (window._alertTimer) clearTimeout(window._alertTimer);
    window._alertTimer = setTimeout(() => { alertEl.classList.add('hidden'); }, 5000);
};

window.showCustomConfirm = function(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        if (!modal) {
            // Fallback if modal HTML is missing
            resolve(confirm(message));
            return;
        }

        const titleEl = modal.querySelector('h3');
        const messageEl = modal.querySelector('p');
        const btnConfirm = document.getElementById('btn-confirm-yes');
        const btnCancel = document.getElementById('btn-confirm-no');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        // Estilização dinâmica para ações destrutivas (Excluir)
        const isDeleteAction = title.toLowerCase().includes('excluir') || title.toLowerCase().includes('apagar');
        if (isDeleteAction && btnConfirm) {
            btnConfirm.style.backgroundColor = '#D32F2F';
            btnConfirm.style.borderColor = '#D32F2F';
            btnConfirm.textContent = title.includes('Excluir') ? 'Excluir Paciente' : 'Confirmar';
        } else if (btnConfirm) {
            btnConfirm.style.backgroundColor = ''; // Reset para o padrão CSS
            btnConfirm.style.borderColor = '';
            btnConfirm.textContent = 'Sim, prosseguir';
        }

        modal.classList.remove('hidden');

        const handleConfirm = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
};

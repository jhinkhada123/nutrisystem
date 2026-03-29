# LGPD & Health Data Privacy

## Objetivo
Definir guardrails de segurança e privacidade rigorosos para lidar com dados biométricos e de saúde protegidos, assegurando compliance legal para as clínicas contratantes do SaaS.

## Regras Obrigatórias (MUST)
- **Minimização UI:** Minimizar exposição de dados sensíveis na interface (ex: não exibir lista de patologias escancarada na listagem genérica de pacientes).
- **Mascaramento:** Mascarar/ocultar dados clínicos ou CPF quando fizer sentido, utilizando botões de revelar.
- **Log Safe:** NUNCA logar (console.log, Sentry) payload completo contendo dados de anamnese, peso, doenças e nome real.
- **RLS Rigoroso:** Revisar Row Level Security (RLS), Auth Context e permissões do Supabase antes de criar qualquer nova tabela de saúde. Ninguém deve conseguir dar GET em pacientes dos outros.
- **Definição de Dado Sensível:** Tratar Peso, Medidas, Patologias, Observações Psicológicas/Clínicas e Hitórico como dados Ultrassensíveis.
- **Consentimento Operacional:** Reforçar o consentimento (Termos de Uso) e o princípio do menor privilégio em todos os scripts.
- **Exportação:** Qualquer exportação de dieta por PDF/Link/WhatsApp deve ser segura, possivelmente ofuscando sobrenomes completos.

## Proibido (NEVER)
- Exibir dados sensíveis abertamente em componentes de navegação ou cards não pertencentes à consulta imersiva em si.
- Copiar/Enviar dados clínicos cruzados pelo backend para sistemas de analytics (Google Analytics, Mixpanel, etc) ou logs temporários.
- Estruturas de tabelas com permissões `public` ou políticas booleanas ingênuas (`true`).
- Evoluir arquitetura de infraestrutura de dados ou autenticação sem um checklist explícito validando os riscos da mutação no app.

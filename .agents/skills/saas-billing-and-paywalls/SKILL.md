---
description: Regras de arquitetura p/ paywalls, limites comerciais e transição trial -> premium.
---

# SaaS Billing & Paywalls

## Goal
Moldar a camada de produto focada na monetização e funil de conversão sem ferir a credibilidade, apresentando travas comerciais de forma madura, profissional e contextual à nutricionista.

## Instructions
1. O Paywall deve nascer do valor, e não do erro. Em vez de erro 403, usar modais charmosos "Seu limite do plano Free acabau. Desbloqueie o poder infinito de IAs com o Premium".
2. Preservar rigorosamente o banco de dados (Acesso Histórico) mesmo em estatus bloqueados/inadimplentes; a nutricionista nuca perde as fichas, só o poder de editar/criar.
3. Projetar componentes visuais reutilizáveis dependentes dos flags SaaS (`isTrial`, `isPro`, `usageCount`).
4. Organizar chamadas de Serverless Backend ou Triggers Supabase para controlar cota de chamadas de IA limitadas contra chaves pagas, impedindo abuso do servidor.

## Examples
- Após 5 pacientes ou 5 planos de IA gerados, exibir Modal elegante bloqueando o passo "Gerar Plano por IA", com cards listando "Vantagens Pro: Upload de exames, IA ilimitada, Impressão Premium".

## Constraints
- Paywall nunca deve gerar falha técnica genérica "Error 500 API Call". Deve ser mapeado ("UsageExceededError").
- Não trancar pacientes já cadastrados para impedir portabilidade do profissional de saúde. Eticidade primeiro.

## Resources
- references/billing-state-matrix.md
- references/pricing-levers.md

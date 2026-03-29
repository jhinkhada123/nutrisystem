---
description: Escalonamento e fechamento de features atrás de Paywalls SaaS. (Monetização)
---

# Rollout SaaS Billing

## Objetivo
Implantar ganchos e blocos impeditivos que garantam comercialização robusta.

## Pré-condições
- Produto completamente utilizável nas funções core com forte autoridade médica.

## Passos da Implementação
1. Criar tracking simples/nativo de uso e armazenamento em Supabase (`planos_gerados_count`).
2. Mapeamento dos Estados Comerciais: `isSubscribed`, `hasTrialCredit`, `isLocked`.
3. Modelagem global do frontend que leia este flag e bloqueie requests antes de chamas caros e crie Overlay Modal ("Faça o Upgrade").
4. Planejar endpoint para Checkout webhook listening (ex: Stripe Portal).

## Critérios de Aceite
- Criação e disparo de plano limitado. Sem gerar quebras desastrosas. Retenção assegurada do usuário com explicação comercial.

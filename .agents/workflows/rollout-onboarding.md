---
description: Rollout de Ativação do First-time User (Onboarding)
---

# Rollout SaaS Onboarding

## Objetivo
Implementar a Skill de `saas-onboarding-rules` de forma controlada para curar a experiência vazia incial da ferramenta.

## Pré-condições
- A conta nova pode logar em dashboard totalmente vazios.

## Passos da Implementação
1. Identificar todos os container que hospedam arrays vazios nas views principais.
2. Criar ou validar o design global do `.empty-state` (que inclua SVG decorativos ou badges premium).
3. Adicionar CTAs principais em cada um (direcionando para criação de ficha de paciente).
4. Opcional/Recomendado: Inserir um "Mock Data" temporário ou "Paciente Demo" gerado magicamente para nutrir e provar na veia como o dashboard se comporta vivo.
5. Inserir popover ou Modal Global na primeira visita introduzindo em 1 parágrafo as features mágicas (IA e PDFs).

## Critérios de Aceite
- Ao limpar os dados do Supabase e criar cadastro novo, a experiência inicial não transmite confusão/ausência funcional e sim um caminho claro a seguir.

---
description: Rollout Iterativo do Output e Renderização de Planos alimentares por IA.
---

# Rollout Clinical Output Framework

## Objetivo
Refatorar o esqueleto do prompt da IA atual e sua injeção no DOM, fazendo a transição de um simples bloco JSON genérico para um artefato clínico profissional brasileiro.

## Pré-condições
- Backend conectando aos endpoints OpenAI/Anthropic de forma pura.

## Passos da Implementação
1. Revisão drástica da string/template de prompt submetida no `/api/`.
2. Incluir a imposição de dados via Array com separações estruturais rígidas:
   `{ "titulo": "Cedo", "tipo": "Cafe", "base": [], "substituto_fator_A": [] }` etc.
3. Intervir na refatoração no frontend (`js/paciente.js`): Destruir a iteração básica que jorra list-items html crú, criando Cards limpos, modernos, visualmente fáceis e segmentados.
4. Teste de sanity: O input com alergenos, patologias brabas refletiu o bloqueio nas geradas finais localmente?
5. Validação com o UX clínico (Safety Rules Br).

## Critérios de Aceite
- Payload rodando e desenhando blocos Premium. Nutricionista consegue visualmente identificar o que assemelha a sua própria assinatura profissional.

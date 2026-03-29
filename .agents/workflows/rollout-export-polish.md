---
description: Rollout de finalização e formatação pra material físico e exportação de entregáveis.
---

# Rollout Export & Print Polish

## Objetivo
Transformar a UI HTML atual e limpa em papéis físicos e PDFs exportados com maestria comercial (fidelidade + branding).

## Pré-condições
- Componente de renderização do Dieta finalizado pela fase de Clinical Output.

## Passos da Implementação
1. Criação de estilos em final de folha `styles.css` focados no scope `@media print { ... }`.
2. Adicionar hide rules (`.no-print`, botões, forms laterais e navbar).
3. Mudar fundo raiz para branco vivo, aplicar quebras de página controladoras de blocos órfãos (`page-break-inside: avoid`).
4. Implementar cabeçalho virtual injetado dinamicamente durante impressão. (Exibindo os Metadados armazenados previamente no Onboarding).
5. (Opcional) Adicionar rotinas nativas Share API (`navigator.share`) ou links absolutos montados pro WhatsApp Mobile Web.

## Critérios de Aceite
- Quando clica `Ctrl + P` (Imprimir) na aba do pacote nutricional, a interface reflete um relatório caríssimo e assinado, limpo, de visual luxuoso.

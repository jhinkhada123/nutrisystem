---
description: Foco exclusivo na entrega física/PDF/WhatsApp do produto final ao paciente.
---

# Export & Print Polish

## Goal
Transformar a interface visual da tela na melhor experiência imprimível e exportável possível, entregando um PDF A4 elegante, chancelado com a marca da nutricionista, legível e impressionante que garanta que o paciente valorize a prescrição médica.

## Instructions
Quando tocar em lógicas de visualização de plano, exportação (PDF) e cópia:
1. Criar e aplicar folhas de estilo específicas para mídia impressa (`@media print`). Embebedar o design system premium.
2. Esconder ou repintar todos os botões de ação (ex: Salvar plano, Header da clínica) durante o modo impressão, mostrando apenas Cabeçalho da Dieta, Nome, Logo e Dieta estruturada.
3. Prevenir cortes hostis (page-breaks que partem um cardápio no meio do texto).
4. Fornecer também um formato sumarizado ou formatado "texto-rico" para ser enviado num clique via "Compartilhar por WhatsApp".

## Examples
- O PDF gerado pelo navegador, em vez de ser uma folha preta e branca quebrada, deve ter um topo escuro/colorido com o logotipo injetado e rodapé com os contatos legais/CRN da profissional.
- Botão "Gerar Link / Compartilhar WhatsApp" enviando a agenda do dia em asteriscos no mensageiro.

## Constraints
- Nunca subestimar a impressão A4 do plano. Se estiver feio, desvaloriza o software.
- Não misturar ferramentas administrativas da nutrucionista no Output de leitura final enviado ao leigo.

## Resources
- references/print-css-checklist.md
- references/whatsapp-summary-template.md

---
description: Governança do prompt, output e estrutura de geração de dietas utilizando IA.
---

# Clinical Prompt Engineering

## Goal
Elevar brutalmente a qualidade percebida (clínica e visual) do plano alimentar gerado pelo LLM, assegurando confiabilidade, assertividade mercadológica e estruturação fácil para leitura/edição médica e consumo pelo paciente final.

## Instructions
Quando atuar nos arquivos de IA (ex: `/api/gerar-plano.js`) ou na interface que o renderiza:
1. Fortalecer o Schema JSON para devolver não só opções, mas blocos estruturais: `{"refeicao": "Café da Manhã", "horario_sugerido": "08:00", "opcoes": [...], "dicas_preparo": "..."}`.
2. Dividir o mental model do prompt em duas saídas: Uso interno (justificativas) x Texto Paciente (claro, prático).
3. Exigir que porções sigam padrões estritos em g, ml ou unidades domésticas reconhecíveis pelos brasileiros.
4. Forçar a IA a prever substituições alimentares na mesma linha estrutural de equivalência (kcal/macros).
5. Prever, na UI, uma forma de re-gerar/ajustar pontualmente apenas UMA refeição, e não destruir o plano completo inteiro num misclick.

## Examples
- Se a IA sugere "Ovos", deve ser "2 ovos inteiros mexidos (100g) feitos com 1 fio de azeite".
- Se houver intolerância a Laticínios severa, blindar o prompt listando os derivados indiretos proibidos.

## Constraints
- A IA NUNCA deve retornar textos brutos (Markdown block). Deve retornar estruturas puras, confiáveis para mapeamento em Array no Frontend.
- Nenhuma sugestão alimentar incompatível com cultura/poder aquisitivo médio ou restrição pregressa do paciente.
- Não usar prompts vagos como "crie um cardápio normal para emagrecer". Forçar cálculos e proporções adequadas.

## Resources
- references/clinical-output-spec.md
- references/brazilian-meal-patterns.md
- scripts/validate_plan_schema.py

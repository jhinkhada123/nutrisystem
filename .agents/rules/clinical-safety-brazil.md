# Clinical Safety & Brazilian Context

## Objetivo
Definir o padrão clínico e estrutural de todo output nutricional gerado pela IA, ancorando as respostas na realidade mercadológica, cultural e biológica do Brasil (ex: Tabela TACO).

## Regras Obrigatórias (MUST)
- **Contexto Brasil:** Adotar o contexto alimentar brasileiro como padrão irrevogável (arroz, feijão, tapioca, farinha de mandioca, frutas locais).
- **Acessibilidade:** Priorização de alimentos plausíveis, comuns e financeiramente acessíveis, salvo se pedido dieta exótica.
- **Precisão Geométrica:** Estrutura de plano alimentar com porções estritamente claras em g/ml/unidades caseiras (ex: "1 colher de sopa (15g)").
- **Substituições:** Incluir substituições nutricionalmente equivalentes para cada refeição/grupo, protegendo a autonomia do paciente.
- **Diferenciação:** Separação clara no código/UI entre "conteúdo de uso interno (notas clínicas)" e "conteúdo final do paciente (cardápio alegre e motivacional)".
- **Editabilidade:** A saída da IA deve ser um rascunho altamente estruturado e 100% editável antes de virar a "versão oficial".
- **Consistência Restritiva:** Respeito absoluto entre objetivo, restrições, patologias e o menu. Se celíaco, zero sugestões com glúten cruzado.
- **Tom Clínico vs Humano:** Linguagem profissional, clara, sem soar como um robô genérico do ChatGPT.

## Proibido (NEVER)
- Planos com ingredientes vagos ("coma 1 fruta", "uma porção de proteína"). Exija especificidade ("1 maçã fuji média (130g)").
- Ingredientes exóticos ("salmão do alasca", "berries silvestres") sem justificativa clínica ou elitização desnecessária num plano barato.
- Promessas clínicas curativas ou indevidas geradas pela IA ("essa dieta vai curar seu hipotireoidismo").
- Protocolos restritivos totalmente inventados que fujam de consensos nutricionais padronizados.
- Outputs agrupados em um único texto corrido. Deve ser fatiado estruturalmente na UI.

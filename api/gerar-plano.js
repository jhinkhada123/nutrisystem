export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    try {
        const payload = req.body;
        
        const parseArray = (arr) => Array.isArray(arr) ? arr.join(', ') : (arr || 'Nenhum');

        const promptText = `Você é um Assistente Clínico de Nutrição ultra-rigoroso. Com base no perfil abaixo, crie um plano alimentar.

PERFIL DO PACIENTE:
- Nome: ${payload.nome || 'Não informado'}
- Idade: ${payload.idade || 'Não informada'}
- Peso: ${payload.peso || 'Não informado'}kg
- Altura: ${payload.altura || 'Não informada'}cm
- IMC: ${payload.imc || 'Não informado'}
- Objetivo: ${parseArray(payload.objetivos)} ${payload.objetivo_texto ? `(${payload.objetivo_texto})` : ''}
- Nível de Atividade Física: ${payload.nivel_atividade || 'Não informado'}
- Patologias (CUIDADO EXTREMO): ${parseArray(payload.patologias)}
- Restrições Alimentares: ${parseArray(payload.restricoes_alimentares)}
- Alergias: ${parseArray(payload.alergias)}
- Refeições Solicitadas: ${payload.refeicoes_por_dia || 'Café da manhã, Lanche, Almoço, Lanche da Tarde, Jantar'}
- Acorda: ${payload.horario_acorda || 'Não informado'} | Dorme: ${payload.horario_dorme || 'Não informado'}
- Suplementos Tatuais: ${payload.suplementos || 'Nenhum'}
- Orçamento para Alimentação: ${payload.orcamento_alimentar || 'Não informado'}
- Tempo para Cozinhar: ${payload.tempo_cozinhar || 'Não informado'}
- Alimentos Preferidos (INCLUIR): ${payload.alimentos_preferidos || 'Nenhum reportado'}
- Alimentos Evitados (NUNCA INCLUIR): ${payload.alimentos_evitados || 'Nenhum reportado'}
- Contexto Social e Rotina: ${payload.contexto_social || 'Nenhum reportado'}

DIRETRIZES DE OUTPUT (OBRIGATÓRIO):
1. Retorne EXATAMENTE e APENAS no formato JSON especificado.
2. Use "schema_version": "2.0".
3. Os identificadores técnicos (id_refeicao, id_opcao, id_item, referencia_item_id) devem ser gerados como strings curtas e técnicas (ex: "ref_1", "op_1_1", "item_1_1_1").
4. "uso_interno_nutricionista": Resumo do racional clínico para a profissional ler.
5. "orientacoes_paciente": Dicas simples, motivacionais ou metas de água.
6. A propriedade "refeicoes" deve ser um Array com objetos. Tente gerar de 4 a 6 refeições lógicas baseadas na hora que acorda/dorme.
7. Para cada "refeicao", crie 1 a 3 "opcoes" de pratos/kits.
8. Para cada "opcao", a chave "itens" é um array onde cada alimento TEM que ter seu próprio objeto.
9. PRECISÃO: Use "quantidade" (Number) e "unidade" (String: "g", "ml", "unidade") estritamente.
10. Se algo não for aplicável (ex: observacao de item, ou substituicoes de um item), envie "null" e nunca invente um texto genérico.
11. "substituicoes": Array Opcional de objetos apontando para o "referencia_item_id". Devem ser equivalentes em calorias/macros.
12. FOCO BRASIL: Arroz, feijão, tapioca, mandioca, pães simples, carnes acessíveis. Nada de salmão silvestre todo dia, foque na realidade. Respeite as patologias cegamente.
13. ADERÊNCIA AO CONTEXTO: Respeite estritamente o orçamento e o tempo para cozinhar reportados. Tente estruturar opções com um ou mais "Alimentos Preferidos". NUNCA, SOB HIPÓTESE ALGUMA, adicione "Alimentos Evitados". O plano deve parecer extremamente plausível para o "Contexto Social" do paciente.

FORMATO JSON EXIGIDO:
{
  "schema_version": "2.0",
  "uso_interno_nutricionista": {
    "racional_clinico": "...",
    "alertas_prescricao": "..."
  },
  "orientacoes_paciente": {
    "mensagem_motivacional": "...",
    "dicas_gerais": "..."
  },
  "refeicoes": [
    {
      "id_refeicao": "r_1",
      "ordem": 1,
      "nome": "Café da Manhã",
      "horario_sugerido": "08:00",
      "nota_clinica_refeicao": "...",
      "opcoes": [
        {
          "id_opcao": "op_1_1",
          "ordem": 1,
          "titulo_opcao": "Ovos com Tapioca",
          "itens": [
            {
              "id_item": "i_1",
              "alimento": "Ovo",
              "quantidade": 100,
              "unidade": "g",
              "medida_caseira": "2 unidades",
              "observacao": "mexidos"
            }
          ],
          "substituicoes": [
            {
              "referencia_item_id": "i_1",
              "alimento_substituto": "Frango desfiado",
              "quantidade": 80,
              "unidade": "g",
              "medida_caseira": "3 colheres",
              "observacao": null
            }
          ]
        }
      ]
    }
  ]
}`;

        // Chamada à API da OpenAI (GPT-4o)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" },
                temperature: 0.7,
                messages: [
                    { 
                        role: 'system', 
                        content: "Você é um Nutricionista Sênior. Você retorna APENAS um objeto JSON limpo e estruturado. Nunca use markdown array, use chaves rigidamente."
                    },
                    { 
                        role: 'user', 
                        content: promptText 
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('OpenAI API Error:', errorDetails);
            throw new Error('Falha na comunicação com a API da OpenAI.');
        }

        const data = await response.json();
        
        const completionText = data.choices?.[0]?.message?.content;
        
        if (!completionText) {
            throw new Error('Resposta vazia da IA.');
        }

        // Limpeza de segurança caso a IA retorne markdown
        const cleanJson = completionText.replace(/```json/g, '').replace(/```/g, '').trim();

        const planoParsed = JSON.parse(cleanJson);

        return res.status(200).json(planoParsed);

    } catch (error) {
        console.error('Erro /api/gerar-plano:', error);
        return res.status(500).json({ error: error.message || 'Erro interno ao processar plano.' });
    }
}

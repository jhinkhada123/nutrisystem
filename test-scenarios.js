import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const keyMatch = env.match(/OPENAI_API_KEY=["']?([^"'\n]+)["']?/);
if (!keyMatch) {
    console.error("ERRO: OPENAI_API_KEY não encontrada");
    process.exit(1);
}
const API_KEY = keyMatch[1];

// Helpers para construir o prompt exatamente igual ao backend
const sanitizeField = (str) => String(str || 'Não informado').substring(0, 500);
const parseArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ').substring(0, 1000) : 'Nenhum reportado';

const runTest = async (cenarioNome, requestPayload) => {
    let logTxt = `\n\n======================================================\n`;
    logTxt += `🧪 EXECUTANDO CENÁRIO: ${cenarioNome}\n`;
    logTxt += `======================================================\n`;

    const pNutri = requestPayload.protocolo_nutri;
    const protocoloAtivo = Boolean(pNutri && (pNutri.alimentos_priorizados || pNutri.alimentos_evitados || pNutri.observacoes_clinicas));

    const protocoloText = protocoloAtivo ? `
=== PROTOCOLO CLÍNICO DA NUTRICIONISTA (PRIORIDADE MÁXIMA) ===
A profissional que solicita este plano definiu as seguintes diretrizes pessoais.
Você DEVE segui-las como prioridade sobre padrões genéricos.

- Alimentos PRIORIZADOS (incluir quando clinicamente apropriado): ${sanitizeField(pNutri.alimentos_priorizados)}
- Alimentos EVITADOS (nunca incluir): ${sanitizeField(pNutri.alimentos_evitados)}
- Perfil do plano: ${sanitizeField(pNutri.perfil_plano)}
- Especificidade desejada: ${sanitizeField(pNutri.grau_especificidade)}
- Diretrizes clínicas da profissional: "${sanitizeField(pNutri.observacoes_clinicas)}"

REGRA: O protocolo da nutricionista prevalece sobre padrões genéricos,
mas NUNCA anula patologias, alergias ou restrições alimentares do paciente.
A IA é copiloto. A profissional comanda.
=== FIM DO PROTOCOLO ===\n` : '';

    const observacoesTruncadas = String(requestPayload.observacoes || 'Nenhuma').substring(0, 2000);

    const promptText = `Crie um plano alimentar com rigor clínico seguindo as diretrizes.

=== INÍCIO DOS DADOS MÉDICOS E OBSERVAÇÕES DO PACIENTE ===
- Nome: ${sanitizeField(requestPayload.nome)}
- Idade: ${sanitizeField(requestPayload.idade)}
- Peso: ${sanitizeField(requestPayload.peso)}kg
- Altura: ${sanitizeField(requestPayload.altura)}cm
- Objetivos: ${parseArray(requestPayload.objetivos)}
- Patologias (CUIDADO EXTREMO): ${parseArray(requestPayload.patologias)}
- Restrições Alimentares: ${parseArray(requestPayload.restricoes_alimentares)}
- Refeições Solicitadas: ${sanitizeField(requestPayload.refeicoes_por_dia)}
- Orçamento para Alimentação: ${sanitizeField(requestPayload.orcamento_alimentar)}

Texto Livre (Observações do Paciente):
"""
${observacoesTruncadas}
"""
=== FIM DOS DADOS MÉDICOS ===
${protocoloText}
REGRAS DE ESPECIFICIDADE ALIMENTAR (OBRIGATÓRIO):
- Cada item DEVE ter nome específico e forma de preparo.
- Termos vagos como "biscoito integral", "iogurte", "fruta", "queijo branco", "salada" sem especificação explícita do subtipo são TERMINANTEMENTE PROIBIDOS.
- Proteínas (frango, carne, peru, peixe, etc.) DEVEM especificar o corte e o formato (ex: in natura, grelhado, assado, cozido, desfiado). Evite nomes que criem ambiguidade com ultraprocessados/embutidos (use "Filé de peito de peru in natura grelhado" ao invés de apenas "Peito de peru").
- Detalhe o tipo (ex: "Banana-prata", "Iogurte natural integral sem açúcar", "Queijo minas frescal").
- Se a especificidade do protocolo for "detalhado", explicite tipo, subtipo e forma de preparo clara.

DIRETRIZES DE OUTPUT (OBRIGATÓRIO):
1. Retorne EXATAMENTE no formato JSON com schema_version "2.0".
2. As propriedades básicas: uso_interno_nutricionista (racional_clinico, alertas_prescricao), orientacoes_paciente, refeicoes.
3. itens TEM QUE TER: alimento, quantidade, unidade, medida_caseira, observacao.

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
          "titulo_opcao": "Exemplo",
          "itens": [
            {
              "id_item": "i_1",
              "alimento": "Ovo inteiro caipira in natura",
              "quantidade": 100,
              "unidade": "g",
              "medida_caseira": "2 unidades médias",
              "observacao": "mexidos"
            }
          ],
          "substituicoes": []
        }
      ]
    }
  ]
}`;

    try {
        console.log(`Rodando: ${cenarioNome}...`);
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" },
                temperature: 0.7,
                messages: [
                    { 
                        role: 'system', 
                        content: "Você é um Assistente de Prescrição Nutricional Clínica que opera como COPILOTO da nutricionista. Você NÃO gera planos genéricos — você executa o protocolo clínico definido pela profissional."
                    },
                    { role: 'user', content: promptText }
                ]
            })
        });

        const jsonResp = await response.json();
        const endTime = Date.now();
        
        if (jsonResp.error) throw jsonResp.error;

        logTxt += `[OK em ${((endTime - startTime)/1000).toFixed(2)}s]\n`;
        const dataContent = JSON.parse(jsonResp.choices[0].message.content);

        logTxt += "\n-> RACIONAL DA NUTRICIONISTA:\n";
        logTxt += dataContent.uso_interno_nutricionista.racional_clinico + "\n";
        
        if (dataContent.uso_interno_nutricionista.alertas_prescricao && dataContent.uso_interno_nutricionista.alertas_prescricao !== "Nenhum alerta aplicável.") {
             logTxt += "-> ALERTA CLÍNICO GERADO PELA IA: " + dataContent.uso_interno_nutricionista.alertas_prescricao + "\n";
        }

        logTxt += "\n-> AMOSTRA DO CARDÁPIO E ESPECIFICIDADE:\n";
        dataContent.refeicoes.slice(0, 3).forEach(r => {
            logTxt += `[${r.nome}]\n`;
            r.opcoes[0].itens.forEach(i => {
                logTxt += `  - ${i.alimento} (${i.quantidade}${i.unidade})\n`;
            });
        });

        fs.appendFileSync('resultado_testes.txt', logTxt, 'utf-8');

    } catch (err) {
        fs.appendFileSync('resultado_testes.txt', `\nERRO: ${err.message || err}\n`, 'utf-8');
    }
};

const cenarioPadrao = {
    nome: "João Teste", idade: 40, peso: 85, altura: 175, objetivos: ["Emagrecimento"],
    refeicoes_por_dia: "4", orcamento_alimentar: "Acessível, sem firulas",
    patologias: [], restricoes_alimentares: []
};

async function executarTodos() {
    // Cenário 1: Sem Protocolo
    await runTest("1. SEM PROTOCOLO (Baseline)", {
        ...cenarioPadrao,
        protocolo_nutri: null
    });

    // Cenário 2: Contraditório
    await runTest("2. CONTRADITÓRIO (Prioriza carbos pesados, mas paciente tem Diabetes e restrições a açucar)", {
        ...cenarioPadrao,
        patologias: ["Diabetes Tipo 2"],
        restricoes_alimentares: ["Sem Açúcar", "Apenas carbos de baixo IG"],
        protocolo_nutri: {
            alimentos_priorizados: "Açúcar mascavo, Pão francês, Mel, Batata inglesa, Macarrão tradicional",
            alimentos_evitados: "",
            perfil_plano: "pratico",
            grau_especificidade: "conciso",
            observacoes_clinicas: "Colocar muito carboidrato simples em todas as refeições para dar energia barata."
        }
    });

    // Cenário 3: Mínimo/Vazio
    await runTest("3. PROTOCOLO MÍNIMO (Apenas um ou dois itens pontuais)", {
        ...cenarioPadrao,
        protocolo_nutri: {
            alimentos_priorizados: "Aveia, Ovos",
            alimentos_evitados: "",
            perfil_plano: "",
            grau_especificidade: "conciso",
            observacoes_clinicas: ""
        }
    });

    // Cenário 4: Ultra Específico
    await runTest("4. ULTRA ESPECÍFICO (Evitar ultraprocessados + detalhado, sem glúten)", {
        ...cenarioPadrao,
        restricoes_alimentares: ["Sem Glúten"],
        protocolo_nutri: {
            alimentos_priorizados: "Ovos caipiras, Batata doce, Abóbora, Frutas da estação, Proteínas magras in natura",
            alimentos_evitados: "Qualquer tipo de ultraprocessado, pães de mercado, industrializados, embutidos, peito de peru defumado",
            perfil_plano: "funcional",
            grau_especificidade: "detalhado",
            observacoes_clinicas: "Foco absoluto em refeições limpas, baixo custo (mercado municipal/feira). Somente comida que a nossa bisavó reconheceria."
        }
    });

}

fs.writeFileSync('resultado_testes.txt', '', 'utf-8'); // Limpa o arquivo
executarTodos().then(() => console.log('Finalizado! Leia o arquivo resultado_testes.txt'));

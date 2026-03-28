export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    try {
        const payload = req.body;
        
        // Formatar o array ou strings para exibição clara no prompt
        const parseArray = (arr) => Array.isArray(arr) ? arr.join(', ') : (arr || 'Nenhum');

        const promptText = `Você é um assistente especializado em nutrição. Com base nos dados do paciente abaixo, gere um plano alimentar semanal completo e personalizado.

Dados do paciente:
- Nome: ${payload.nome || 'Não informado'}
- Idade: ${payload.idade || 'Não informada'}
- Peso: ${payload.peso || 'Não informado'}kg
- Altura: ${payload.altura || 'Não informada'}cm
- IMC: ${payload.imc || 'Não informado'}
- Objetivo: ${parseArray(payload.objetivos)} ${payload.objetivo_texto ? `(${payload.objetivo_texto})` : ''}
- Nível de atividade física: ${payload.nivel_atividade || 'Não informado'}
- Patologias: ${parseArray(payload.patologias)}
- Restrições alimentares: ${parseArray(payload.restricoes_alimentares)}
- Alergias: ${parseArray(payload.alergias)}
- Refeições por dia: ${payload.refeicoes_por_dia || 'Não informado'}
- Horário que acorda: ${payload.horario_acorda || 'Não informado'}
- Horário que dorme: ${payload.horario_dorme || 'Não informado'}
- Suplementos em uso: ${payload.suplementos || 'Nenhum'}

Para cada uma das 5 refeições abaixo, gere exatamente 5 opções de refeição. As opções devem respeitar todas as restrições, alergias e o objetivo do paciente.

Refeições: Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar.

Retorne APENAS um JSON válido, sem texto adicional, neste formato exato:
{
  "cafe_da_manha": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"],
  "lanche_da_manha": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"],
  "almoco": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"],
  "lanche_da_tarde": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"],
  "jantar": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"]
}`;

        // Chamada à API da Anthropic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2500,
                temperature: 0.7,
                system: "Você é um nutricionista estrito. O retorno MÁXIMO e ÚNICO que você fará é o JSON estrito. Não adicione saudações ou markdown ```json.",
                messages: [
                    { 
                        role: 'user', 
                        content: promptText 
                    },
                    {
                        role: 'assistant',
                        content: "{" // Prefill para garantir que o output seja puro corpo JSON.
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('Anthropic API Error:', errorDetails);
            throw new Error('Falha na comunicação com a API de IA.');
        }

        const data = await response.json();
        
        // Como forçamos o prefill "{", o Anthropic só retorna o resto. Concatenamos para recompor o JSON perfeito.
        const completionText = data.content && data.content[0] && data.content[0].text ? "{" + data.content[0].text : null;
        
        if (!completionText) {
            throw new Error('Resposta vazia da IA.');
        }

        // Limpeza simples de segurança caso IA cuspa marcações perdidas
        const cleanJson = completionText.replace(/```json/g, '').replace(/```/g, '').trim();

        const planoParsed = JSON.parse(cleanJson);

        return res.status(200).json(planoParsed);

    } catch (error) {
        console.error('Erro /api/gerar-plano:', error);
        return res.status(500).json({ error: error.message || 'Erro interno ao processar plano.' });
    }
}

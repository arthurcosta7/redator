"""
enem_prompt.py — Prompts para correção de redações modelo ENEM

O ENEM avalia 5 competências, cada uma valendo até 200 pontos (total: 1000).

Competência 1: Domínio da modalidade escrita formal da língua portuguesa
Competência 2: Compreensão da proposta e desenvolvimento do tema
Competência 3: Seleção e organização das informações
Competência 4: Conhecimento dos mecanismos linguísticos de argumentação
Competência 5: Proposta de intervenção

Níveis de pontuação por competência: 0, 40, 80, 120, 160, 200
"""

ENEM_SYSTEM_PROMPT = """Você é um professor experiente e avaliador oficial do ENEM, com mais de 15 anos de experiência corrigindo redações. Você conhece profundamente o edital do ENEM e os critérios oficiais de avaliação.

Sua missão é corrigir redações com:
1. PRECISÃO: Seguir rigorosamente o edital do ENEM
2. HONESTIDADE: Identificar problemas reais sem suavizar demais
3. CONSTRUTIVIDADE: Sempre explicar o que melhorar e como
4. FIDELIDADE: Agir como um corretor humano experiente, não como IA genérica

CRITÉRIOS DE PONTUAÇÃO (cada competência: 0, 40, 80, 120, 160 ou 200 pontos):

**COMPETÊNCIA 1 — Domínio da linguagem formal**
- 200: Excelente domínio. Pouquíssimas (ou nenhuma) impropriedades.
- 160: Bom domínio. Poucas impropriedades que não comprometem a comunicação.
- 120: Domínio mediano. Algumas impropriedades e/ou inadequações.
- 80: Domínio insuficiente. Muitas impropriedades; estruturas inadequadas.
- 40: Domínio precário. Domínio muito limitado da norma culta.
- 0: Texto sem domínio da norma culta ou fora do gênero dissertativo-argumentativo.

**COMPETÊNCIA 2 — Compreensão da proposta e desenvolvimento do tema**
- 200: Desenvolve o tema com excelência; abordagem profunda e original.
- 160: Desenvolve o tema com clareza; abordagem pertinente.
- 120: Desenvolve o tema de forma previsível ou com tangenciamento parcial.
- 80: Desenvolve o tema de forma limitada; tangenciamento claro.
- 40: Aborda o tema de forma tangencial; sem desenvolver a proposta.
- 0: Fuga total ao tema, não argumentativo, ou texto sem estrutura dissertativa.

**COMPETÊNCIA 3 — Seleção e organização de argumentos**
- 200: Argumentação excelente; relaciona informações e perspectivas de forma coesa e coerente.
- 160: Boa seleção de informações; organização lógica.
- 120: Argumentação previsível ou com algumas inconsistências lógicas.
- 80: Argumentação fraca; informações pouco pertinentes ou mal articuladas.
- 40: Argumentação muito limitada; sem hierarquização das ideias.
- 0: Sem seleção de argumentos; apenas cópia dos textos motivadores.

**COMPETÊNCIA 4 — Coesão e coerência textual**
- 200: Excelente coesão. Usa operadores argumentativos com precisão e variedade.
- 160: Boa coesão. Uso adequado dos recursos coesivos.
- 120: Coesão mediana. Alguns problemas de articulação.
- 80: Coesão insuficiente. Sequenciação prejudicada.
- 40: Coesão precária. Texto sem articulação.
- 0: Texto sem estrutura; sem recursos coesivos.

**COMPETÊNCIA 5 — Proposta de intervenção**
- 200: Proposta detalhada, pertinente, respeitando direitos humanos, com agente, ação, modo, efeito e detalhamento.
- 160: Proposta boa com a maioria dos elementos: agente, ação, meio, finalidade.
- 120: Proposta incompleta; faltam elementos ou é vaga.
- 80: Proposta superficial; sem detalhamento ou muito genérica.
- 40: Proposta tangencial ao tema ou sem relação com o corpo do texto.
- 0: Ausência de proposta ou proposta que fere os direitos humanos.

NOTA ZERO (Texto eliminado): Aplique nota zero se:
- Fuga total ao tema
- Não dissertativo-argumentativo
- Extensão menor que 7 linhas
- Texto em língua estrangeira
- Impropérios, palavrões, desrespeito
- Cópia integral dos textos motivadores
- Proposta que viola direitos humanos

Responda SEMPRE em JSON estruturado conforme solicitado. Seja específico e detalhado em cada feedback."""


def build_enem_correction_prompt(essay_content: str, theme: str | None = None) -> str:
    """
    Constrói o prompt de correção para uma redação ENEM específica.
    """
    theme_context = f"\n\n**TEMA DA REDAÇÃO:** {theme}" if theme else ""

    return f"""Corrija a seguinte redação modelo ENEM:{theme_context}

---REDAÇÃO---
{essay_content}
---FIM DA REDAÇÃO---

Faça uma correção completa e precisa. Responda APENAS com JSON válido neste formato exato:

{{
  "total_score": <número entre 0 e 1000, múltiplo de 40>,
  "competencies": [
    {{
      "number": 1,
      "name": "Domínio da modalidade escrita formal da língua portuguesa",
      "score": <0, 40, 80, 120, 160 ou 200>,
      "max_score": 200,
      "feedback": "<análise detalhada de 3-5 frases>",
      "strengths": ["<ponto forte 1>", "<ponto forte 2>"],
      "improvements": ["<melhoria específica 1>", "<melhoria específica 2>"]
    }},
    {{
      "number": 2,
      "name": "Compreensão da proposta e desenvolvimento do tema",
      "score": <0, 40, 80, 120, 160 ou 200>,
      "max_score": 200,
      "feedback": "<análise detalhada>",
      "strengths": [],
      "improvements": []
    }},
    {{
      "number": 3,
      "name": "Seleção, relação, organização e interpretação de informações",
      "score": <0, 40, 80, 120, 160 ou 200>,
      "max_score": 200,
      "feedback": "<análise detalhada>",
      "strengths": [],
      "improvements": []
    }},
    {{
      "number": 4,
      "name": "Conhecimento dos mecanismos linguísticos para construção da argumentação",
      "score": <0, 40, 80, 120, 160 ou 200>,
      "max_score": 200,
      "feedback": "<análise detalhada>",
      "strengths": [],
      "improvements": []
    }},
    {{
      "number": 5,
      "name": "Elaboração de proposta de intervenção",
      "score": <0, 40, 80, 120, 160 ou 200>,
      "max_score": 200,
      "feedback": "<análise detalhada>",
      "strengths": [],
      "improvements": []
    }}
  ],
  "highlights": [
    {{
      "start": <índice de início no texto>,
      "end": <índice de fim no texto>,
      "text": "<trecho exato do texto>",
      "type": "<positive|negative|suggestion>",
      "comment": "<comentário específico>"
    }}
  ],
  "insights": {{
    "general_feedback": "<análise geral da redação em 4-6 frases. Seja honesto e construtivo.>",
    "main_strengths": ["<força 1>", "<força 2>"],
    "priority_improvements": ["<melhoria prioritária 1>", "<melhoria prioritária 2>", "<melhoria prioritária 3>"],
    "writing_level": "<iniciante|intermediário|avançado>"
  }},
  "is_zero": <true se nota zero, false caso contrário>,
  "zero_reason": "<motivo da nota zero, se aplicável>"
}}

IMPORTANTE:
- Identifique pelo menos 5 grifes no texto (mix de positivos e negativos)
- O total_score deve ser exatamente a soma das 5 competências
- Seja específico nas melhorias (não use frases genéricas como "melhore a escrita")
- Use linguagem acessível para estudantes do Ensino Médio"""

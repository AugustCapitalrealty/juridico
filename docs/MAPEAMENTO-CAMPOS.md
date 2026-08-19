# Mapeamento de campos

Referência de todos os marcadores do documento modelo e de onde vem cada
valor. Use ao alterar o modelo ou ao investigar um campo que saiu errado.

## Marcadores simples: `{{CAMPO}}`

Substituídos por texto. Funcionam dentro de células de tabela.

| Marcador | Origem |
|---|---|
| `{{DATA_PESQUISA}}` | painel; vazio usa a data de hoje |
| `{{RAZAO_SOCIAL}}` | `Receita Federal` → Razão social |
| `{{NOME_FANTASIA}}` | `Dados Pessoais` → Nome fantasia |
| `{{CNPJ}}` | `Receita Federal` → CNPJ, com máscara aplicada |
| `{{DATA_ABERTURA}}` | `Receita Federal` → Data de abertura, normalizada para dd/MM/aaaa |
| `{{ESCOPO}}` | painel |
| `{{SOLICITACAO}}` | painel |
| `{{EMPREENDIMENTO}}` | painel |
| `{{VALOR_CONTRATACAO}}` | painel, formatado em reais |
| `{{CAPITAL_SOCIAL}}` | `Receita Federal`, com valor por extenso entre parênteses |
| `{{FATURAMENTO_PRESUMIDO}}` | `Perfil Sociodemografico`, com queda para `Capa` |
| `{{ENDERECO}}` | `Receita Federal` → Endereço na Receita Federal |
| `{{EXPOSICAO_JURIDICA}}` | soma de `Valor da Causa` por polo; duas linhas |
| `{{EXPOSICAO_OBS}}` | total de processos e quantos em andamento |
| `{{COMPROT}}` | painel |
| `{{PROTESTOS_QTD}}` | contagem em `Protestos em Cartório` |
| `{{PROTESTOS_OBS}}` | uma linha por protesto: valor, cartório e UF |
| `{{SERASA_RESULTADO}}` | `Serasa SPC`: "Nada Consta" ou nº de pendências |
| `{{SERASA_OBS}}` | `Serasa - Consulta Score` → coluna Risco |
| `{{QTD_PARTICIPACOES}}` | contagem em `Participação em outras empresas` |
| `{{QTD_FILIAIS}}` | contagem em `Filiais` |
| `{{CNAE_PRINCIPAL}}` | `Receita Federal` → Atividade econômica |
| `{{NATUREZA_JURIDICA}}` | `Receita Federal` → Natureza jurídica |
| `{{PORTE}}`, `{{QTD_FUNCIONARIOS}}` | `Perfil Sociodemografico` |
| `{{IDADE_EMPRESA}}` | `Capa` |
| `{{TEXTO_PROCESSOS}}` | frase montada com total e em andamento |
| `{{TOTAL_PROCESSOS}}`, `{{PROCESSOS_EM_ANDAMENTO}}` | `Processos (DOCUMENTO)` |
| `{{TRANSPARENCIA_TEXTO}}` | painel |
| `{{QTD_TRANSPARENCIA}}` | contagem em `Portal da Transparência` |
| `{{RISCO_REPUTACIONAL}}`, `{{RISCO_JURIDICO_PLATAFORMA}}`, `{{RISCO_CREDITO}}`, `{{PEP_MIDIAS}}` | `Capa` |

Campo sem origem disponível vira `[ A PREENCHER ]` no rascunho e entra no
checklist final.

## Marcadores de bloco: `<<BLOCO_X>>`

O parágrafo inteiro é substituído por conteúdo gerado — lista ou tabela.

| Marcador | Conteúdo |
|---|---|
| `<<BLOCO_SOCIOS>>` | tabela: documento, nome, qualificação, situação |
| `<<BLOCO_PARTICIPACOES>>` | lista de empresas com CNPJ |
| `<<BLOCO_EMPRESAS_RELACIONADAS>>` | total de vínculos e os sinalizados (até 25) |
| `<<BLOCO_RESUMO_PROCESSOS>>` | distribuição por tribunal e por ano |
| `<<BLOCO_PROCESSOS_ANDAMENTO>>` | tabela dos processos não encerrados, do maior valor de causa para o menor |
| `<<BLOCO_TRANSPARENCIA>>` | ocorrências no Portal da Transparência (até 15) |
| `<<BLOCO_CNAE_SECUNDARIO>>` | CNAEs do painel; vazio vira bloco "A PREENCHER" |
| `<<BLOCO_CHECKLIST>>` | pendências, avisos de leitura e data de geração |

## Como os números dos processos são apurados

Tudo sai da aba `Processos (DOCUMENTO)`, com as colunas localizadas pelo nome
do cabeçalho.

- **Total**: linhas com algum dado preenchido.
- **Em andamento**: status `EM TRAMITACAO`. É a definição usada nos pareceres
  da área — ver a seção final do README.
- **Não encerrados**: `EM TRAMITACAO`, `SUSPENSO` e `EM GRAU DE RECURSO`.
  Alimenta a tabela de apoio; a diferença para "em andamento" vira aviso no
  checklist.
- **Exposição como réu**: soma de `Valor da Causa` onde `Polo` é `PASSIVO`.
- **Exposição como autor**: mesma soma onde `Polo` é `ATIVO`.

Linhas com polo `N/D` não entram em nenhuma das somas, o que reproduz o
critério do parecer redigido à mão.

## Conversão de números

A planilha mistura dois formatos na mesma coluna: `61500.00`, vindo da API, e
`1.808.100,42`, no padrão brasileiro. `paraNumero` trata os dois. O caso
ambíguo é um valor com um único ponto e sem vírgula:

- três dígitos após o ponto (`3.102`) → separador de milhar
- dois dígitos (`1234.56`) → decimal

Os testes cobrem os dois casos.

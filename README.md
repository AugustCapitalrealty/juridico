# Gerador de rascunho — Parecer Reputacional

Automação em Google Apps Script que lê a planilha de pesquisa de due diligence
e gera um **rascunho** do parecer reputacional no Google Docs, com todos os
dados objetivos já preenchidos e as seções de análise jurídica em branco.

O objetivo é acabar com o print-e-cola: o que hoje é transcrito à mão da
planilha para o documento passa a ser preenchido pelo script. O que é
julgamento jurídico continua sendo escrito por uma pessoa — o rascunho apenas
entrega, ao lado de cada seção, os dados de apoio já organizados.

## O que é preenchido automaticamente

Conferido contra o parecer da Azimute Engenheiros Consultores, redigido à mão:

| Campo | Origem na planilha |
|---|---|
| Razão social, CNPJ, data de abertura, natureza jurídica, endereço | `Receita Federal` |
| Capital social (com valor por extenso) | `Receita Federal` |
| Faturamento presumido, porte, nº de funcionários | `Perfil Sociodemografico` |
| Total de processos, em andamento | `Processos (DOCUMENTO)` |
| Exposição jurídica como réu e como autor | soma de `Valor da Causa` por polo |
| Distribuição por tribunal e por ano | `Processos Resumo` |
| Tabela de apoio com os processos não encerrados | `Processos (DOCUMENTO)` |
| Protestos: quantidade, valores e cartórios | `Protestos em Cartório` |
| Serasa / Boa Vista: resultado e texto do score | `Serasa SPC`, `Serasa - Consulta Score`, `Boa Vista` |
| Quadro societário (atual e histórico) | `Sócios e Administradores (QSA)` |
| Participações em outras empresas, filiais | `Participação em outras empresas`, `Filiais` |
| Vínculos sinalizados em PEP/Listas, MPT, Offshores | `Empresas Relacionadas` |
| Ocorrências no Portal da Transparência | `Portal da Transparência` |

## O que continua manual

Dois grupos, ambos sinalizados no rascunho e listados no checklist final.

**Não existe na planilha** — preenchido no painel antes de gerar:

- CNAEs secundários (não constam no relatório; vêm do cartão CNPJ)
- COMPROT
- Valores e período do Portal da Transparência
- Valor da contratação, escopo, nº da solicitação, empreendimento

**É julgamento jurídico** — escrito no documento, com dados de apoio ao lado:

- Destaque dos processos relevantes e avaliação do risco
- Análise de mídias negativas e listas restritivas
- Conclusão e avaliação do comitê
- Captura do Google Maps do endereço

## Estrutura

```
apps-script/         código que roda no Google Apps Script
  Config.gs            IDs do modelo e da pasta, nomes das abas, campos manuais
  Menu.gs              menu do painel, leitura dos campos, disparo da geração
  LeitorPlanilha.gs    leitura e consolidação da planilha de pesquisa
  GeradorRascunho.gs   cópia do modelo e preenchimento dos marcadores
  Utils.gs             formatação BRL, datas, documentos e valor por extenso
modelo/
  modelo-parecer.html  fonte do documento modelo (já publicado no Drive)
testes/
  executar-testes.js   roda os .gs no Node contra um dump real da planilha
  gerar-dump.py        converte a planilha .xlsx no dump usado pelos testes
docs/
  INSTALACAO.md        passo a passo de instalação
  MAPEAMENTO-CAMPOS.md marcadores do modelo e sua origem
```

## Testes

Os `.gs` rodam em Node com stubs das APIs do Apps Script, o que permite
conferir o leitor contra uma planilha real sem abrir o navegador:

```bash
python3 testes/gerar-dump.py pesquisa.xlsx testes/planilha-exemplo.json
node testes/executar-testes.js testes/planilha-exemplo.json
```

Os valores esperados são os do parecer da Azimute redigido à mão — inclusive
a exposição jurídica de R$ 1.808.100,42 (réu) e R$ 1.107.572,16 (autor), que
o script reproduz centavo a centavo.

O dump contém CPF, e-mail e telefone de pessoas físicas e por isso está no
`.gitignore`. Gere-o localmente; não versione.

## Uma decisão que vale registrar

A planilha classifica os processos em cinco situações. O parecer da Azimute
conta **8 processos em andamento**, que corresponde exatamente aos de status
`EM TRAMITACAO` — deixando de fora 2 suspensos e 1 em grau de recurso.

O script segue essa prática para que o número do parecer não mude, mas os três
processos restantes aparecem na tabela de apoio com a situação visível, e o
checklist final avisa que existem. A decisão de incluí-los ou não fica com
quem revisa, e não passa despercebida.

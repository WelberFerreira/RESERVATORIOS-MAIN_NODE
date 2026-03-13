# Cálculo Reservatórios

# Simulador de Balanço de Volume em Barragem (Node.js)

Este programa executa um **balanço mensal de volumes (m³/mês)** em uma barragem, a partir de séries de entrada e parâmetros físicos, produzindo:

1. **Tabela “estilo planilha”** (valores arredondados, prontos para conferência/colagem).
2. **Saída “bruta”** (arrays numéricos), útil para integrações com APIs, testes e gráficos.

O simulador lê **todos os dados** de `./api/data.json`, suporta **N anos de simulação**, aplica a **regra de 2ª passada** (quando o volume ficaria negativo) e permite **usar a descarga informada** ou **calculá-la como 20% da vazão média mensal (Qmmm)**.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Como funciona](#como-funciona)
- [Fórmulas](#fórmulas)
- [Regra de 2ª passada (planilha)](#regra-de-2ª-passada-planilha)
- [Arquivo `api/data.json`](#arquivo-apidatajson)
- [Execução](#execução)
- [Saídas](#saídas)
- [Múltiplos anos (N anos)](#múltiplos-anos-n-anos)
- [Cenários de captação](#cenários-de-captação)
- [Validações e mensagens](#validações-e-mensagens)
- [Boas práticas e dicas](#boas-práticas-e-dicas)
- [Perguntas frequentes](#perguntas-frequentes)

---

## Arquitetura

- **Node.js (ESM)**: `index.js` lê e processa os dados.
- **Fonte de dados**: `./api/data.json`.
- **Sem dependências externas** para cálculo (somente `fs/promises` para leitura de arquivo).
- **Duas camadas de saída**:
  - _Estilo planilha_: registros mensais com arredondamento.
  - _Bruta_: arrays com valores em ponto flutuante, sem arredondamento.

---

## Como funciona

1. **Carrega** `./api/data.json`.
2. **Lê parâmetros** físicos da barragem e séries mensais (12 valores) ou expandidas (12 × anos).
3. **Determina os anos** da simulação via `operacao.anos` (padrão = 1).
4. **Expande as séries** de 12 meses para `12 × anos` quando necessário.
5. **Calcula descargas (Q_defluente)**:
   - Se **vier** no JSON (com 12 ou 12 × anos valores): usa.
   - Se **não vier**: calcula **Q_defluente = 0,20 × Qmmm** (mês a mês, em m³/s).
6. **Converte vazões** (m³/s) para volumes mensais (m³/mês).
7. **Calcula perdas** (infiltração e evaporação) e **captação**.
8. **Propaga volume** mês a mês, aplicando o **clipping** `[0, Max_Volume]` e a **regra de 2ª passada** quando necessário.
9. **Emite as saídas** (planilha e bruta) no `stdout` (console).

---

## Fórmulas

**Convenções**  
- `dias`: número de dias do mês.  
- `86400`: segundos no dia.

**Entrada média (m³/mês):**
```text
Entrada = Qmmm (m³/s) × dias × 86400
```

**Descarga (Q_remanescente, m³/mês):**
```text
Q_defluente_mês = Q_defluente (m³/s) × dias × 86400
```
> Se `Q_defluente` não vier no JSON:  
> `Q_defluente (m³/s) = 0,20 × Qmmm (m³/s)`

**Evaporação (m³/mês):**
```text
Evaporação = Evaporacao (mm) × Área (m²) / 1000
```

**Infiltração (m³/mês):**
```text
Infiltração = M_Infiltration (m/dia) × dias × Área (m²)
```
> Sem conversões adicionais: `m × m² = m³`

**Captação (m³/mês):**
```text
Temp_cap_mês (h) = tempDia (h/dia) × dias
Qcap (m³/h) = Q_Cap (L/s) × 3600 / 1000
Captação_mês = Temp_cap_mês × Qcap
```

---

## Regra de 2ª passada (planilha)

1. **Primeira passada** (Vol_Prov):
```text
Vol_Prov = Vol_(t-1) + Entrada - (Descarga + Infiltração + Evaporação + Captação)
```

2. **Se Vol_Prov < 0** → **Segunda passada** (retira perdas não prioritárias):
```text
Vol_Final* = Vol_(t-1) + Entrada - (Descarga + Captação)
```

3. **Clipping final**:
```text
Vol_Final = min( max(Vol_Final*, 0), Max_Volume )
```

4. **CHECK**:
```text
CHECK = "PROBLEMA" se (Descarga + Infiltração + Evaporação + Captação) > Vol_(t-1) + Entrada
       caso contrário "OK"
```

---

## Arquivo `api/data.json`

Estrutura mínima:

```json
{
  "dam_data": {
    "Max_Volume": 173000,
    "Min_Volume": 0,
    "Tot_Area": 40520.46,
    "M_Infiltration": 0.1,
    "Q_Reg": 0.034,
    "Min_Vol_Observed": 0,
    "Q_Cap": 104
  },
  "operacao": {
    "anos": 1,
    "Meses": [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ],
    "Qmmm": [
      0.13299, 0.16475, 0.16739, 0.1532, 0.10796, 0.07531,
      0.05364, 0.02711, 0.0073, 0.00284, 0.03111, 0.07213
    ],
    "Dias": [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    "Evaporacao": [
      130.06, 141.88, 130.65, 115.87,
      104.00, 96.00, 116.02, 159.60,
      169.76, 204.80, 110.62, 120.58
    ],
    "tempDia": [24, 24, 24, 24, 24, 0, 0, 0, 0, 24, 24, 24]

    /* OPCIONAL: se não informar, será calculado como 20% de Qmmm
    "Q_defluente": [
      0.06, 0.075, 0.076, 0.072, 0.059, 0.05,
      0.044, 0.036, 0.03, 0.029, 0.037, 0.049
    ]
    */
  }
}
```

### Regras de tamanho das séries
- Você pode fornecer **12 valores** (mês-a-mês) e definir `anos > 1`.  
  → O programa **repete** os 12 valores para cada ano.
- Ou pode fornecer **12 × anos** valores.  
  → O programa **não repete**, apenas **usa como está** (útil para cenários por ano).

Se `Q_defluente` não estiver presente, será calculado como **20% de Qmmm** para cada mês/ano.

---

## Execução

1. Garanta Node 18+.
2. Estrutura de pastas:
   ```
   .
   ├─ api/
   │  └─ data.json
   └─ index.js
   ```
3. Rode:
   ```bash
   node index.js
   ```
4. O programa imprime as duas saídas no console (`stdout`).

> **Dica:** redirecione para arquivo:
> ```bash
> node index.js > saida.json
> ```

---

## Saídas

### 1) Saída “estilo planilha”
Array de objetos, um por mês, com valores **arredondados**:

```json
[
  {
    "Mes": "Janeiro - Ano 1",
    "Qmmm_m3s": 0.13299,
    "Dias": 31,
    "Entrada_m3_mes": 356200,
    "Q_Remanescente_m3_mes": 160704,
    "Infiltracao_m3_mes": 125613,
    "Evaporacao_m3_mes": 5270,
    "Captacao_m3_mes": 278554,
    "Vol_Prov": 89943,
    "Vol_Final": 89943,
    "CHECK": "OK"
  }
]
```

### 2) Saída “bruta”
Objeto com arrays **sem arredondamento**, ideal para APIs e gráficos:

```json
{
  "meses": ["Janeiro - Ano 1", "..."],
  "descarga": [160704, "..."],
  "entrada_media": [356200.416, "..."],
  "evaporacao_m3": [5270.0910276, "..."],
  "infiltracao": [125613.426, "..."],
  "qcap_total": [278553.6, "..."],
  "volume_final": [89943.123, "..."],
  "volume_prob": [89943.123, "..."],
  "CHECK": ["OK", "..."]
}
```

---

## Múltiplos anos (N anos)

- Defina `operacao.anos` no JSON (ex.: `3`).
- Se as séries tiverem **12 itens**, serão **repetidas** por ano.
- Se já tiverem **12 × anos** itens, **não** haverá repetição.
- O **volume final do mês** vira o **volume inicial do mês seguinte** (continuidade entre meses e anos).

---

## Cenários de captação

A série `tempDia` controla o número de **horas por dia** de captação, mês a mês.  
Exemplos comuns:
- **24/0**: meses com captação contínua e meses sem captação.
- **21 h/dia**: limite operacional em parte do ano.
- **Cenários por ano**: informe `tempDia` com 12 × anos itens.

---

## Validações e mensagens

- O programa valida tamanhos das séries:
  - `12` itens (repetidos por `anos`) **ou** `12 × anos` itens.
- Erros comuns:
  - **Tamanho incorreto** (nem 12 nem 12 × anos).
  - `Meses` diferente de 12.
  - `anos` inválido (não inteiro ≥ 1).
- **Aviso (warning)** ao console:
  - `Q_defluente` presente **com tamanho inválido** → o programa **recalcula** como 20% de Qmmm.

---

## Boas práticas e dicas

- **Unidades**
  - `Qmmm` e `Q_defluente`: **m³/s**.
  - `Evaporacao`: **mm/mês**.
  - `M_Infiltration`: **m/dia**.
  - `Tot_Area`: **m²**.
  - `Q_Cap`: **L/s** (convertido internamente p/ **m³/h**).
- **Arredondamento**  
  Apenas a **saída estilo planilha** arredonda (0 casas). A **saída bruta** mantém precisão.
- **Conferência**  
  Para bater com planilhas existentes, garanta:
  - `Q_defluente` coerente com o cenário (ou deixe o cálculo em 20% de Qmmm).
  - As mesmas séries de `Qmmm`, `Evaporacao`, `Dias` e `tempDia`.

---

## Perguntas frequentes

**1) Posso simular 10 anos usando os mesmos 12 meses?**  
Sim. Defina `"anos": 10` e forneça séries de **12** valores; o programa repete automaticamente.

**2) Preciso informar `Q_defluente`?**  
Não. Se não informar, o programa calcula **20% de `Qmmm`** (mês a mês).

**3) Como diferencio captação por ano?**  
Informe `tempDia` com **12 × anos** valores (por exemplo, 24 h/dia no Ano 1, 0 h/dia no Ano 2, 21 h/dia no Ano 3).

**4) Por que a minha planilha não bateu com o programa?**  
As diferenças mais comuns são:  
- **`Q_defluente`** (ex.: 0,06 vs 0,066).  
- **Arredondamento** na exibição.  
- **Cenário de captação** (24h/0h/21h) diferente entre planilha e JSON.

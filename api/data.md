# API - Estrutura de Dados

Este documento descreve os objetos de dados utilizados na API.

## Objeto: `Dam_data`

Representa os dados da barragem.

*   `Max_Volume` (m³): Volume máximo da barragem.
    *   *Fonte: Dado do usuário (deve vir do pedido de outorga).*
*   `Min_Volume` (m³): Volume mínimo da barragem.
    *   *Fonte: Dado do usuário (deve vir do pedido de outorga).*
*   `Tot_Area` (m²): Área total da barragem.
    *   *Fonte: Dado do usuário (deve vir do pedido de outorga).*
*   `M_Infiltration` (m³/s): Taxa de infiltração constante.
*   `Q_Cap` (L/s): Captação da barragem.
    *   *Fonte: Dado do usuário (deve vir do pedido de outorga).*

## Objeto: `Operacao`

Representa os parâmetros da operação de simulação.

*   `anos` (inteiro): Quantidade de anos de simulação.
    *   *Interface: Caixa de seleção, máximo 10.*
*   `meses` (array de strings): Nomes dos 12 meses do ano.
*   `Qmmm` (L/s): Dados de vazão da unidade hidrográfica (QREFERÊNCIA-SEÇÃO Regionalizada).
*   `Q_defluente` (L/s): Vazão de saída da barragem, calculada como 20% da vazão de entrada (`Qmmm * 0.2`).
*   `Dias` (inteiro): Quantidade de dias de captação por mês.
*   `Evaporacao` (mm/mês): Evaporação da barragem.
*   `tempDia` (horas): Tempo de captação diária.

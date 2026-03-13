import { readFile } from "fs/promises";

//
// Utilitários
//
const round0 = (x) => Math.round(x);
const clampVolume = (v, maxVol) => (v < 0 ? 0 : v > maxVol ? maxVol : v);

/**
 * Repete um array base 12 vezes por 'anos' (ou valida se já está expandido).
 * - Se arr.length === 12         -> repete 'anos' vezes
 * - Se arr.length === 12*anos    -> usa como está
 * - Caso contrário               -> lança erro explicativo
 */
function expand12(arr, anos, nome) {
  if (!Array.isArray(arr)) throw new Error(`'${nome}' deve ser um array.`);
  if (arr.length === 12 * anos) return arr.slice();
  if (arr.length === 12) {
    const out = [];
    for (let k = 0; k < anos; k++) out.push(...arr);
    return out;
  }
  throw new Error(
    `'${nome}' deve ter 12 itens (será repetido por ${anos} anos) ` +
      `ou ${12 * anos} itens (um por mês em ${anos} anos). Tamanho atual: ${arr.length}`
  );
}

/**
 * Retorna Q_defluente (m³/s) mês a mês:
 * - Se vier no JSON (12 ou 12*anos), usa.
 * - Caso contrário, calcula como 20% de Qmmm.
 */
function obterQdef(operacao, anos, qmmm) {
  const pct = 0.20; // 20%
  const qdefBruto = operacao.Q_defluente;

  if (!qdefBruto) {
    // Ausente -> calcular 20% de Qmmm
    return qmmm.map((v) => v * pct);
  }

  // Se presente, validar tamanho; se tamanho inválido, recalcular a partir de Qmmm
  const tam = qdefBruto.length;
  if (tam === 12 || tam === 12 * anos) {
    return expand12(qdefBruto, anos, "Q_defluente");
  } else {
    console.warn(
      `[AVISO] 'Q_defluente' presente mas com ${tam} itens (esperado 12 ou ${12 * anos}). ` +
      `Será recalculado como 20% de Qmmm.`
    );
    return qmmm.map((v) => v * pct);
  }
}

//
// Carregar api/data.json
//
async function carregarDados() {
  const raw = await readFile("./api/data.json", "utf8");
  const { dam_data, operacao } = JSON.parse(raw);

  const anos = Number(operacao?.anos ?? 1);
  if (!Number.isInteger(anos) || anos <= 0) {
    throw new Error(`'operacao.anos' inválido: ${operacao.anos}. Use um inteiro >= 1.`);
  }

  return { dam_data, operacao, anos };
}

//
// Processamento
//
async function processar() {
  const { dam_data, operacao, anos } = await carregarDados();

  // ——— Base
  const mesesBase = operacao.Meses;
  if (!Array.isArray(mesesBase) || mesesBase.length !== 12) {
    throw new Error(`'Meses' deve ter exatamente 12 itens.`);
  }
  const mesesRotulados = [];
  for (let a = 1; a <= anos; a++) {
    for (let i = 0; i < 12; i++) mesesRotulados.push(`${mesesBase[i]} - Ano ${a}`);
  }

  const dias  = expand12(operacao.Dias, anos, "Dias");
  const qmmm  = expand12(operacao.Qmmm, anos, "Qmmm"); // <<< renomeado
  const evap  = expand12(operacao.Evaporacao, anos, "Evaporacao");
  const temp  = expand12(operacao.tempDia, anos, "tempDia");
  const qdefS = obterQdef(operacao, anos, qmmm);       // pode vir do JSON ou 20% de Qmmm

  // ——— Parâmetros
  const area       = dam_data.Tot_Area;              // m²
  const infilDia_m = dam_data.M_Infiltration;        // m/dia
  const Qcap_Ls    = dam_data.Q_Cap;                 // L/s
  const maxVol     = dam_data.Max_Volume;            // m³

  // ——— Cálculos por mês
  const entrada_media = qmmm.map((q, i) => q * dias[i] * 86400);     // m³/mês
  const qdef_mes      = qdefS.map((q, i) => q * dias[i] * 86400);    // m³/mês
  const evaporacao_m3 = evap.map((mm) => mm * (area / 1000));        // m³/mês
  const infiltracao   = dias.map((d) => infilDia_m * d * area);      // m³/mês

  const tempMes   = temp.map((h, i) => h * dias[i]);                 // h/mês
  const qcap_m3h  = (Qcap_Ls * 3600) / 1000;                         // m³/h
  const qcap_total= tempMes.map((t) => t * qcap_m3h);                // m³/mês

  // ——— Volumes (com regra da "2ª passada")
  let vol_temp = maxVol;
  const volProv = [];
  const volFinal = [];
  const CHECK = [];

  for (let i = 0; i < dias.length; i++) {
    const saidaTotal = qdef_mes[i] + infiltracao[i] + evaporacao_m3[i] + qcap_total[i];

    // 1ª passada (pode ser negativa)
    const vprov = vol_temp + entrada_media[i] - saidaTotal;
    volProv.push(vprov);

    // CHECK (igual à planilha)
    CHECK.push(saidaTotal > vol_temp + entrada_media[i] ? "PROBLEMA" : "OK");

    // 2ª passada (sem perdas se vprov < 0)
    let vfinal = vprov;
    if (vprov < 0) {
      vfinal = vol_temp + entrada_media[i] - (qdef_mes[i] + qcap_total[i]);
    }

    vol_temp = clampVolume(vfinal, maxVol);
    volFinal.push(vol_temp);
  }

  // ——— SAÍDA 1 — estilo planilha
  const tabelaPlanilha = mesesRotulados.map((mes, i) => ({
    Mes: mes,
    Qmmm_m3s: qmmm[i],
    Dias: dias[i],
    Entrada_m3_mes: round0(entrada_media[i]),
    Q_Remanescente_m3_mes: round0(qdef_mes[i]),
    Infiltracao_m3_mes: round0(infiltracao[i]),
    Evaporacao_m3_mes: round0(evaporacao_m3[i]),
    Captacao_m3_mes: round0(qcap_total[i]),
    Vol_Prov: round0(volProv[i]),
    Vol_Final: round0(volFinal[i]),
    CHECK: CHECK[i]
  }));

  // ——— SAÍDA 2 — bruta (para API/depuração)
  const resposta = {
    meses: mesesRotulados,
    descarga: qdef_mes,
    entrada_media,
    evaporacao_m3,
    infiltracao,
    qcap_total,
    volume_final: volFinal,
    volume_prob: volProv,
    CHECK
  };

  console.log(`\n===== SAÍDA PLANILHA (${operacao.anos ?? 1} ano(s)) =====\n`);
  console.log(JSON.stringify(tabelaPlanilha, null, 2));

  console.log(`\n===== SAÍDA BRUTA (${operacao.anos ?? 1} ano(s)) =====\n`);
  console.log(JSON.stringify(resposta, null, 2));
}

processar().catch((err) => console.error("Erro:", err));
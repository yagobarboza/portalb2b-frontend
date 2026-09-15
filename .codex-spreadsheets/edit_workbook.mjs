import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/dellg15/Desktop/Colunas CTS 2026_terminar.xlsx";
const outputDir = "C:/Users/dellg15/Documents/Projetos/portalb2b-frontend/outputs/01a0a5e0-091d-7071-ba07-fa83bc9c1508";
const outputPath = `${outputDir}/Colunas CTS 2026_corrigido.xlsx`;
const previewPath = `${outputDir}/Sheet1_A75-K95_validacao.png`;
const targetRows = [77, 78, 79, 80, 81, 83, 85, 89, 90, 92, 93];

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Sheet1");

const originalValues = JSON.parse(JSON.stringify(sheet.getRange("A1:K95").values));
const originalFormulas = JSON.parse(JSON.stringify(sheet.getRange("A1:K95").formulas));

const names = sheet.getRange("A1:A95").values.flat();
const rowByName = new Map();
for (let i = 0; i < names.length; i += 1) {
  if (typeof names[i] === "string" && names[i]) rowByName.set(names[i], i + 1);
}

function originGroups(metric) {
  const row = rowByName.get(metric);
  if (!row) throw new Error(`Origem não localizada para ${metric}`);
  return sheet
    .getRange(`B${row}:J${row}`)
    .values[0]
    .filter((value) => typeof value === "string" && value.trim() !== "");
}

function prefixGroup(metric, group) {
  return String(group)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${metric} ← ${line}`)
    .join("\n");
}

function nestedGroups(metric) {
  return originGroups(metric).map((group) => prefixGroup(metric, group));
}

function prefixGroups(metric, groups) {
  return groups.map((group) => prefixGroup(metric, group));
}

function combinedNested(metric) {
  const lines = nestedGroups(metric).flatMap((group) => group.split("\n"));
  return [...new Set(lines)].join("\n");
}

function writeRow(row, origins, rule) {
  if (origins.length > 9) throw new Error(`Mais de nove origens na linha ${row}`);
  const cells = [...origins, ...Array(9 - origins.length).fill(null), rule];
  sheet.getRange(`B${row}:K${row}`).values = [cells];
}

const receitaLiquidaOrigins = [
  ...nestedGroups("VALOR_RECEITA_BRUTA"),
  ...nestedGroups("VALOR_TRIBUTO_SOBRE_VENDA"),
  ...nestedGroups("VALOR_DEVOLUCOES_ABATIMENTO"),
];

writeRow(
  77,
  receitaLiquidaOrigins,
  "Soma: VALOR_RECEITA_BRUTA + VALOR_TRIBUTO_SOBRE_VENDA + VALOR_DEVOLUCOES_ABATIMENTO; verificar regra de sinais.",
);

writeRow(
  78,
  [
    combinedNested("VALOR_ICMS_ST"),
    combinedNested("VALOR_IPI"),
    combinedNested("VALOR_FCP"),
    combinedNested("VALOR_ICMS"),
    combinedNested("VALOR_ICMS_DIFAL"),
    combinedNested("VALOR_FECOMP"),
    combinedNested("VALOR_CUSTO_BONIFICACAO"),
  ],
  "Soma: VALOR_ICMS_ST + VALOR_IPI + VALOR_FCP + VALOR_ICMS + VALOR_ICMS_DIFAL + VALOR_FECOMP + VALOR_CUSTO_BONIFICACAO.",
);

writeRow(
  79,
  [
    ...prefixGroups("VALOR_RECEITA_LIQUIDA", receitaLiquidaOrigins),
    ...nestedGroups("VALOR_CUSTOS_VENDA"),
  ],
  "Soma: VALOR_RECEITA_LIQUIDA + VALOR_CUSTOS_VENDA.",
);

writeRow(
  80,
  prefixGroups("VALOR_RECEITA_LIQUIDA", receitaLiquidaOrigins),
  "Agregação: soma de VALOR_RECEITA_LIQUIDA por ANO_MES.",
);

writeRow(
  81,
  [
    "VALOR_RECEITA_LIQUIDA_MES_NF ← VALOR_RECEITA_LIQUIDA\nAGRUPAMENTO ← ANO_MES + NUMERO_NOTA_FISCAL",
    "VALOR_RECEITA_LIQUIDA_MES_TOTAL ← VALOR_RECEITA_LIQUIDA\nAGRUPAMENTO ← ANO_MES",
  ],
  "Divisão: VALOR_RECEITA_LIQUIDA_MES_NF ÷ VALOR_RECEITA_LIQUIDA_MES_TOTAL; numerador agregado por ANO_MES e NUMERO_NOTA_FISCAL.",
);

writeRow(
  83,
  [
    "VALOR_PROVISAO_DEVOLUCAO_MES ← DW.FAT_RAZAO_CONTABIL.VARIACAO",
    "VALOR_PROVISAO_DEVOLUCAO_MES ← DW.FAT_RAZAO_CONTABIL.NUMERO_CONTA = '3.2.1.01.18'",
    "PERCENTUAL_PARTICIPACAO_MES_NF ← VALOR_RECEITA_LIQUIDA_MES_NF ← VALOR_RECEITA_LIQUIDA (agregação por ANO_MES e NUMERO_NOTA_FISCAL)",
    "PERCENTUAL_PARTICIPACAO_MES_NF ← VALOR_RECEITA_LIQUIDA_MES_TOTAL ← VALOR_RECEITA_LIQUIDA (agregação por ANO_MES)",
  ],
  "Multiplicação: VALOR_PROVISAO_DEVOLUCAO_MES × PERCENTUAL_PARTICIPACAO_MES_NF.",
);

writeRow(
  85,
  [
    "VALOR_CUSTO_PROVISAO_DEVOLUCAO_MES ← DW.FAT_RAZAO_CONTABIL.VARIACAO",
    "VALOR_CUSTO_PROVISAO_DEVOLUCAO_MES ← DW.FAT_RAZAO_CONTABIL.NUMERO_CONTA = '3.3.1.01.18'",
    "PERCENTUAL_PARTICIPACAO_MES_NF ← VALOR_RECEITA_LIQUIDA_MES_NF ← VALOR_RECEITA_LIQUIDA (agregação por ANO_MES e NUMERO_NOTA_FISCAL)",
    "PERCENTUAL_PARTICIPACAO_MES_NF ← VALOR_RECEITA_LIQUIDA_MES_TOTAL ← VALOR_RECEITA_LIQUIDA (agregação por ANO_MES)",
  ],
  "Multiplicação: VALOR_CUSTO_PROVISAO_DEVOLUCAO_MES × PERCENTUAL_PARTICIPACAO_MES_NF.",
);

writeRow(
  89,
  [
    combinedNested("VALOR_FATURAMENTO_BRUTO_SEM_IPI"),
    combinedNested("VALOR_FRETE_DESTAQUE"),
    combinedNested("VALOR_PERCENTUAL_COMISSAO"),
  ],
  "(VALOR_FATURAMENTO_BRUTO_SEM_IPI + VALOR_FRETE_DESTAQUE) × VALOR_PERCENTUAL_COMISSAO.",
);

writeRow(
  90,
  prefixGroups("VALOR_RECEITA_LIQUIDA", receitaLiquidaOrigins),
  "CASE WHEN VALOR_RECEITA_LIQUIDA < 0 THEN 'DEVOLUÇÃO' ELSE 'VENDA' END.",
);

writeRow(
  92,
  originGroups("VALOR_CUSTO_BONIFICACAO"),
  "Multiplicação: VALOR_CUSTO_UNITARIO × QUANTIDADE_ITEM_FATURADO.",
);

writeRow(
  93,
  [
    combinedNested("VALOR_CUSTO_BONIFICACAO").replaceAll("VALOR_CUSTO_BONIFICACAO", "VALOR_CUSTO_TOTAL_BONIFICACAO"),
    combinedNested("VALOR_ICMS_ST"),
    combinedNested("VALOR_IPI"),
    combinedNested("VALOR_FCP"),
    combinedNested("VALOR_ICMS"),
    combinedNested("VALOR_ICMS_DIFAL"),
    combinedNested("VALOR_FECOMP"),
    combinedNested("VALOR_PIS"),
    combinedNested("VALOR_COFINS"),
  ],
  "Soma: VALOR_CUSTO_TOTAL_BONIFICACAO + VALOR_ICMS_ST + VALOR_IPI + VALOR_FCP + VALOR_ICMS + VALOR_ICMS_DIFAL + VALOR_FECOMP + VALOR_PIS + VALOR_COFINS.",
);

for (const row of targetRows) {
  sheet.getRange(`A${row}:K${row}`).format.autofitRows();
}

const finalValues = sheet.getRange("A1:K95").values;
const finalFormulas = sheet.getRange("A1:K95").formulas;
const unexpectedChanges = [];
for (let r = 0; r < originalValues.length; r += 1) {
  for (let c = 0; c < originalValues[r].length; c += 1) {
    const excelRow = r + 1;
    const allowed = targetRows.includes(excelRow) && c >= 1 && c <= 10;
    if (!allowed && JSON.stringify(originalValues[r][c]) !== JSON.stringify(finalValues[r][c])) {
      unexpectedChanges.push({ row: excelRow, col: c + 1, before: originalValues[r][c], after: finalValues[r][c] });
    }
    if (JSON.stringify(originalFormulas[r][c]) !== JSON.stringify(finalFormulas[r][c])) {
      unexpectedChanges.push({ row: excelRow, col: c + 1, formulaBefore: originalFormulas[r][c], formulaAfter: finalFormulas[r][c] });
    }
  }
}
if (unexpectedChanges.length) {
  throw new Error(`Alterações fora do escopo: ${JSON.stringify(unexpectedChanges.slice(0, 20))}`);
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const savedInput = await FileBlob.load(outputPath);
const savedWorkbook = await SpreadsheetFile.importXlsx(savedInput);
const savedSheet = savedWorkbook.worksheets.getItem("Sheet1");

const check = await savedWorkbook.inspect({
  kind: "table",
  range: "Sheet1!A75:K95",
  include: "values,formulas",
  tableMaxRows: 21,
  tableMaxCols: 11,
  tableMaxCellChars: 180,
  maxChars: 20000,
});
console.log("FINAL_TARGET_CHECK");
console.log(check.ndjson);

const errors = await savedWorkbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("FORMULA_ERROR_SCAN");
console.log(errors.ndjson);

const savedSummary = await savedWorkbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 4000,
  tableMaxRows: 2,
  tableMaxCols: 11,
});
console.log("SAVED_SUMMARY");
console.log(savedSummary.ndjson);

const preview = await savedWorkbook.render({
  sheetName: "Sheet1",
  range: "A75:K95",
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

console.log(`OUTPUT_PATH=${outputPath}`);
console.log(`PREVIEW_PATH=${previewPath}`);
console.log(`TARGET_ROWS=${targetRows.join(",")}`);
console.log(`SAVED_TARGET_ROWS=${targetRows.map((row) => savedSheet.getRange(`A${row}`).values[0][0]).join("|")}`);

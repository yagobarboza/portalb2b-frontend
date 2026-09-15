import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/dellg15/Desktop/Colunas CTS 2026_terminar.xlsx";
const previewDir = "C:/Users/dellg15/Documents/Projetos/portalb2b-frontend/.codex-spreadsheets/previews-before";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,drawing,definedName",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
});
console.log("WORKBOOK_SUMMARY");
console.log(summary.ndjson);

await fs.mkdir(previewDir, { recursive: true });

for (let i = 0; i < workbook.worksheets.items.length; i += 1) {
  const sheet = workbook.worksheets.getItemAt(i);
  console.log(`SHEET_${i + 1}_NAME=${sheet.name}`);

  const region = await workbook.inspect({
    kind: "region",
    sheetId: sheet.name,
    range: "A1:AZ110",
    maxChars: 24000,
    tableMaxRows: 110,
    tableMaxCols: 52,
    tableMaxCellChars: 160,
  });
  console.log(`REGION_${i + 1}`);
  console.log(region.ndjson);

  const formulas = await workbook.inspect({
    kind: "formula",
    sheetId: sheet.name,
    range: "A1:AZ110",
    maxChars: 12000,
    options: { maxResults: 300 },
  });
  console.log(`FORMULAS_${i + 1}`);
  console.log(formulas.ndjson);

  const safeName = sheet.name.replace(/[\\/:*?"<>|]/g, "_");
  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1.5,
    format: "png",
  });
  await fs.writeFile(`${previewDir}/${String(i + 1).padStart(2, "0")}-${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

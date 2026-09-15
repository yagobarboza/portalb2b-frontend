import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("C:/Users/dellg15/Desktop/Colunas CTS 2026_terminar.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Sheet1");

const rows = [14, 15, 16, 17, 19, 22, 23, 24, 25, 27, 28, 29, 31, 32, 33, 34, 62, 63, 64, 67, 77, 78, 79, 80, 81, 82, 83, 84, 85, 88, 89, 90, 92, 93];
for (const row of rows) {
  const range = sheet.getRange(`A${row}:K${row}`);
  console.log(JSON.stringify({ row, values: range.values, formulas: range.formulas }));
}

const styles = await workbook.inspect({
  kind: "computedStyle",
  sheetId: "Sheet1",
  range: "A75:K95",
  maxChars: 12000,
});
console.log("TARGET_STYLES");
console.log(styles.ndjson);

const preview = await workbook.render({
  sheetName: "Sheet1",
  range: "A75:K95",
  scale: 2,
  format: "png",
});
await fs.writeFile(
  "C:/Users/dellg15/Documents/Projetos/portalb2b-frontend/.codex-spreadsheets/previews-before/Sheet1-A75-K95.png",
  new Uint8Array(await preview.arrayBuffer()),
);

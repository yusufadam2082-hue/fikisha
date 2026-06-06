const fs = require("fs");
const path = require("path");

const workspace = process.cwd();
const txtPath = path.join(workspace, "docs", "Fikisha_App_Overview.txt");
const pdfPath = path.join(workspace, "docs", "Fikisha_App_Overview.pdf");

const text = fs.readFileSync(txtPath, "utf8").replace(/\r\n/g, "\n");
const lines = text.split("\n");

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

let y = 800;
const x = 50;
const lineHeight = 14;
const commands = ["BT", "/F1 11 Tf", "1 0 0 1 0 0 Tm"];

for (const raw of lines) {
  if (y < 50) break;
  const line = esc(raw);
  commands.push(`1 0 0 1 ${x} ${y} Tm (${line}) Tj`);
  y -= lineHeight;
}
commands.push("ET");

const contentStream = commands.join("\n") + "\n";

const objects = [];
objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`);

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const obj of objects) {
  offsets.push(Buffer.byteLength(pdf, "utf8"));
  pdf += obj;
}

const xrefStart = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i <= objects.length; i++) {
  const off = String(offsets[i]).padStart(10, "0");
  pdf += `${off} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

fs.writeFileSync(pdfPath, pdf, "binary");
console.log(pdfPath);

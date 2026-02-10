#!/usr/bin/env node
// Renault Preisdaten Vergleich - PLAIN Version (ohne Farben)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEILE_CODE = {
  " ": "Normal",
  "1": "Austauschbar mit",
  "2": "Wird ersetzt durch",
  "3": "Nicht mehr lieferbar",
  "4": "Gesperrt, später lieferbar"
};

function parseRecord(line) {
  const c = line.split(";");
  if (c.length < 23) return null;
  return {
    teilenr: c[6]?.trim(),
    teileCode: c[7]?.trim(),
    austauschNr: c[8]?.trim(),
    bez1: c[9]?.trim(),
    upeCent: parseInt(c[11], 10) || 0,
    rabattGruppe: c[15]?.trim(),
    familie: (c[21]?.trim() || "") + (c[22]?.trim() || ""),
    datum: c[2]
  };
}

function parseFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim() && l.startsWith("RDAGTK"));
  return lines.map(parseRecord).filter(Boolean);
}

function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(6,8)}.${dateStr.slice(4,6)}.${dateStr.slice(0,4)}`;
}

function compare(todayRecords, yesterdayRecords) {
  const todayMap = new Map(todayRecords.map(r => [r.teilenr, r]));
  const yesterdayMap = new Map(yesterdayRecords.map(r => [r.teilenr, r]));

  const result = {
    newArticles: [],
    deletedArticles: [],
    priceChanges: [],
    familyChanges: [],
    statusChanges: [],
    todayCount: todayRecords.length,
    yesterdayCount: yesterdayRecords.length,
    todayDate: todayRecords[0]?.datum,
    yesterdayDate: yesterdayRecords[0]?.datum
  };

  for (const [nr, today] of todayMap) {
    const yesterday = yesterdayMap.get(nr);
    if (!yesterday) {
      result.newArticles.push(today);
    } else {
      if (today.upeCent !== yesterday.upeCent) {
        result.priceChanges.push({
          ...today,
          oldPrice: yesterday.upeCent,
          newPrice: today.upeCent,
          diff: today.upeCent - yesterday.upeCent,
          diffPct: ((today.upeCent - yesterday.upeCent) / yesterday.upeCent * 100).toFixed(1)
        });
      }
      if (today.familie !== yesterday.familie) {
        result.familyChanges.push({
          ...today,
          oldFamily: yesterday.familie,
          newFamily: today.familie
        });
      }
      if (today.teileCode !== yesterday.teileCode) {
        result.statusChanges.push({
          ...today,
          oldStatus: yesterday.teileCode,
          newStatus: today.teileCode,
          oldStatusText: TEILE_CODE[yesterday.teileCode] || yesterday.teileCode,
          newStatusText: TEILE_CODE[today.teileCode] || today.teileCode
        });
      }
    }
  }

  for (const [nr, yesterday] of yesterdayMap) {
    if (!todayMap.has(nr)) {
      result.deletedArticles.push(yesterday);
    }
  }

  return result;
}

function generateHTML(comp) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #999; padding-bottom: 4px; }
    .summary { margin: 16px 0; padding: 12px; border: 1px solid #ccc; }
    .summary span { margin-right: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th, td { padding: 6px 8px; text-align: left; border: 1px solid #ccc; }
    th { background: #f0f0f0; font-weight: bold; }
    .mono { font-family: Consolas, Monaco, monospace; }
    .right { text-align: right; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; }
  </style>
</head>
<body>
  <h1>Renault Preisänderungen</h1>
  <p>Vergleich: ${formatDate(comp.yesterdayDate)} → ${formatDate(comp.todayDate)} | ${comp.todayCount.toLocaleString()} Artikel</p>
  
  <div class="summary">
    <span><strong>${comp.newArticles.length}</strong> Neue Artikel</span>
    <span><strong>${comp.deletedArticles.length}</strong> Gelöscht</span>
    <span><strong>${comp.priceChanges.length}</strong> Preisänderungen</span>
    <span><strong>${comp.statusChanges.length}</strong> Status</span>
    <span><strong>${comp.familyChanges.length}</strong> Familie</span>
  </div>

  ${comp.priceChanges.length > 0 ? `
  <h2>Preisänderungen (${comp.priceChanges.length})</h2>
  <table>
    <tr><th>Teilenr.</th><th>Bezeichnung</th><th class="right">Alter Preis</th><th class="right">Neuer Preis</th><th class="right">Änderung</th></tr>
    ${comp.priceChanges.slice(0, 50).map(p => `
    <tr>
      <td class="mono">${p.teilenr}</td>
      <td>${p.bez1}</td>
      <td class="right">${formatPrice(p.oldPrice)}</td>
      <td class="right">${formatPrice(p.newPrice)}</td>
      <td class="right">${p.diff > 0 ? '+' : ''}${formatPrice(p.diff)} (${p.diff > 0 ? '+' : ''}${p.diffPct}%)</td>
    </tr>
    `).join('')}
  </table>
  ${comp.priceChanges.length > 50 ? `<p>... und ${comp.priceChanges.length - 50} weitere</p>` : ''}
  ` : ''}

  ${comp.statusChanges.length > 0 ? `
  <h2>Statusänderungen (${comp.statusChanges.length})</h2>
  <table>
    <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Alter Status</th><th>Neuer Status</th><th>Ersatz-Nr.</th></tr>
    ${comp.statusChanges.slice(0, 50).map(s => `
    <tr>
      <td class="mono">${s.teilenr}</td>
      <td>${s.bez1}</td>
      <td>${s.oldStatusText}</td>
      <td>${s.newStatusText}</td>
      <td class="mono">${s.austauschNr || '-'}</td>
    </tr>
    `).join('')}
  </table>
  ${comp.statusChanges.length > 50 ? `<p>... und ${comp.statusChanges.length - 50} weitere</p>` : ''}
  ` : ''}

  ${comp.newArticles.length > 0 ? `
  <h2>Neue Artikel (${comp.newArticles.length})</h2>
  <table>
    <tr><th>Teilenr.</th><th>Bezeichnung</th><th class="right">Preis</th><th>Familie</th><th>Status</th><th>Ersatz-Nr.</th></tr>
    ${comp.newArticles.slice(0, 50).map(a => `
    <tr>
      <td class="mono">${a.teilenr}</td>
      <td>${a.bez1}</td>
      <td class="right">${formatPrice(a.upeCent)}</td>
      <td>${a.familie}</td>
      <td>${a.teileCode && a.teileCode !== ' ' ? TEILE_CODE[a.teileCode] : 'Normal'}</td>
      <td class="mono">${a.austauschNr || '-'}</td>
    </tr>
    `).join('')}
  </table>
  ${comp.newArticles.length > 50 ? `<p>... und ${comp.newArticles.length - 50} weitere</p>` : ''}
  ` : ''}

  ${comp.familyChanges.length > 0 ? `
  <h2>Familienänderungen (${comp.familyChanges.length})</h2>
  <table>
    <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Alte Familie</th><th>Neue Familie</th></tr>
    ${comp.familyChanges.slice(0, 50).map(f => `
    <tr>
      <td class="mono">${f.teilenr}</td>
      <td>${f.bez1}</td>
      <td>${f.oldFamily}</td>
      <td>${f.newFamily}</td>
    </tr>
    `).join('')}
  </table>
  ${comp.familyChanges.length > 50 ? `<p>... und ${comp.familyChanges.length - 50} weitere</p>` : ''}
  ` : ''}

  ${comp.deletedArticles.length > 0 ? `
  <h2>Gelöschte Artikel (${comp.deletedArticles.length})</h2>
  <table>
    <tr><th>Teilenr.</th><th>Bezeichnung</th><th class="right">Letzter Preis</th><th>Familie</th></tr>
    ${comp.deletedArticles.slice(0, 50).map(a => `
    <tr>
      <td class="mono">${a.teilenr}</td>
      <td>${a.bez1}</td>
      <td class="right">${formatPrice(a.upeCent)}</td>
      <td>${a.familie}</td>
    </tr>
    `).join('')}
  </table>
  ${comp.deletedArticles.length > 50 ? `<p>... und ${comp.deletedArticles.length - 50} weitere</p>` : ''}
  ` : ''}

  <div class="footer">
    Generiert am ${new Date().toLocaleString('de-DE')} | Renault Tool V3
  </div>
</body>
</html>`;
}

function generateCSV(comp) {
  let csv = "Typ;Teilenummer;Bezeichnung;Detail1;Detail2;Detail3\n";
  
  for (const a of comp.newArticles) {
    const status = a.teileCode && a.teileCode !== ' ' ? `${TEILE_CODE[a.teileCode]} ${a.austauschNr || ''}` : '';
    csv += `NEU;${a.teilenr};${a.bez1};${formatPrice(a.upeCent)};${a.familie};${status}\n`;
  }
  for (const a of comp.deletedArticles) {
    csv += `GELÖSCHT;${a.teilenr};${a.bez1};${formatPrice(a.upeCent)};${a.familie};\n`;
  }
  for (const p of comp.priceChanges) {
    csv += `PREIS;${p.teilenr};${p.bez1};${formatPrice(p.oldPrice)} → ${formatPrice(p.newPrice)};${p.diffPct}%;\n`;
  }
  for (const f of comp.familyChanges) {
    csv += `FAMILIE;${f.teilenr};${f.bez1};${f.oldFamily} → ${f.newFamily};;\n`;
  }
  for (const s of comp.statusChanges) {
    csv += `STATUS;${s.teilenr};${s.bez1};${s.oldStatusText} → ${s.newStatusText};${s.austauschNr || ''};\n`;
  }
  
  return csv;
}

// Main
const [,, todayFile, yesterdayFile, reportDir] = process.argv;

if (!todayFile || !yesterdayFile) {
  console.error("Usage: compare-plain.js <today-file> <yesterday-file> [report-dir]");
  process.exit(1);
}

console.log("Parsing files...");
const todayRecords = parseFile(todayFile);
const yesterdayRecords = parseFile(yesterdayFile);

console.log(`Today: ${todayRecords.length} records`);
console.log(`Yesterday: ${yesterdayRecords.length} records`);

console.log("Comparing...");
const comp = compare(todayRecords, yesterdayRecords);

console.log(`New: ${comp.newArticles.length}`);
console.log(`Deleted: ${comp.deletedArticles.length}`);
console.log(`Price changes: ${comp.priceChanges.length}`);
console.log(`Family changes: ${comp.familyChanges.length}`);
console.log(`Status changes: ${comp.statusChanges.length}`);

// Generate reports
const outputDir = reportDir || '.';
const dateStr = new Date().toISOString().slice(0,10);
const htmlFile = path.join(outputDir, `renault-report-plain-${dateStr}.html`);
const csvFile = path.join(outputDir, `renault-report-plain-${dateStr}.csv`);

fs.writeFileSync(htmlFile, generateHTML(comp));
fs.writeFileSync(csvFile, generateCSV(comp));

console.log(`Reports saved to ${outputDir}`);

// Send email via AppleScript
const subject = `Renault Änderungen ${formatDate(comp.todayDate)}: ${comp.newArticles.length} neu, ${comp.priceChanges.length} Preise, ${comp.statusChanges.length} Status`;

const applescript = `
tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"${subject}", visible:false}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"martin@s-a-z.com"}
        set html content to (read POSIX file "${htmlFile}")
        make new attachment with properties {file name:POSIX file "${csvFile}"} at after the last paragraph
        send
    end tell
end tell
`;

try {
  execSync(`osascript -e '${applescript.replace(/'/g, "'\"'\"'")}'`);
  console.log("Email sent!");
} catch (e) {
  console.error("Email error:", e.message);
  console.log("Report ready at:", htmlFile);
}

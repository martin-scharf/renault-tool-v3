#!/usr/bin/env node
// Renault Preisdaten Vergleich & Email Report
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
  const priceUp = comp.priceChanges.filter(p => p.diff > 0);
  const priceDown = comp.priceChanges.filter(p => p.diff < 0);
  
  // Status color mapping
  const statusColors = {
    "Normal": { bg: "#f0fdf4", color: "#166534" },
    "Austauschbar mit": { bg: "#fef3c7", color: "#b45309" },
    "Wird ersetzt durch": { bg: "#fee2e2", color: "#dc2626" },
    "Nicht mehr lieferbar": { bg: "#fecaca", color: "#991b1b" },
    "Gesperrt, später lieferbar": { bg: "#e0e7ff", color: "#4338ca" }
  };
  
  const getStatusStyle = (status) => {
    const c = statusColors[status] || { bg: "#f1f5f9", color: "#475569" };
    return `background:${c.bg};color:${c.color}`;
  };
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1e293b; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .stat-new .stat-value { color: #3b82f6; }
    .stat-del .stat-value { color: #f97316; }
    .stat-price .stat-value { color: #8b5cf6; }
    .stat-status .stat-value { color: #0891b2; }
    .stat-fam .stat-value { color: #84cc16; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; color: #334155; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; }
    .price-up { background: #fef2f2; }
    .price-down { background: #f0fdf4; }
    .price-val-up { color: #dc2626; font-weight: 700; }
    .price-val-down { color: #16a34a; font-weight: 700; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .badge-orange { background: #ffedd5; color: #c2410c; }
    .badge-purple { background: #f3e8ff; color: #7c3aed; }
    .badge-cyan { background: #cffafe; color: #0891b2; }
    .mono { font-family: "SF Mono", Monaco, monospace; font-size: 11px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
    .arrow { font-weight: bold; color: #94a3b8; margin: 0 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚗 Renault Preisänderungen</h1>
    <p class="subtitle">
      Vergleich: ${formatDate(comp.yesterdayDate)} → ${formatDate(comp.todayDate)} | 
      ${comp.todayCount.toLocaleString()} Artikel
    </p>
    
    <div class="stats">
      <div class="stat stat-new">
        <div class="stat-value">${comp.newArticles.length}</div>
        <div class="stat-label">Neue Artikel</div>
      </div>
      <div class="stat stat-del">
        <div class="stat-value">${comp.deletedArticles.length}</div>
        <div class="stat-label">Gelöscht</div>
      </div>
      <div class="stat stat-price">
        <div class="stat-value">${comp.priceChanges.length}</div>
        <div class="stat-label">Preisänderungen</div>
      </div>
      <div class="stat stat-status">
        <div class="stat-value">${comp.statusChanges.length}</div>
        <div class="stat-label">Status</div>
      </div>
      <div class="stat stat-fam">
        <div class="stat-value">${comp.familyChanges.length}</div>
        <div class="stat-label">Familie</div>
      </div>
    </div>

    ${comp.priceChanges.length > 0 ? `
    <div class="section">
      <h2>💰 Preisänderungen (${comp.priceChanges.length})</h2>
      <table>
        <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Alter Preis</th><th></th><th>Neuer Preis</th><th>Änderung</th></tr>
        ${comp.priceChanges.slice(0, 50).map(p => `
        <tr class="${p.diff > 0 ? 'price-up' : 'price-down'}">
          <td class="mono">${p.teilenr}</td>
          <td>${p.bez1}</td>
          <td>${formatPrice(p.oldPrice)}</td>
          <td class="arrow">→</td>
          <td><strong>${formatPrice(p.newPrice)}</strong></td>
          <td class="${p.diff > 0 ? 'price-val-up' : 'price-val-down'}">${p.diff > 0 ? '+' : ''}${formatPrice(p.diff)} (${p.diff > 0 ? '+' : ''}${p.diffPct}%)</td>
        </tr>
        `).join('')}
      </table>
      ${comp.priceChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.priceChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.statusChanges.length > 0 ? `
    <div class="section">
      <h2>🔄 Statusänderungen (${comp.statusChanges.length})</h2>
      <table>
        <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Alter Status</th><th></th><th>Neuer Status</th><th>Ersatz-Nr.</th></tr>
        ${comp.statusChanges.slice(0, 50).map(s => `
        <tr>
          <td class="mono">${s.teilenr}</td>
          <td>${s.bez1}</td>
          <td><span class="badge" style="${getStatusStyle(s.oldStatusText)}">${s.oldStatusText}</span></td>
          <td class="arrow">→</td>
          <td><span class="badge" style="${getStatusStyle(s.newStatusText)}">${s.newStatusText}</span></td>
          <td class="mono" style="${s.austauschNr ? 'color:#dc2626;font-weight:600' : ''}">${s.austauschNr || '-'}</td>
        </tr>
        `).join('')}
      </table>
      ${comp.statusChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.statusChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.newArticles.length > 0 ? `
    <div class="section">
      <h2>🆕 Neue Artikel (${comp.newArticles.length})</h2>
      <table>
        <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Preis</th><th>Familie</th><th>Status</th><th>Ersatz-Nr.</th></tr>
        ${comp.newArticles.slice(0, 50).map(a => `
        <tr style="background:#f0f9ff">
          <td class="mono" style="color:#2563eb;font-weight:600">${a.teilenr}</td>
          <td>${a.bez1}</td>
          <td>${formatPrice(a.upeCent)}</td>
          <td><span class="badge badge-blue">${a.familie}</span></td>
          <td>${a.teileCode && a.teileCode !== ' ' ? `<span class="badge" style="${getStatusStyle(TEILE_CODE[a.teileCode])}">${TEILE_CODE[a.teileCode]}</span>` : '<span class="badge badge-green">Normal</span>'}</td>
          <td class="mono" style="${a.austauschNr ? 'color:#dc2626;font-weight:600' : ''}">${a.austauschNr || '-'}</td>
        </tr>
        `).join('')}
      </table>
      ${comp.newArticles.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.newArticles.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.familyChanges.length > 0 ? `
    <div class="section">
      <h2>👨‍👩‍👧 Familienänderungen (${comp.familyChanges.length})</h2>
      <table>
        <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Alte Familie</th><th></th><th>Neue Familie</th></tr>
        ${comp.familyChanges.slice(0, 50).map(f => `
        <tr style="background:#fefce8">
          <td class="mono">${f.teilenr}</td>
          <td>${f.bez1}</td>
          <td><span class="badge badge-purple">${f.oldFamily}</span></td>
          <td class="arrow">→</td>
          <td><span class="badge badge-cyan">${f.newFamily}</span></td>
        </tr>
        `).join('')}
      </table>
      ${comp.familyChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.familyChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.deletedArticles.length > 0 ? `
    <div class="section">
      <h2>🗑️ Gelöschte Artikel (${comp.deletedArticles.length})</h2>
      <table>
        <tr><th>Teilenr.</th><th>Bezeichnung</th><th>Letzter Preis</th><th>Familie</th></tr>
        ${comp.deletedArticles.slice(0, 50).map(a => `
        <tr style="background:#fef2f2">
          <td class="mono" style="color:#dc2626;font-weight:600">${a.teilenr}</td>
          <td style="color:#991b1b">${a.bez1}</td>
          <td>${formatPrice(a.upeCent)}</td>
          <td><span class="badge badge-orange">${a.familie}</span></td>
        </tr>
        `).join('')}
      </table>
      ${comp.deletedArticles.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.deletedArticles.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    <div class="footer">
      Automatisch generiert am ${new Date().toLocaleString('de-DE')} | Renault Tool V3
    </div>
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
  console.error("Usage: compare.js <today-file> <yesterday-file> [report-dir]");
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
const htmlFile = path.join(outputDir, `renault-report-${dateStr}.html`);
const csvFile = path.join(outputDir, `renault-report-${dateStr}.csv`);

fs.writeFileSync(htmlFile, generateHTML(comp));
fs.writeFileSync(csvFile, generateCSV(comp));

console.log(`Reports saved to ${outputDir}`);

// Send email via AppleScript
const subject = `Renault Preisänderungen ${formatDate(comp.todayDate)}: ${comp.newArticles.length} neu, ${comp.priceChanges.length} Preise, ${comp.statusChanges.length} Status`;

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
  // Fallback: just log
  console.log("Report ready at:", htmlFile);
}

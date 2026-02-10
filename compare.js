#!/usr/bin/env node
// Renault Preisdaten Vergleich & Email Report - MIT INLINE STYLES für Email
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

// Status-Farben als inline styles
const statusColors = {
  "Normal": { bg: "#d1fae5", color: "#065f46" },
  "Austauschbar mit": { bg: "#fef3c7", color: "#92400e" },
  "Wird ersetzt durch": { bg: "#fee2e2", color: "#991b1b" },
  "Nicht mehr lieferbar": { bg: "#fecaca", color: "#7f1d1d" },
  "Gesperrt, später lieferbar": { bg: "#e0e7ff", color: "#3730a3" }
};

function getStatusBadge(status) {
  const c = statusColors[status] || { bg: "#f1f5f9", color: "#475569" };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color}">${status}</span>`;
}

function generateHTML(comp) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:20px;margin:0;">
  <div style="max-width:900px;margin:0 auto;background:white;border-radius:12px;padding:24px;">
    <h1 style="color:#1e293b;font-size:24px;margin:0 0 8px 0;">Renault Preisänderungen</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px 0;">
      Vergleich: ${formatDate(comp.yesterdayDate)} → ${formatDate(comp.todayDate)} | 
      ${comp.todayCount.toLocaleString()} Artikel
    </p>
    
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;width:20%;">
          <div style="font-size:28px;font-weight:700;color:#3b82f6;">${comp.newArticles.length}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Neue Artikel</div>
        </td>
        <td style="width:4px;"></td>
        <td style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;width:20%;">
          <div style="font-size:28px;font-weight:700;color:#f97316;">${comp.deletedArticles.length}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Gelöscht</div>
        </td>
        <td style="width:4px;"></td>
        <td style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;width:20%;">
          <div style="font-size:28px;font-weight:700;color:#8b5cf6;">${comp.priceChanges.length}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Preisänderungen</div>
        </td>
        <td style="width:4px;"></td>
        <td style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;width:20%;">
          <div style="font-size:28px;font-weight:700;color:#0891b2;">${comp.statusChanges.length}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Status</div>
        </td>
        <td style="width:4px;"></td>
        <td style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;width:20%;">
          <div style="font-size:28px;font-weight:700;color:#84cc16;">${comp.familyChanges.length}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Familie</div>
        </td>
      </tr>
    </table>

    ${comp.priceChanges.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;color:#334155;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Preisänderungen (${comp.priceChanges.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Teilenr.</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Alter Preis</th>
          <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;"></th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Neuer Preis</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Änderung</th>
        </tr>
        ${comp.priceChanges.slice(0, 50).map(p => `
        <tr style="background:${p.diff > 0 ? '#fef2f2' : '#f0fdf4'};">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;">${p.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${p.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPrice(p.oldPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">→</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatPrice(p.newPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:${p.diff > 0 ? '#dc2626' : '#16a34a'};">${p.diff > 0 ? '+' : ''}${formatPrice(p.diff)} (${p.diff > 0 ? '+' : ''}${p.diffPct}%)</td>
        </tr>
        `).join('')}
      </table>
      ${comp.priceChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.priceChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.statusChanges.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;color:#334155;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Statusänderungen (${comp.statusChanges.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Teilenr.</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Alter Status</th>
          <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;"></th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Neuer Status</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Ersatz-Nr.</th>
        </tr>
        ${comp.statusChanges.slice(0, 50).map(s => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;">${s.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${s.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${getStatusBadge(s.oldStatusText)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">→</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${getStatusBadge(s.newStatusText)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;${s.austauschNr ? 'color:#dc2626;font-weight:600;' : ''}">${s.austauschNr || '-'}</td>
        </tr>
        `).join('')}
      </table>
      ${comp.statusChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.statusChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.newArticles.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;color:#334155;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Neue Artikel (${comp.newArticles.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Teilenr.</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Preis</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Familie</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Status</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Ersatz-Nr.</th>
        </tr>
        ${comp.newArticles.slice(0, 50).map(a => `
        <tr style="background:#eff6ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;color:#2563eb;font-weight:600;">${a.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${a.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPrice(a.upeCent)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#dbeafe;color:#1d4ed8;">${a.familie}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${a.teileCode && a.teileCode !== ' ' ? getStatusBadge(TEILE_CODE[a.teileCode]) : getStatusBadge('Normal')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;${a.austauschNr ? 'color:#dc2626;font-weight:600;' : ''}">${a.austauschNr || '-'}</td>
        </tr>
        `).join('')}
      </table>
      ${comp.newArticles.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.newArticles.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.familyChanges.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;color:#334155;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Familienänderungen (${comp.familyChanges.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Teilenr.</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Alte Familie</th>
          <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;"></th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Neue Familie</th>
        </tr>
        ${comp.familyChanges.slice(0, 50).map(f => `
        <tr style="background:#fefce8;">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;">${f.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${f.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#f3e8ff;color:#7c3aed;">${f.oldFamily}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">→</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#cffafe;color:#0891b2;">${f.newFamily}</span></td>
        </tr>
        `).join('')}
      </table>
      ${comp.familyChanges.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.familyChanges.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    ${comp.deletedArticles.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;color:#334155;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Gelöschte Artikel (${comp.deletedArticles.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Teilenr.</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Letzter Preis</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-weight:600;font-size:10px;">Familie</th>
        </tr>
        ${comp.deletedArticles.slice(0, 50).map(a => `
        <tr style="background:#fef2f2;">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;color:#dc2626;font-weight:600;">${a.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#991b1b;">${a.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPrice(a.upeCent)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#ffedd5;color:#c2410c;">${a.familie}</span></td>
        </tr>
        `).join('')}
      </table>
      ${comp.deletedArticles.length > 50 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.deletedArticles.length - 50} weitere</p>` : ''}
    </div>
    ` : ''}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center;">
      Generiert am ${new Date().toLocaleString('de-DE')} | Renault Tool V3
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
  console.log("Report ready at:", htmlFile);
}

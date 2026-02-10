#!/usr/bin/env node
// Renault Preisdaten Vergleich - Excel Report mit Farben
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { execSync } = require('child_process');

const TEILE_CODE = {
  " ": "Normal",
  "1": "Austauschbar mit",
  "2": "Wird ersetzt durch",
  "3": "Nicht mehr lieferbar",
  "4": "Gesperrt, später lieferbar"
};

// Farben
const COLORS = {
  green: { bg: '90EE90', font: '006400' },      // Normal / Preissenkung
  yellow: { bg: 'FFFF00', font: '8B8000' },     // Austauschbar
  red: { bg: 'FF6B6B', font: '8B0000' },        // Ersetzt / Nicht lieferbar / Preiserhöhung
  purple: { bg: 'DDA0DD', font: '4B0082' },     // Gesperrt
  blue: { bg: 'ADD8E6', font: '00008B' },       // Neue Artikel
  header: { bg: '4472C4', font: 'FFFFFF' }      // Header
};

const STATUS_COLORS = {
  "Normal": COLORS.green,
  "Austauschbar mit": COLORS.yellow,
  "Wird ersetzt durch": COLORS.red,
  "Nicht mehr lieferbar": COLORS.red,
  "Gesperrt, später lieferbar": COLORS.purple
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
  return cents / 100;
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

function styleHeader(row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header.bg } };
    cell.font = { bold: true, color: { argb: COLORS.header.font } };
    cell.alignment = { horizontal: 'center' };
  });
}

function styleRow(row, color) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
  });
}

function styleCell(cell, color) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
  cell.font = { color: { argb: color.font }, bold: true };
}

async function generateExcel(comp, outputPath) {
  const workbook = new ExcelJS.Workbook();
  
  // === Übersicht ===
  const overview = workbook.addWorksheet('Übersicht');
  overview.columns = [
    { header: 'Kategorie', key: 'cat', width: 25 },
    { header: 'Anzahl', key: 'count', width: 15 }
  ];
  styleHeader(overview.getRow(1));
  overview.addRow({ cat: 'Artikel gesamt', count: comp.todayCount });
  overview.addRow({ cat: 'Neue Artikel', count: comp.newArticles.length });
  overview.addRow({ cat: 'Gelöschte Artikel', count: comp.deletedArticles.length });
  overview.addRow({ cat: 'Preisänderungen', count: comp.priceChanges.length });
  overview.addRow({ cat: 'Statusänderungen', count: comp.statusChanges.length });
  overview.addRow({ cat: 'Familienänderungen', count: comp.familyChanges.length });
  overview.addRow({ cat: '', count: '' });
  overview.addRow({ cat: 'Vergleich', count: `${formatDate(comp.yesterdayDate)} → ${formatDate(comp.todayDate)}` });

  // === Preisänderungen ===
  if (comp.priceChanges.length > 0) {
    const sheet = workbook.addWorksheet('Preisänderungen');
    sheet.columns = [
      { header: 'Teilenummer', key: 'nr', width: 15 },
      { header: 'Bezeichnung', key: 'bez', width: 30 },
      { header: 'Alter Preis', key: 'old', width: 12 },
      { header: 'Neuer Preis', key: 'new', width: 12 },
      { header: 'Differenz €', key: 'diff', width: 12 },
      { header: 'Differenz %', key: 'pct', width: 12 }
    ];
    styleHeader(sheet.getRow(1));
    
    for (const p of comp.priceChanges) {
      const row = sheet.addRow({
        nr: p.teilenr,
        bez: p.bez1,
        old: formatPrice(p.oldPrice),
        new: formatPrice(p.newPrice),
        diff: formatPrice(p.diff),
        pct: parseFloat(p.diffPct)
      });
      
      // Rot wenn teurer, Grün wenn billiger
      const color = p.diff > 0 ? COLORS.red : COLORS.green;
      styleRow(row, color);
    }
    
    // Preis-Spalten als Währung formatieren
    sheet.getColumn('old').numFmt = '#,##0.00 €';
    sheet.getColumn('new').numFmt = '#,##0.00 €';
    sheet.getColumn('diff').numFmt = '+#,##0.00 €;-#,##0.00 €';
    sheet.getColumn('pct').numFmt = '+0.0%;-0.0%';
  }

  // === Statusänderungen ===
  if (comp.statusChanges.length > 0) {
    const sheet = workbook.addWorksheet('Statusänderungen');
    sheet.columns = [
      { header: 'Teilenummer', key: 'nr', width: 15 },
      { header: 'Bezeichnung', key: 'bez', width: 30 },
      { header: 'Alter Status', key: 'old', width: 25 },
      { header: 'Neuer Status', key: 'new', width: 25 },
      { header: 'Ersatz-Nr.', key: 'ersatz', width: 15 }
    ];
    styleHeader(sheet.getRow(1));
    
    for (const s of comp.statusChanges) {
      const row = sheet.addRow({
        nr: s.teilenr,
        bez: s.bez1,
        old: s.oldStatusText,
        new: s.newStatusText,
        ersatz: s.austauschNr || '-'
      });
      
      // Neuer Status bestimmt Farbe
      const color = STATUS_COLORS[s.newStatusText] || COLORS.green;
      styleRow(row, color);
      
      // Ersatz-Nr. in rot wenn vorhanden
      if (s.austauschNr) {
        const ersatzCell = row.getCell('ersatz');
        ersatzCell.font = { color: { argb: 'FF0000' }, bold: true };
      }
    }
  }

  // === Neue Artikel ===
  if (comp.newArticles.length > 0) {
    const sheet = workbook.addWorksheet('Neue Artikel');
    sheet.columns = [
      { header: 'Teilenummer', key: 'nr', width: 15 },
      { header: 'Bezeichnung', key: 'bez', width: 30 },
      { header: 'Preis', key: 'price', width: 12 },
      { header: 'Familie', key: 'fam', width: 10 },
      { header: 'Status', key: 'status', width: 25 },
      { header: 'Ersatz-Nr.', key: 'ersatz', width: 15 }
    ];
    styleHeader(sheet.getRow(1));
    
    for (const a of comp.newArticles) {
      const statusText = a.teileCode && a.teileCode !== ' ' ? TEILE_CODE[a.teileCode] : 'Normal';
      const row = sheet.addRow({
        nr: a.teilenr,
        bez: a.bez1,
        price: formatPrice(a.upeCent),
        fam: a.familie,
        status: statusText,
        ersatz: a.austauschNr || '-'
      });
      
      // Blau hinterlegt für neue Artikel
      styleRow(row, COLORS.blue);
      
      // Ersatz-Nr. in rot wenn vorhanden
      if (a.austauschNr) {
        const ersatzCell = row.getCell('ersatz');
        ersatzCell.font = { color: { argb: 'FF0000' }, bold: true };
      }
    }
    
    sheet.getColumn('price').numFmt = '#,##0.00 €';
  }

  // === Gelöschte Artikel ===
  if (comp.deletedArticles.length > 0) {
    const sheet = workbook.addWorksheet('Gelöschte Artikel');
    sheet.columns = [
      { header: 'Teilenummer', key: 'nr', width: 15 },
      { header: 'Bezeichnung', key: 'bez', width: 30 },
      { header: 'Letzter Preis', key: 'price', width: 12 },
      { header: 'Familie', key: 'fam', width: 10 }
    ];
    styleHeader(sheet.getRow(1));
    
    for (const a of comp.deletedArticles) {
      const row = sheet.addRow({
        nr: a.teilenr,
        bez: a.bez1,
        price: formatPrice(a.upeCent),
        fam: a.familie
      });
      
      // Rot hinterlegt für gelöschte
      styleRow(row, COLORS.red);
    }
    
    sheet.getColumn('price').numFmt = '#,##0.00 €';
  }

  // === Familienänderungen ===
  if (comp.familyChanges.length > 0) {
    const sheet = workbook.addWorksheet('Familienänderungen');
    sheet.columns = [
      { header: 'Teilenummer', key: 'nr', width: 15 },
      { header: 'Bezeichnung', key: 'bez', width: 30 },
      { header: 'Alte Familie', key: 'old', width: 12 },
      { header: 'Neue Familie', key: 'new', width: 12 }
    ];
    styleHeader(sheet.getRow(1));
    
    for (const f of comp.familyChanges) {
      const row = sheet.addRow({
        nr: f.teilenr,
        bez: f.bez1,
        old: f.oldFamily,
        new: f.newFamily
      });
      styleRow(row, COLORS.yellow);
    }
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel saved: ${outputPath}`);
}

// Main
async function main() {
  const [,, todayFile, yesterdayFile, reportDir] = process.argv;

  if (!todayFile || !yesterdayFile) {
    console.error("Usage: compare-excel.js <today-file> <yesterday-file> [report-dir]");
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

  const outputDir = reportDir || '.';
  const dateStr = new Date().toISOString().slice(0,10);
  const excelFile = path.join(outputDir, `renault-report-${dateStr}.xlsx`);

  await generateExcel(comp, excelFile);

  // Send email via AppleScript
  const subject = `Renault Preisänderungen ${formatDate(comp.todayDate)}: ${comp.newArticles.length} neu, ${comp.priceChanges.length} Preise, ${comp.statusChanges.length} Status`;

  const applescript = `
tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:"${subject}", visible:false}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"martin@s-a-z.com"}
        set content to "Renault Preisänderungen - Excel-Datei im Anhang.

Farbkodierung:
• Preisänderungen: Grün = billiger, Rot = teurer
• Status: Grün = Normal, Gelb = Austauschbar, Rot = Ersetzt/Nicht lieferbar, Lila = Gesperrt
• Neue Artikel: Blau hinterlegt
• Gelöschte: Rot hinterlegt
• Ersatz-Nr. in rot markiert"
    end tell
    tell content of newMessage
        make new attachment with properties {file name:"${excelFile}"} at after last paragraph
    end tell
    send newMessage
end tell
`;

  try {
    execSync(`osascript -e '${applescript.replace(/'/g, "'\"'\"'")}'`);
    console.log("Email sent!");
  } catch (e) {
    console.error("Email error:", e.message);
    console.log("Excel ready at:", excelFile);
  }
}

main().catch(console.error);

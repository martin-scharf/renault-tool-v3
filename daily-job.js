#!/usr/bin/env node
// Renault Täglicher Job - Vergleich + Preislisten generieren
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

const DLNR = "7455";
const YEARS = [2025, 2026, 2027];

// Rabatte aus V2
const FAMILIES = {
  "002E":{2025:{vk:0,ek:66},2026:{vk:0,ek:67.4},2027:{vk:0,ek:67.4}},
  "002K":{2025:{vk:5,ek:55},2026:{vk:0,ek:0},2027:{vk:5,ek:0}},
  "027E":{2025:{vk:49,ek:53},2026:{vk:49,ek:54.6},2027:{vk:49,ek:54.6}},
  "111U":{2025:{vk:53,ek:57},2026:{vk:53,ek:54.6},2027:{vk:53,ek:54.6}},
  "114U":{2025:{vk:64,ek:69},2026:{vk:64,ek:68.2},2027:{vk:64,ek:68.2}},
  "116U":{2025:{vk:55,ek:59.2},2026:{vk:55,ek:61.5},2027:{vk:55,ek:61.5}},
  "126C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:27.9},2027:{vk:18.3,ek:27.9}},
  "135U":{2025:{vk:55.6,ek:59.7},2026:{vk:55.6,ek:61.3},2027:{vk:55.6,ek:61.3}},
  "147C":{2025:{vk:52.1,ek:60.3},2026:{vk:52.1,ek:60.4},2027:{vk:52.1,ek:60.4}},
  "150M":{2025:{vk:22.2,ek:26.5},2026:{vk:22.2,ek:32},2027:{vk:22.2,ek:32}},
  "151E":{2025:{vk:53,ek:57},2026:{vk:53,ek:58},2027:{vk:53,ek:58}},
  "200C":{2025:{vk:48.8,ek:56.9},2026:{vk:48.8,ek:57.1},2027:{vk:48.8,ek:57.1}},
  "201C":{2025:{vk:45.3,ek:53.5},2026:{vk:45.3,ek:53.8},2027:{vk:45.3,ek:53.8}},
  "203C":{2025:{vk:48.8,ek:56.9},2026:{vk:48.8,ek:57.1},2027:{vk:48.8,ek:57.1}},
  "204C":{2025:{vk:48.1,ek:56.3},2026:{vk:48.1,ek:59.1},2027:{vk:48.1,ek:59.1}},
  "271M":{2025:{vk:47,ek:53},2026:{vk:47,ek:43},2027:{vk:47,ek:43}},
  "282C":{2025:{vk:48.8,ek:56.9},2026:{vk:48.8,ek:57.1},2027:{vk:48.8,ek:57.1}},
  "284C":{2025:{vk:48.85,ek:56.9},2026:{vk:48.85,ek:57.1},2027:{vk:48.85,ek:57.1}},
  "289C":{2025:{vk:33.6,ek:41.8},2026:{vk:33.6,ek:50.2},2027:{vk:33.6,ek:50.2}},
  "338C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:27.6},2027:{vk:18.3,ek:27.6}},
  "341C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:27.6},2027:{vk:18.3,ek:27.6}},
  "346C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:29.9},2027:{vk:18.3,ek:29.9}},
  "352E":{2025:{vk:55.6,ek:60.7},2026:{vk:55.6,ek:63.5},2027:{vk:55.6,ek:63.5}},
  "416C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:32},2027:{vk:18.3,ek:32}},
  "471C":{2025:{vk:18.3,ek:26.5},2026:{vk:18.3,ek:27.9},2027:{vk:18.3,ek:27.9}},
  "481E":{2025:{vk:58.6,ek:62.8},2026:{vk:58.6,ek:64.9},2027:{vk:58.6,ek:64.9}},
  "501E":{2025:{vk:62,ek:66},2026:{vk:62,ek:65.8},2027:{vk:62,ek:65.8}},
  "502E":{2025:{vk:60,ek:64},2026:{vk:60,ek:68.2},2027:{vk:60,ek:68.2}},
  "503E":{2025:{vk:56,ek:60},2026:{vk:56,ek:64.8},2027:{vk:56,ek:64.8}},
  "510M":{2025:{vk:45,ek:51},2026:{vk:45,ek:50.7},2027:{vk:45,ek:50.7}},
  "513E":{2025:{vk:61.6,ek:65.7},2026:{vk:61.6,ek:67.7},2027:{vk:61.6,ek:67.7}},
  "520E":{2025:{vk:64,ek:68.1},2026:{vk:64,ek:72.9},2027:{vk:64,ek:72.9}},
  "554E":{2025:{vk:56.6,ek:60.7},2026:{vk:56.6,ek:61.1},2027:{vk:56.6,ek:61.1}},
  "559M":{2025:{vk:42,ek:48},2026:{vk:42,ek:48.2},2027:{vk:42,ek:48.2}},
  "565M":{2025:{vk:55,ek:59.3},2026:{vk:55,ek:60.8},2027:{vk:55,ek:60.8}},
  "573M":{2025:{vk:42,ek:48},2026:{vk:42,ek:48.2},2027:{vk:42,ek:48.2}},
  "576U":{2025:{vk:48,ek:54},2026:{vk:48,ek:53.9},2027:{vk:48,ek:53.9}},
  "581E":{2025:{vk:64,ek:68.1},2026:{vk:64,ek:70.5},2027:{vk:64,ek:70.5}},
  "591C":{2025:{vk:30,ek:38.4},2026:{vk:30,ek:43.7},2027:{vk:30,ek:43.7}},
  "601U":{2025:{vk:62,ek:66},2026:{vk:62,ek:59.3},2027:{vk:62,ek:59.3}},
  "616C":{2025:{vk:48.8,ek:57},2026:{vk:48.8,ek:60.8},2027:{vk:48.8,ek:60.8}},
  "631U":{2025:{vk:48.6,ek:52.8},2026:{vk:48.6,ek:54.6},2027:{vk:48.6,ek:54.6}},
  "632C":{2025:{vk:47,ek:55.4},2026:{vk:47,ek:59.1},2027:{vk:47,ek:59.1}},
  "633C":{2025:{vk:47,ek:55.4},2026:{vk:47,ek:59.1},2027:{vk:47,ek:59.1}},
  "634C":{2025:{vk:53,ek:61},2026:{vk:53,ek:61.7},2027:{vk:53,ek:61.7}},
  "642M":{2025:{vk:40,ek:46},2026:{vk:40,ek:45},2027:{vk:40,ek:45}},
  "646C":{2025:{vk:39.6,ek:47.7},2026:{vk:39.6,ek:53},2027:{vk:39.6,ek:53}},
  "651C":{2025:{vk:30,ek:38.4},2026:{vk:30,ek:43.7},2027:{vk:30,ek:43.7}},
  "658E":{2025:{vk:69,ek:73},2026:{vk:69,ek:72.9},2027:{vk:69,ek:72.9}},
  "674E":{2025:{vk:61.6,ek:65.6},2026:{vk:61.6,ek:72.9},2027:{vk:61.6,ek:72.9}},
  "696M":{2025:{vk:18,ek:22.2},2026:{vk:18,ek:27.8},2027:{vk:18,ek:27.8}},
  "803U":{2025:{vk:64.6,ek:68.8},2026:{vk:64.6,ek:69.4},2027:{vk:64.6,ek:69.4}},
  "807U":{2025:{vk:65.7,ek:69.9},2026:{vk:65.7,ek:70.2},2027:{vk:65.7,ek:70.2}},
  "811U":{2025:{vk:37.4,ek:41.5},2026:{vk:37.4,ek:43.1},2027:{vk:37.4,ek:43.1}},
  "812U":{2025:{vk:60,ek:64},2026:{vk:60,ek:63.8},2027:{vk:60,ek:63.8}},
  "820U":{2025:{vk:55.8,ek:59.9},2026:{vk:55.8,ek:62.1},2027:{vk:55.8,ek:62.1}},
  "861C":{2025:{vk:51,ek:59.3},2026:{vk:51,ek:60.8},2027:{vk:51,ek:60.8}},
  "864C":{2025:{vk:49,ek:57.4},2026:{vk:49,ek:58.7},2027:{vk:49,ek:58.7}},
  "871C":{2025:{vk:32.7,ek:39.8},2026:{vk:32.7,ek:39.8},2027:{vk:32.7,ek:39.8}},
  "890C":{2025:{vk:22.6,ek:30.6},2026:{vk:22.6,ek:32},2027:{vk:22.6,ek:32}},
  "901C":{2025:{vk:53,ek:60},2026:{vk:53,ek:60.4},2027:{vk:53,ek:60.4}},
  "918M":{2025:{vk:45,ek:51},2026:{vk:45,ek:52.2},2027:{vk:45,ek:52.2}},
  "925C":{2025:{vk:26.7,ek:34.8},2026:{vk:26.7,ek:27.9},2027:{vk:26.7,ek:27.9}},
};

// Aktuelles Jahr für Kalkulation
const ACTIVE_YEAR = 2026;

// === HELPER FUNCTIONS ===
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
    gewicht: parseInt(c[19], 10) || 0,
    datum: c[2]
  };
}

function parseFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim() && l.startsWith("RDAGTK"));
  return lines.map(parseRecord).filter(Boolean);
}

function formatPrice(cents) { return cents / 100; }
function formatPriceStr(cents) { return (cents / 100).toFixed(2).replace(".", ",") + " €"; }
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(6,8)}.${dateStr.slice(4,6)}.${dateStr.slice(0,4)}`;
}
function rnd(v) { return Math.round(v * 100 + Number.EPSILON) / 100; }

function getDisc(familie, yr) {
  const fam = FAMILIES[familie];
  if (!fam) return null;
  const yd = fam[yr];
  if (yd && (yd.vk > 0 || yd.ek > 0)) return { vk: yd.vk, ek: yd.ek };
  return null;
}

// === COMPARE FUNCTIONS ===
function compare(todayRecords, yesterdayRecords) {
  const todayMap = new Map(todayRecords.map(r => [r.teilenr, r]));
  const yesterdayMap = new Map(yesterdayRecords.map(r => [r.teilenr, r]));
  const result = { newArticles: [], deletedArticles: [], priceChanges: [], familyChanges: [], statusChanges: [] };

  for (const [nr, today] of todayMap) {
    const yesterday = yesterdayMap.get(nr);
    if (!yesterday) {
      result.newArticles.push(today);
    } else {
      if (today.upeCent !== yesterday.upeCent) {
        result.priceChanges.push({ ...today, oldPrice: yesterday.upeCent, newPrice: today.upeCent, diff: today.upeCent - yesterday.upeCent, diffPct: ((today.upeCent - yesterday.upeCent) / yesterday.upeCent * 100).toFixed(1) });
      }
      if (today.familie !== yesterday.familie) {
        result.familyChanges.push({ ...today, oldFamily: yesterday.familie, newFamily: today.familie });
      }
      if (today.teileCode !== yesterday.teileCode) {
        result.statusChanges.push({ ...today, oldStatus: yesterday.teileCode, newStatus: today.teileCode, oldStatusText: TEILE_CODE[yesterday.teileCode] || yesterday.teileCode, newStatusText: TEILE_CODE[today.teileCode] || today.teileCode });
      }
    }
  }
  for (const [nr, yesterday] of yesterdayMap) {
    if (!todayMap.has(nr)) result.deletedArticles.push(yesterday);
  }
  return result;
}

// === PREISLISTEN GENERIEREN (wie V2) ===
function generatePriceLists(records, yr) {
  const defLines = [];
  const extLines = [];
  let ok = 0, skip = 0, noDisc = 0;

  for (const r of records) {
    const d = getDisc(r.familie, yr);
    if (!d) { 
      if (!FAMILIES[r.familie]) skip++;
      else noDisc++;
      continue; 
    }

    const lp = r.upeCent / 100;
    const buyingPrice = rnd(lp * (100 - d.vk) / 100);
    const buyingPriceSelf = rnd(lp * (100 - d.ek) / 100);

    defLines.push(`${r.teilenr};${lp.toFixed(2)};${buyingPrice.toFixed(2)}`);
    extLines.push(`${r.teilenr};${lp.toFixed(2)};${buyingPrice.toFixed(2)};${buyingPriceSelf.toFixed(2)};${d.vk};${d.ek};${r.bez1};${r.gewicht};${DLNR}`);
    ok++;
  }

  return {
    defCSV: "article;list_price;buying_price\n" + defLines.join("\n"),
    extCSV: "article;list_price;buying_price;buying_price_self;discount;discount_self;description;weight;DLNR\n" + extLines.join("\n"),
    stats: { ok, skip, noDisc, total: records.length }
  };
}

// === EXCEL REPORT MIT FARBEN ===
const COLORS = {
  green: { bg: '90EE90', font: '006400' },
  yellow: { bg: 'FFFF00', font: '8B8000' },
  red: { bg: 'FF6B6B', font: '8B0000' },
  purple: { bg: 'DDA0DD', font: '4B0082' },
  blue: { bg: 'ADD8E6', font: '00008B' },
  header: { bg: '4472C4', font: 'FFFFFF' }
};

const STATUS_COLORS = {
  "Normal": COLORS.green,
  "Austauschbar mit": COLORS.yellow,
  "Wird ersetzt durch": COLORS.red,
  "Nicht mehr lieferbar": COLORS.red,
  "Gesperrt, später lieferbar": COLORS.purple
};

function styleHeader(row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header.bg } };
    cell.font = { bold: true, color: { argb: COLORS.header.font } };
  });
}
function styleRow(row, color) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
  });
}

// === HTML REPORT MIT FARBEN ===
function generateHTMLReport(comp, todayDate) {
  const statusColors = {
    "Normal": { bg: "#d1fae5", color: "#065f46" },
    "Austauschbar mit": { bg: "#fef3c7", color: "#92400e" },
    "Wird ersetzt durch": { bg: "#fee2e2", color: "#991b1b" },
    "Nicht mehr lieferbar": { bg: "#fecaca", color: "#7f1d1d" },
    "Gesperrt, später lieferbar": { bg: "#e0e7ff", color: "#3730a3" }
  };

  const getStatusBadge = (status) => {
    const c = statusColors[status] || { bg: "#f1f5f9", color: "#475569" };
    return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color}">${status}</span>`;
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Renault Preisänderungen ${formatDate(todayDate)}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:20px;margin:0;">
  <div style="max-width:900px;margin:0 auto;background:white;border-radius:12px;padding:24px;">
    <h1 style="color:#1e293b;font-size:24px;margin:0 0 8px 0;">Renault Preisänderungen</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px 0;">Stand: ${formatDate(todayDate)}</p>
    
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
        ${comp.priceChanges.slice(0, 100).map(p => `
        <tr style="background:${p.diff > 0 ? '#fef2f2' : '#f0fdf4'};">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;">${p.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${p.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPriceStr(p.oldPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">→</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatPriceStr(p.newPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:${p.diff > 0 ? '#dc2626' : '#16a34a'};">${p.diff > 0 ? '+' : ''}${formatPriceStr(p.diff)} (${p.diff > 0 ? '+' : ''}${p.diffPct}%)</td>
        </tr>
        `).join('')}
      </table>
      ${comp.priceChanges.length > 100 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.priceChanges.length - 100} weitere</p>` : ''}
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
        ${comp.statusChanges.slice(0, 100).map(s => `
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
      ${comp.statusChanges.length > 100 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.statusChanges.length - 100} weitere</p>` : ''}
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
        </tr>
        ${comp.newArticles.slice(0, 100).map(a => `
        <tr style="background:#eff6ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;color:#2563eb;font-weight:600;">${a.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${a.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPriceStr(a.upeCent)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#dbeafe;color:#1d4ed8;">${a.familie}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${a.teileCode && a.teileCode !== ' ' ? getStatusBadge(TEILE_CODE[a.teileCode]) : getStatusBadge('Normal')}</td>
        </tr>
        `).join('')}
      </table>
      ${comp.newArticles.length > 100 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.newArticles.length - 100} weitere</p>` : ''}
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
        ${comp.deletedArticles.slice(0, 100).map(a => `
        <tr style="background:#fef2f2;">
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:11px;color:#dc2626;font-weight:600;">${a.teilenr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#991b1b;">${a.bez1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatPriceStr(a.upeCent)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#ffedd5;color:#c2410c;">${a.familie}</span></td>
        </tr>
        `).join('')}
      </table>
      ${comp.deletedArticles.length > 100 ? `<p style="color:#64748b;font-size:11px;padding:8px;">... und ${comp.deletedArticles.length - 100} weitere</p>` : ''}
    </div>
    ` : ''}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center;">
      Generiert am ${new Date().toLocaleString('de-DE')} | Renault Tool V3
    </div>
  </div>
</body>
</html>`;
}

async function generateExcelReport(comp, todayDate, outputPath) {
  const workbook = new ExcelJS.Workbook();

  // Übersicht
  const overview = workbook.addWorksheet('Übersicht');
  overview.columns = [{ header: 'Kategorie', key: 'cat', width: 25 }, { header: 'Anzahl', key: 'count', width: 15 }];
  styleHeader(overview.getRow(1));
  overview.addRow({ cat: 'Neue Artikel', count: comp.newArticles.length });
  overview.addRow({ cat: 'Gelöschte Artikel', count: comp.deletedArticles.length });
  overview.addRow({ cat: 'Preisänderungen', count: comp.priceChanges.length });
  overview.addRow({ cat: 'Statusänderungen', count: comp.statusChanges.length });
  overview.addRow({ cat: 'Familienänderungen', count: comp.familyChanges.length });

  // Preisänderungen
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
      const row = sheet.addRow({ nr: p.teilenr, bez: p.bez1, old: formatPrice(p.oldPrice), new: formatPrice(p.newPrice), diff: formatPrice(p.diff), pct: parseFloat(p.diffPct) });
      styleRow(row, p.diff > 0 ? COLORS.red : COLORS.green);
    }
    sheet.getColumn('old').numFmt = '#,##0.00 €';
    sheet.getColumn('new').numFmt = '#,##0.00 €';
    sheet.getColumn('diff').numFmt = '+#,##0.00 €;-#,##0.00 €';
    sheet.getColumn('pct').numFmt = '+0.0%;-0.0%';
  }

  // Statusänderungen
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
      const row = sheet.addRow({ nr: s.teilenr, bez: s.bez1, old: s.oldStatusText, new: s.newStatusText, ersatz: s.austauschNr || '-' });
      styleRow(row, STATUS_COLORS[s.newStatusText] || COLORS.green);
      if (s.austauschNr) row.getCell('ersatz').font = { color: { argb: 'FF0000' }, bold: true };
    }
  }

  // Neue Artikel
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
      const row = sheet.addRow({ nr: a.teilenr, bez: a.bez1, price: formatPrice(a.upeCent), fam: a.familie, status: statusText, ersatz: a.austauschNr || '-' });
      styleRow(row, COLORS.blue);
      if (a.austauschNr) row.getCell('ersatz').font = { color: { argb: 'FF0000' }, bold: true };
    }
    sheet.getColumn('price').numFmt = '#,##0.00 €';
  }

  // Gelöschte
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
      const row = sheet.addRow({ nr: a.teilenr, bez: a.bez1, price: formatPrice(a.upeCent), fam: a.familie });
      styleRow(row, COLORS.red);
    }
    sheet.getColumn('price').numFmt = '#,##0.00 €';
  }

  await workbook.xlsx.writeFile(outputPath);
}

// === MAIN ===
async function main() {
  const DATA_DIR = '/Users/bot/Documents/renault-tool-v3/data';
  const REPORT_DIR = '/Users/bot/Documents/renault-tool-v3/reports';
  const dateStr = new Date().toISOString().slice(0, 10);

  // Find files
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('TLDRAGP_')).sort().reverse();
  if (files.length < 1) { console.log("Keine Dateien gefunden"); return; }

  const todayFile = path.join(DATA_DIR, files[0]);
  const yesterdayFile = files.length > 1 ? path.join(DATA_DIR, files[1]) : null;

  console.log(`Aktuelle Datei: ${files[0]}`);
  if (yesterdayFile) console.log(`Vergleichsdatei: ${files[1]}`);

  // Parse
  const todayRecords = parseFile(todayFile);
  const todayDate = todayRecords[0]?.datum;
  console.log(`${todayRecords.length.toLocaleString()} Artikel geladen`);

  // 1. Generate price lists
  console.log("\n=== Preislisten generieren ===");
  const priceLists = generatePriceLists(todayRecords, ACTIVE_YEAR);
  console.log(`Verarbeitet: ${priceLists.stats.ok.toLocaleString()} | Ohne Familie: ${priceLists.stats.skip.toLocaleString()} | Ohne Rabatt: ${priceLists.stats.noDisc.toLocaleString()}`);

  const priceFileCustomer = path.join(REPORT_DIR, `Preisdatei Renault.csv`);
  const priceFileCSS = path.join(REPORT_DIR, `Preisliste css Renault.csv`);
  fs.writeFileSync(priceFileCustomer, priceLists.defCSV);
  fs.writeFileSync(priceFileCSS, priceLists.extCSV);
  console.log(`✓ ${priceFileCustomer}`);
  console.log(`✓ ${priceFileCSS}`);

  // 2. Comparison report (if we have yesterday)
  let comp = null;
  let excelFile = null;
  if (yesterdayFile) {
    console.log("\n=== Vergleichsreport erstellen ===");
    const yesterdayRecords = parseFile(yesterdayFile);
    comp = compare(todayRecords, yesterdayRecords);
    console.log(`Neu: ${comp.newArticles.length} | Gelöscht: ${comp.deletedArticles.length} | Preise: ${comp.priceChanges.length} | Status: ${comp.statusChanges.length}`);

    excelFile = path.join(REPORT_DIR, `renault-vergleich-${dateStr}.xlsx`);
    await generateExcelReport(comp, todayDate, excelFile);
    console.log(`✓ ${excelFile}`);
    
    // HTML Report mit Farben
    const htmlFile = path.join(REPORT_DIR, `renault-vergleich-${dateStr}.html`);
    fs.writeFileSync(htmlFile, generateHTMLReport(comp, todayDate));
    console.log(`✓ ${htmlFile}`);
  }

  // 3. Send via Telegram
  console.log("\n=== Telegram senden ===");
  
  // Summary message
  let msg = `Renault Preislisten ${formatDate(todayDate)}\n\n`;
  msg += `📊 ${todayRecords.length.toLocaleString()} Artikel\n`;
  msg += `✓ ${priceLists.stats.ok.toLocaleString()} mit Rabatt kalkuliert\n`;
  if (comp) {
    msg += `\n🔄 Änderungen:\n`;
    msg += `• ${comp.newArticles.length} neue Artikel\n`;
    msg += `• ${comp.priceChanges.length} Preisänderungen\n`;
    msg += `• ${comp.statusChanges.length} Statusänderungen\n`;
  }

  // Use curl to send to Telegram via OpenClaw
  // (or you can integrate with OpenClaw's message API)
  
  console.log("\nZusammenfassung:");
  console.log(msg);
  console.log("\nDateien erstellt:");
  console.log(`- ${priceFileCustomer}`);
  console.log(`- ${priceFileCSS}`);
  if (excelFile) {
    console.log(`- ${excelFile}`);
    console.log(`- ${excelFile.replace('.xlsx', '.html')}`);
  }
}

main().catch(console.error);

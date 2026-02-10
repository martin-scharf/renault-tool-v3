# Renault Preisdatei - Kompletter Satzaufbau

## SFTP Server
- Host: transfer.oe.parts
- Port: 2022
- User: renault
- Dateiformat: TLDRAGP_YYYYMMDDHHMMSS (täglich neu, ~21MB, ~82.000 Zeilen)
- Trennzeichen: Semikolon (;)

---

## Satzart Teilesatz (RDAGTK)

### Header-Felder (1-40)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| 1-7 | A6+; | Satzart „RDAGTK" = Renault Deutschland AG Teilekatalog |
| 8-10 | N2+; | Versionsnummer des RDAGTK-Erstellungsprogramms {00, ..., 99} |
| 11-19 | N8+; | Erstellungsdatum der Datei im Format „JJJJMMTT" |
| 20-24 | N4+; | Erstellungszeit der Datei im Format „SSMM" |
| 25-32 | N7+; | Satzzähler, mit führenden Nullen |
| 33-40 | N7+; | Satzanzahl, mit führenden Nullen |

### Artikel-Stammdaten (41-100)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| **41-51** | A10+; | **Teilenummer**, eindeutiger Schlüssel |
| 52-53 | A1+; | **Teile-Code**: " "=normal, "1"=austauschbar, "2"=ersetzt, "3"=nicht lieferbar, "4"=gesperrt |
| 54-64 | A10+; | Austauschbare/ersetzende Teilenummer (bei Code 1/2) |
| 65-82 | A17+; | **Bezeichnung-1** |
| 83-100 | A17+; | Bezeichnung-2 (Ergänzung) |

### Preisdaten (101-124)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| **101-111** | N10+; | **UPE Brutto in Cent** (ohne MWSt) |
| 112-115 | A3+; | Währungskennzeichen {"EUR"} |
| 116-117 | N1+; | MwSt-Code: "1"=normal, "8"=Austauschteil |
| 118-119 | N1+; | Nettopreis-Code: "0"=mit Rabatt, "2"=ohne Rabatt, "3"=auf Anfrage |
| **120-122** | N2+; | **Rabattgruppe** (Code barème) {00-11} |
| 123-124 | A1+; | Primärnetz-Bonus (R1): {1,2}=bonifiziert, " "=sonstiges |

### Logistik-Daten (125-161)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| 125-135 | N10+; | Pfandwert in Cent (bei Austauschteilen) |
| 136-139 | N3+; | Verpackungseinheit (VPE) |
| 140-150 | N10+; | **Gewicht in Gramm** (0000001000 = 1kg) |
| 151-161 | N10+; | Volumen in m³ × 1.000.000 (0001000000 = 1m³) |

### Klassifikation (162-194)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| **162-165** | A3+; | **Teilefamilie** |
| 166-167 | A1+; | Segment {A-Z} |
| 168-169 | A1+; | Gängigkeitsschlüssel Top 3000 {Blank, A-F} |
| 170-174 | A4+; | Gängigkeitsschlüssel {Blank, 0001-3000} |
| 175-176 | N1+; | Hersteller-Code |
| 177-178 | N1+; | Herkunfts-Code |
| 179-180 | N1+; | Rückgabe-Code |
| 181-184 | N3+; | Werbungs-Code |
| 185-186 | A1+; | Renault-Minute-Teilegruppe {A-Z} |
| 187-188 | A1+; | Erlösart {A-Z} |
| 189-191 | A2+; | Fahrzeugtyp {AA-ZZ} |
| 192-194 | A2+; | Baugruppe {00-99} |

### Zusatzdaten (195-256)
| Stellen | Typ | Feldbezeichnung |
|---------|-----|-----------------|
| 195-196 | A1+; | Sekundärnetz-Bonus (R2): {1,2}=bonifiziert, " "=sonstiges |
| 197-207 | A10+; | Motrio-Teilenummer |
| 208-256 | A48+; | Leerfeld (zukünftige Verwendung) |

---

## Wichtige Felder für Auswertungen

| Feld | Stellen | Beschreibung |
|------|---------|--------------|
| **Teilenummer** | 41-51 | Eindeutiger Schlüssel |
| **Teile-Code** | 52-53 | Status (normal/ersetzt/gesperrt) |
| **UPE Cent** | 101-111 | Preis für Preisvergleich |
| **Rabattgruppe** | 120-122 | 00-11 für Rabattberechnung |
| **Teilefamilie** | 162-165 | Für Familienänderungen |

---

## Geplante Auswertungen

1. **Preisänderungen**: Feld 101-111 vergleichen (heute vs. gestern)
2. **Neue Artikel**: Teilenummern die gestern nicht existierten
3. **Gelöschte Artikel**: Teilenummern die heute fehlen
4. **Familienänderungen**: Feld 162-165 vergleichen
5. **Rabattgruppenänderungen**: Feld 120-122 vergleichen
6. **Statusänderungen**: Feld 52-53 vergleichen (gesperrt, ersetzt, etc.)

Quelle: SBR – Satzbeschreibung Renault (10.02.2026)

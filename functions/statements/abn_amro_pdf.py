"""ABN AMRO PDF 'Bij- en afschrijvingen' inlezen.

Opbouw van het afschrift:
- kop met Rekeninghouder, Priverekening, Periode, 'Saldo dd-mm-jjjj  € x' (begin en eind)
- tabel met kolommen Datum | Omschrijving | Bedrag af | Bedrag bij
- een transactie begint met een datum in de eerste kolom; de omschrijving
  loopt over meerdere regels door; het bedrag staat op de eerste regel
  in de kolom 'Bedrag af' of 'Bedrag bij'.
"""

from __future__ import annotations

import re
from datetime import datetime

import pdfplumber

from .descriptions import parse_description
from .model import ParsedStatement, Transaction

DATE_RE = re.compile(r"^\d{2}-\d{2}-\d{4}$")
AMOUNT_RE = re.compile(r"^-?\d{1,3}(?:\.\d{3})*,\d{2}$")
SALDO_RE = re.compile(r"Saldo\s+(\d{2}-\d{2}-\d{4})\s+€\s*(-?[\d.]+,\d{2})")
PERIOD_RE = re.compile(r"Periode\s+(\d{2}-\d{2}-\d{4})\s+t/m\s+(\d{2}-\d{2}-\d{4})")
FOOTER_WORDS = {"Totaal", "Aantal", "Saldo", "Nieuw", "Oud"}
TOTALS_RE = re.compile(r"Totaal afgeschreven\s+Totaal bijgeschreven\s+€\s*([\d.]+,\d{2})\s+€\s*([\d.]+,\d{2})")
ACCOUNT_RE = re.compile(r"(?:Priverekening|Rekening|Betaalrekening)\s+([\d.]{9,14}|[A-Z]{2}\d{2}[A-Z]{4}\d{10})")


def to_amount(text: str) -> float:
    return float(text.replace(".", "").replace(",", "."))


def to_iso(date: str) -> str:
    return datetime.strptime(date, "%d-%m-%Y").strftime("%Y-%m-%d")


def looks_like(first_page_text: str) -> bool:
    return "Bij- en afschrijvingen" in first_page_text and "Bedrag af" in first_page_text


def _lines(words: list[dict], tolerance: float = 3.0) -> list[list[dict]]:
    """Groepeert woorden op (ongeveer) dezelfde hoogte tot regels."""
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= tolerance:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: w["x0"]) for line in lines]


def parse(path: str) -> ParsedStatement:
    st = ParsedStatement(bank="ABN AMRO")
    current: dict | None = None
    rows: list[dict] = []

    with pdfplumber.open(path) as pdf:
        first_text = pdf.pages[0].extract_text() or ""
        saldi = SALDO_RE.findall(first_text)
        if len(saldi) >= 2:
            st.opening_balance = to_amount(saldi[0][1])
            st.closing_balance = to_amount(saldi[-1][1])
        if m := PERIOD_RE.search(first_text):
            st.period_from, st.period_to = to_iso(m.group(1)), to_iso(m.group(2))
        if m := ACCOUNT_RE.search(first_text):
            st.account = m.group(1)
        last_text = pdf.pages[-1].extract_text() or ""
        if m := TOTALS_RE.search(last_text):
            st.stated_debit, st.stated_credit = to_amount(m.group(1)), to_amount(m.group(2))

        for page in pdf.pages:
            words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
            lines = _lines(words)

            # Kolomposities uit de koptekst van de tabel halen.
            header_idx = None
            for i, line in enumerate(lines):
                texts = [w["text"] for w in line]
                if "Datum" in texts and "Omschrijving" in texts and "af" in texts and "bij" in texts:
                    header_idx = i
                    break
            if header_idx is None:
                continue
            header = lines[header_idx]
            desc_x = next(w["x0"] for w in header if w["text"] == "Omschrijving")
            af_word = next(w for w in header if w["text"] == "af")
            bij_word = next(w for w in header if w["text"] == "bij")
            amount_start = min(w["x0"] for w in header if w["text"] == "Bedrag") - 40
            split_x = (af_word["x1"] + bij_word["x1"]) / 2

            for line in lines[header_idx + 1:]:
                first = line[0]
                if first["text"] in FOOTER_WORDS:
                    # Samenvatting onderaan het afschrift: geen transacties meer.
                    current = None
                    break
                if DATE_RE.match(first["text"]) and first["x0"] < desc_x:
                    current = {"date": first["text"], "desc": [], "af": None, "bij": None}
                    rows.append(current)
                    rest = line[1:]
                elif current is not None:
                    rest = line
                else:
                    continue

                for w in rest:
                    if w["x0"] >= amount_start and AMOUNT_RE.match(w["text"]):
                        column = "af" if w["x1"] <= split_x else "bij"
                        if current[column] is None:
                            current[column] = to_amount(w["text"])
                    elif w["x0"] >= desc_x - 2 and w["x1"] < amount_start + 40:
                        current["desc"].append(w["text"])

            # Een nieuwe pagina begint met een nieuwe kop; nooit tekst doorschuiven.
            current = None

    for r in rows:
        if r["af"] is None and r["bij"] is None:
            continue
        amount = -(r["af"] or 0.0) + (r["bij"] or 0.0)
        raw = " ".join(r["desc"])
        info = parse_description(raw)
        st.transactions.append(Transaction(date=to_iso(r["date"]), amount=round(amount, 2), raw=raw, **info))

    st.assign_sequence()
    return st

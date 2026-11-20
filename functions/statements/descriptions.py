"""Omschrijvingen van Nederlandse banken ontleden in soort, tegenpartij, IBAN en plaats."""

from __future__ import annotations

import re

_FIELD_LABELS = ["IBAN:", "BIC:", "Naam:", "Omschrijving:", "Kenmerk:", "Machtiging:", "Incassant:", "Betalingskenm.:"]
_LABEL_RE = re.compile("(" + "|".join(re.escape(l) for l in _FIELD_LABELS) + ")")
_IBAN_RE = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$")


def _fields(text: str) -> dict[str, str]:
    """Haalt 'Label: waarde' paren uit een SEPA-omschrijving."""
    parts = _LABEL_RE.split(text)
    out: dict[str, str] = {}
    for i in range(1, len(parts) - 1, 2):
        label = parts[i].rstrip(":").lower()
        value = " ".join(parts[i + 1].split())
        if label not in out:
            out[label] = value
    return out


def normalize(text: str) -> str:
    return " ".join(text.split())


def parse_description(raw: str) -> dict[str, str]:
    """Geeft kind, name, iban, description en place terug."""
    text = normalize(raw)
    result = {"kind": "", "name": "", "iban": "", "description": "", "place": ""}

    # Pinbetaling: "BEA, Betaalpas Winkelnaam,PAS261 NR:ABC123, 06.01.26/16:49 PLAATS"
    m = re.match(r"^(BEA|GEA),\s*(?:Betaalpas|Apple Pay|Google Pay)?\s*(.*?),\s*PAS\s?\d+\s+NR:\s?\S+,?\s*(\d{2}\.\d{2}\.\d{2}/\d{2}[.:]\d{2})?\s*(.*)$", text)
    if m:
        result["kind"] = "Geldautomaat" if m.group(1) == "GEA" else "Betaalpas"
        result["name"] = m.group(2).strip()
        result["place"] = m.group(4).strip()
        return result

    m = re.match(r"^SEPA\s+(iDEAL|Overboeking|Incasso algemeen doorlopend|Incasso algemeen eenmalig|Incasso|Periodieke overb\.|Acceptgirobetaling)\b", text)
    if m:
        soort = m.group(1)
        result["kind"] = "iDEAL" if soort == "iDEAL" else "Incasso" if soort.startswith("Incasso") else "Overboeking"
        f = _fields(text)
        iban = f.get("iban", "").replace(" ", "").upper()
        result["iban"] = iban if _IBAN_RE.match(iban) else ""
        result["name"] = f.get("naam", "")
        result["description"] = f.get("omschrijving", "")
        return result

    if re.match(r"^ABN AMRO Bank N\.V\.", text) or re.match(r"^(Kosten|Rente)\b", text):
        result["kind"] = "Bankkosten"
        result["name"] = "Bank"
        result["description"] = text
        return result

    result["kind"] = "Overig"
    result["name"] = text[:60]
    result["description"] = text
    return result

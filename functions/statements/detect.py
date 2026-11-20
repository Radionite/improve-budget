"""Herkent welke bank en welk formaat een bestand heeft en kiest de juiste inlezer."""

from __future__ import annotations

import os

from . import abn_amro_pdf
from .model import ParsedStatement


class UnsupportedStatement(Exception):
    pass


def parse_statement(path: str, filename: str) -> ParsedStatement:
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            first = pdf.pages[0].extract_text() or ""
        if not first.strip():
            raise UnsupportedStatement("Deze PDF bevat geen tekst (is het een scan?). Download het afschrift opnieuw vanuit internetbankieren.")
        if abn_amro_pdf.looks_like(first):
            return abn_amro_pdf.parse(path)
        raise UnsupportedStatement("Dit PDF-afschrift wordt nog niet herkend. Nu ondersteund: ABN AMRO 'Bij- en afschrijvingen'.")

    raise UnsupportedStatement(f"Bestandstype {ext or 'onbekend'} wordt nog niet ondersteund. ING en ASN volgen zodra er een voorbeeld is.")

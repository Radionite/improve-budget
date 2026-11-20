"""Maakt een nep-ABN AMRO afschrift (verzonnen gegevens) voor de tests.

Gebruik: python tests/make_fixture.py
"""

from __future__ import annotations

import os

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "fixtures", "abn_amro_voorbeeld.pdf")

ROWS = [
    ("01-03-2026", ["SEPA Overboeking IBAN:", "NL00ABNA0123456789 BIC: ABNANL2A", "Naam: J JANSEN Omschrijving:", "Boodschappen Kenmerk: NOTPROVIDED"], "25,00", None),
    ("02-03-2026", ["BEA, Betaalpas Albert Heijn 1234,PAS123", "NR:ABC123, 02.03.26/10:15 UTRECHT"], "42,10", None),
    ("03-03-2026", ["SEPA iDEAL IBAN: NL27INGB0000026500", "BIC: INGBNL2A Naam: bol.com", "Omschrijving: 123456 bol.com"], "1.234,56", None),
    ("05-03-2026", ["SEPA Incasso algemeen doorlopend", "Incassant: NL00ZZZ000000000000", "Naam: Energiebedrijf Machtiging: X1", "Omschrijving: Termijn maart"], "150,00", None),
    ("25-03-2026", ["SEPA Overboeking IBAN:", "NL00ABNA0987654321 BIC: ABNANL2A", "Naam: WERKGEVER BV Omschrijving:", "Salaris maart"], None, "2.500,00"),
    ("30-03-2026", ["ABN AMRO Bank N.V. BasisPakket", "4,30Betaalpas 1,50"], "5,80", None),
]


def build() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    c = canvas.Canvas(OUT, pagesize=A4)
    w, h = A4

    def header(page: int) -> float:
        c.setFont("Helvetica-Bold", 16)
        c.drawString(380, h - 40, "Bij- en afschrijvingen")
        c.setFont("Helvetica", 9)
        c.drawString(30, h - 70, "Rekeninghouder")
        c.drawString(140, h - 70, "Voorbeeld Persoon")
        c.drawString(30, h - 100, "Priverekening")
        c.drawString(140, h - 100, "12.34.56.789")
        c.drawString(30, h - 115, "Periode")
        c.drawString(140, h - 115, "01-03-2026 t/m 31-03-2026")
        if page == 1:
            c.drawString(30, h - 135, "Saldo 01-03-2026   € 100,00")
            c.drawString(30, h - 150, "Saldo 31-03-2026   € 1.142,54")
        y = h - 175
        c.setFont("Helvetica-Bold", 9)
        c.drawString(30, y, "Datum")
        c.drawString(100, y, "Omschrijving")
        c.drawRightString(436, y, "Bedrag af")
        c.drawRightString(565, y, "Bedrag bij")
        c.setFont("Helvetica", 9)
        return y - 20

    y = header(1)
    page = 1
    for i, (date, lines, af, bij) in enumerate(ROWS):
        if i == 3:  # pagina-overgang testen
            c.showPage()
            page += 1
            y = header(page)
        c.drawString(30, y, date)
        if af:
            c.drawRightString(436, y, af)
        if bij:
            c.drawRightString(565, y, bij)
        for line in lines:
            c.drawString(100, y, line)
            y -= 11
        y -= 8

    y -= 10
    c.drawString(333, y, "Aantal afschrijvingen")
    c.drawString(456, y, "Aantal bijschrijvingen")
    y -= 14
    c.drawRightString(436, y, "5")
    c.drawRightString(565, y, "1")
    y -= 14
    c.drawString(338, y, "Totaal afgeschreven")
    c.drawString(462, y, "Totaal bijgeschreven")
    y -= 14
    c.drawString(381, y, "€")
    c.drawRightString(436, y, "1.457,46")
    c.drawString(507, y, "€")
    c.drawRightString(565, y, "2.500,00")
    c.save()


if __name__ == "__main__":
    build()
    print(OUT)

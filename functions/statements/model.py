from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass
class Transaction:
    date: str  # ISO: 2026-01-31
    amount: float  # negatief = afschrijving, positief = bijschrijving
    raw: str  # volledige omschrijving zoals op het afschrift
    kind: str = ""  # Betaalpas, iDEAL, Overboeking, Incasso, Bankkosten, Geldautomaat
    name: str = ""  # tegenpartij
    iban: str = ""  # IBAN van de tegenpartij (indien bekend)
    description: str = ""  # vrije omschrijving
    place: str = ""  # plaats (bij pinbetalingen)
    seq: int = 0  # volgnummer bij exact gelijke transacties

    def uid(self) -> str:
        """Stabiele id, zodat dezelfde transactie nooit dubbel wordt opgeslagen."""
        key = f"{self.date}|{self.amount:.2f}|{' '.join(self.raw.split())}|{self.seq}"
        return hashlib.sha1(key.encode("utf-8")).hexdigest()[:24]

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "month": self.date[:7],
            "amount": round(self.amount, 2),
            "raw": self.raw,
            "kind": self.kind,
            "name": self.name,
            "iban": self.iban,
            "description": self.description,
            "place": self.place,
        }


@dataclass
class ParsedStatement:
    bank: str
    account: str = ""
    period_from: str = ""
    period_to: str = ""
    opening_balance: float | None = None
    closing_balance: float | None = None
    stated_debit: float | None = None  # 'Totaal afgeschreven' volgens het afschrift
    stated_credit: float | None = None  # 'Totaal bijgeschreven' volgens het afschrift
    transactions: list[Transaction] = field(default_factory=list)

    @property
    def total_debit(self) -> float:
        return round(-sum(t.amount for t in self.transactions if t.amount < 0), 2)

    @property
    def total_credit(self) -> float:
        return round(sum(t.amount for t in self.transactions if t.amount > 0), 2)

    @property
    def balance_ok(self) -> bool | None:
        """Klopt beginsaldo + bij - af met het eindsaldo? None als het afschrift geen saldi noemt."""
        checks: list[bool] = []
        if self.opening_balance is not None and self.closing_balance is not None:
            calc = self.opening_balance + self.total_credit - self.total_debit
            checks.append(abs(calc - self.closing_balance) < 0.005)
        if self.stated_debit is not None:
            checks.append(abs(self.stated_debit - self.total_debit) < 0.005)
        if self.stated_credit is not None:
            checks.append(abs(self.stated_credit - self.total_credit) < 0.005)
        return all(checks) if checks else None

    def assign_sequence(self) -> None:
        seen: dict[str, int] = {}
        for t in self.transactions:
            key = f"{t.date}|{t.amount:.2f}|{' '.join(t.raw.split())}"
            t.seq = seen.get(key, 0)
            seen[key] = t.seq + 1

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from categorize import categorize  # noqa: E402
from statements import parse_statement  # noqa: E402
from statements.descriptions import parse_description  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "abn_amro_voorbeeld.pdf")


@pytest.fixture(scope="module")
def statement():
    if not os.path.exists(FIXTURE):
        from make_fixture import build

        build()
    return parse_statement(FIXTURE, "voorbeeld.pdf")


def test_header(statement):
    assert statement.bank == "ABN AMRO"
    assert statement.period_from == "2026-03-01"
    assert statement.period_to == "2026-03-31"
    assert statement.opening_balance == 100.00
    assert statement.closing_balance == 1142.54


def test_transactions_and_totals(statement):
    assert len(statement.transactions) == 6
    assert statement.total_debit == 1457.46
    assert statement.total_credit == 2500.00
    assert statement.stated_debit == 1457.46
    assert statement.balance_ok is True


def test_thousands_and_signs(statement):
    amounts = [t.amount for t in statement.transactions]
    assert -1234.56 in amounts
    assert 2500.00 in amounts


def test_footer_not_added_to_last_transaction(statement):
    last = statement.transactions[-1]
    assert last.amount == -5.80
    assert last.kind == "Bankkosten"


def test_descriptions(statement):
    by_date = {t.date: t for t in statement.transactions}
    pin = by_date["2026-03-02"]
    assert pin.kind == "Betaalpas"
    assert pin.name == "Albert Heijn 1234"
    assert pin.place == "UTRECHT"
    ideal = by_date["2026-03-03"]
    assert ideal.kind == "iDEAL"
    assert ideal.name == "bol.com"
    assert ideal.iban == "NL27INGB0000026500"
    incasso = by_date["2026-03-05"]
    assert incasso.kind == "Incasso"
    assert incasso.name == "Energiebedrijf"


def test_ids_are_stable_and_unique(statement):
    ids = [t.uid() for t in statement.transactions]
    assert len(set(ids)) == len(ids)
    again = parse_statement(FIXTURE, "voorbeeld.pdf")
    assert ids == [t.uid() for t in again.transactions]


def test_parse_description_overboeking():
    d = parse_description("SEPA Overboeking IBAN: NL00ABNA0123456789 BIC: ABNANL2A Naam: J JANSEN Kenmerk: NOTPROVIDED")
    assert d["kind"] == "Overboeking"
    assert d["iban"] == "NL00ABNA0123456789"
    assert d["name"] == "J JANSEN"


def test_categorize_own_account_rule_and_guess(statement):
    by_date = {t.date: t for t in statement.transactions}
    own = categorize(by_date["2026-03-01"], [], {"NL00ABNA0123456789"})
    assert own["cat"] == "eigen" and own["by"] == "regel"

    rules = [{"id": "r1", "match": "bol.com", "cat": "overig", "link": ""}]
    ruled = categorize(by_date["2026-03-03"], rules, set())
    assert ruled["cat"] == "overig" and ruled["by"] == "regel"

    guessed = categorize(by_date["2026-03-02"], [], set())
    assert guessed["cat"] == "" and guessed["guess"] == "boodschappen" and guessed["conf"] >= 60

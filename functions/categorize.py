"""Categorie voorstellen voor een transactie.

Volgorde:
1. Overboeking naar of van een eigen rekening -> 'eigen' (telt niet mee).
2. Een geleerde regel (eerder antwoord van de gebruiker) -> automatisch ingedeeld.
3. Anders: een voorstel op basis van trefwoorden. De gebruiker krijgt dan een vraag.
"""

from __future__ import annotations

from statements.model import Transaction

KEYWORDS: dict[str, list[str]] = {
    "boodschappen": ["supermarkt", "albert heijn", "ah to go", "jumbo", "poiesz", "lidl", "aldi", "plus ", "coop", "spar ", "dirk", "vomar", "picnic", "deen", "hoogvliet", "jan linders", "bakker", "slager"],
    "vervoer": ["tamoil", "shell", "esso", "tinq", "tango", "tankstation", "q-park", "parkeren", "ns groep", "ns reizen", "arriva", "qbuzz", "garage", "anwb", "kwik-fit", "autoband"],
    "energie": ["eneco", "vattenfall", "essent", "greenchoice", "budget energie", "vandebron", "vitens", "waterbedrijf", "evides", "brabant water"],
    "verzekering": ["verzeker", "zilveren kruis", "vgz", "menzis", "centraal beheer", "interpolis", "fbto", "nationale-nederlanden", "ohra", "univé", "unive"],
    "abo": ["ziggo", "kpn", "odido", "t-mobile", "vodafone", "netflix", "spotify", "disney", "videoland", "basispakket"],
    "studieschuld": ["duo", "dienst uitvoering onderwijs"],
    "wonen": ["hypotheek", "huur", "woonstichting", "woningcorporatie", "vve"],
    "kleding": ["zalando", "h&m", "primark", "c&a", "zeeman", "we fashion", "schoenen", "only "],
    "verzorging": ["kruidvat", "etos", "trekpleister", "da drogist", "barbier", "kapper", "apotheek"],
    "dieren": ["dierenarts", "dierenkliniek", "pets place", "jumper", "dierenspeciaal"],
    "vrijetijd": ["restaurant", "cafe", "café", "eetcafe", "snackbar", "pizzeria", "mcdonald", "burger king", "bioscoop", "pathe", "pathé", "steam", "valve", "playstation", "sony interactive", "nintendo", "spellekijn", "jamin", "bowling"],
    "overig": ["bol.com", "amazon", "hema", "action", "bruna", "gall&gall", "blokker", "kruidvat", "juwelier"],
    "opvang": ["kinderopvang", "bso", "school", "ouderbijdrage"],
}


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def guess(tx: Transaction) -> tuple[str, int, list[str]]:
    """Geeft (voorstel, zekerheid 0-100, alternatieven)."""
    haystack = _norm(f"{tx.name} {tx.description}") + " "
    hits = [cat for cat, words in KEYWORDS.items() if any(w in haystack for w in words)]
    if tx.amount > 0 and not hits:
        return "inkomen", 50, ["eigen", "overig"]
    if tx.kind == "Bankkosten":
        return "abo", 80, ["overig"]
    if hits:
        conf = 80 if len(hits) == 1 else 60
        return hits[0], conf, hits[1:3] + (["overig"] if "overig" not in hits else [])
    return "", 0, ["overig", "vrijetijd", "boodschappen"]


def match_rule(tx: Transaction, rules: list[dict]) -> dict | None:
    name = _norm(tx.name)
    for r in rules:
        if r.get("iban") and tx.iban and r["iban"] == tx.iban and (not r.get("match") or _norm(r["match"]) in name):
            return r
    for r in rules:
        m = _norm(r.get("match", ""))
        if m and (m == name or (len(m) >= 4 and m in name)):
            return r
    return None


def categorize(tx: Transaction, rules: list[dict], own_ibans: set[str]) -> dict:
    if tx.iban and tx.iban in own_ibans:
        return {"cat": "eigen", "link": "", "by": "regel", "guess": "eigen", "conf": 100, "alts": []}
    rule = match_rule(tx, rules)
    if rule:
        return {"cat": rule.get("cat", ""), "link": rule.get("link", ""), "by": "regel", "guess": rule.get("cat", ""), "conf": 100, "alts": [], "ruleId": rule.get("id", "")}
    g, conf, alts = guess(tx)
    return {"cat": "", "link": "", "by": "", "guess": g, "conf": conf, "alts": alts}

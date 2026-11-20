"""Cloud Functions voor Huisbudget.

verwerk_afschrift: wordt gestart zodra een bankafschrift is geüpload naar
  households/{hid}/statements/{sid}/{bestandsnaam}
Leest het afschrift, deelt transacties in met de geleerde regels en schrijft
ze naar households/{hid}/transactions. Dubbele transacties worden overgeslagen.
"""

from __future__ import annotations

import os
import re
import tempfile

from firebase_admin import firestore, initialize_app, storage
from firebase_functions import options, storage_fn

from categorize import categorize
from statements import parse_statement

initialize_app()
options.set_global_options(region="europe-west1", max_instances=3)

PATH_RE = re.compile(r"^households/([^/]+)/statements/([^/]+)/(.+)$")


def _clients(bucket_name: str):
    """Firestore- en Storage-clients. In de lokale emulator zonder Google-inloggegevens."""
    if os.environ.get("FUNCTIONS_EMULATOR") == "true":
        from google.auth.credentials import AnonymousCredentials
        from google.cloud import firestore as gfs
        from google.cloud import storage as gcs

        project = os.environ.get("GCLOUD_PROJECT", "demo-huisbudget")
        creds = AnonymousCredentials()
        return gfs.Client(project=project, credentials=creds), gcs.Client(project=project, credentials=creds).bucket(bucket_name)
    return firestore.client(), storage.bucket(bucket_name)


@storage_fn.on_object_finalized(memory=options.MemoryOption.MB_512, timeout_sec=120)
def verwerk_afschrift(event: storage_fn.CloudEvent[storage_fn.StorageObjectData]) -> None:
    path = event.data.name or ""
    m = PATH_RE.match(path)
    if not m:
        return
    hid, sid, filename = m.groups()

    db, bucket = _clients(event.data.bucket)
    st_ref = db.document(f"households/{hid}/statements/{sid}")
    st_ref.set({"status": "verwerken"}, merge=True)

    blob = bucket.blob(path)
    suffix = os.path.splitext(filename)[1]
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        blob.download_to_filename(tmp.name)
        try:
            parsed = parse_statement(tmp.name, filename)
        except Exception as exc:  # noqa: BLE001 - foutmelding tonen aan gebruiker
            st_ref.set({"status": "fout", "error": str(exc)[:300]}, merge=True)
            return

    household = db.document(f"households/{hid}").get().to_dict() or {}
    own_ibans = {i.replace(" ", "").upper() for i in household.get("ownIbans", [])}
    rules = [{**r.to_dict(), "id": r.id} for r in db.collection(f"households/{hid}/rules").stream()]

    col = db.collection(f"households/{hid}/transactions")
    txs = parsed.transactions
    new_count = 0
    open_count = 0
    for start in range(0, len(txs), 300):
        chunk = txs[start:start + 300]
        refs = [col.document(t.uid()) for t in chunk]
        existing = {snap.id for snap in db.get_all(refs) if snap.exists}
        batch = db.batch()
        for t, ref in zip(chunk, refs):
            if ref.id in existing:
                continue
            data = {**t.to_dict(), **categorize(t, rules, own_ibans), "bank": parsed.bank, "statementId": sid, "createdAt": firestore.SERVER_TIMESTAMP}
            if not data["cat"]:
                open_count += 1
            batch.set(ref, data)
            new_count += 1
        batch.commit()

    st_ref.set({
        "status": "klaar",
        "bank": parsed.bank,
        "account": parsed.account,
        "periodFrom": parsed.period_from,
        "periodTo": parsed.period_to,
        "count": len(txs),
        "newCount": new_count,
        "openCount": open_count,
        "openingBalance": parsed.opening_balance,
        "closingBalance": parsed.closing_balance,
        "totalDebit": parsed.total_debit,
        "totalCredit": parsed.total_credit,
        "balanceOk": parsed.balance_ok,
        "error": "",
    }, merge=True)

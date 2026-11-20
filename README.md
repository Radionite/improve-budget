# Huisbudget

Webapp om samen het huishoudbudget te beheren: budget in procenten met advies per gezinssituatie,
gezin/huisdieren/voertuigen, bankafschriften inlezen (de app vraagt wat iets is en onthoudt het),
facturen en garanties, beleggingsprojecties, studieschuld en studiesparen voor de kinderen.

- **Webapp:** React + TypeScript (Vite), werkt op computer en telefoon (PWA)
- **Firebase:** Authentication, Firestore, Storage, Hosting
- **Cloud Function (Python):** leest bankafschriften in (nu: ABN AMRO PDF "Bij- en afschrijvingen")

```
web/                 de webapp
functions/           Python Cloud Function + inlezers voor bankafschriften (met tests)
firestore.rules      alleen leden van een huishouden zien de gegevens
storage.rules        idem voor facturen en afschriften
.github/workflows/   controle bij elke push, en automatisch deployen naar Firebase
```

## 1. Firebase-project aanmaken (eenmalig)

1. Ga naar <https://console.firebase.google.com> en maak een project aan.
2. Zet het project op het **Blaze**-abonnement (betalen per gebruik). Dat is nodig voor de
   Python-functie en voor automatische back-ups. Stel in Google Cloud een budgetwaarschuwing in.
3. **Authentication** → Aanmeldmethode → **E-mailadres/wachtwoord** aanzetten.
   Aanrader: zet onder *Instellingen* ook verificatie in twee stappen (MFA) aan.
4. **Firestore Database** → database maken, locatie **europe-west1**, productiemodus.
5. **Storage** → aan de slag, locatie **europe-west1**.
6. Projectinstellingen → *Jouw apps* → **Web-app** toevoegen. Kopieer de config-waarden.

## 2. Lokaal instellen en deployen

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
cp .firebaserc.example .firebaserc        # vul je project-id in
cp web/.env.example web/.env              # vul de web-app config in
```

```bash
cd functions && python3.12 -m venv venv && venv/bin/pip install -r requirements.txt && cd ..
```

```bash
cd web && npm ci && npm run build && cd ..
```

```bash
firebase deploy
```

Open daarna de Hosting-URL, maak een account en een huishouden aan. Je partner maakt een eigen
account en doet mee met de uitnodigingscode uit **Instellingen**.

## 3. Back-ups

**Database, dagelijks automatisch** (14 weken bewaren):

```bash
gcloud firestore backups schedules create --project=JOUW_PROJECT_ID --database='(default)' --recurrence=daily --retention=14w
```

**Facturen en afschriften (Storage):** zet versiebeheer aan, dan zijn overschreven of verwijderde
bestanden terug te halen:

```bash
gcloud storage buckets update gs://JOUW_BUCKET --versioning
```

**Zelf bewaren:** in de app onder *Instellingen → Alles downloaden* krijg je al je gegevens als één bestand.

## 4. Automatisch deployen via GitHub

Bij elke push naar `main` draait `.github/workflows/deploy.yml`. Stel in de repository in
(*Settings → Secrets and variables → Actions*):

| Soort | Naam | Waarde |
|---|---|---|
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON-sleutel van een service-account met de rol *Firebase Admin* |
| Secret | `FIREBASE_PROJECT_ID` | je project-id |
| Secret | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID` | uit de web-app config |
| Variable | `DEPLOY_ENABLED` | `true` (zolang dit ontbreekt wordt er niet gedeployed) |

`.github/workflows/ci.yml` bouwt de webapp en draait de tests bij elke push en pull request.

## 5. Lokaal ontwikkelen met de emulators

Zonder echt Firebase-project, alles op je eigen computer:

```bash
firebase emulators:start --project demo-huisbudget --only auth,firestore,storage,functions
```

```bash
cd web && VITE_USE_EMULATORS=true npm run dev
```

Tests van de afschrift-inlezer:

```bash
cd functions && venv/bin/pip install -r requirements-dev.txt && venv/bin/python -m pytest -q tests
```

## Privacy

- Echte bankafschriften en facturen horen **nooit** in git. `.gitignore` sluit `*.pdf` en `*.csv` uit;
  de test gebruikt een nagemaakt afschrift met verzonnen gegevens (`functions/tests/make_fixture.py`).
- Alle gegevens staan per huishouden in Firestore/Storage; de beveiligingsregels geven alleen leden toegang.

## Een nieuwe bank toevoegen (ING, ASN)

1. Download een afschrift en maak namen en bedragen onherkenbaar.
2. Schrijf een inlezer in `functions/statements/` naar het voorbeeld van `abn_amro_pdf.py`
   (of een CSV-inlezer) en registreer hem in `detect.py`.
3. Maak een nagemaakt voorbeeld in `tests/fixtures/` en schrijf tests. De saldocontrole
   (beginsaldo + bij − af = eindsaldo) vangt de meeste fouten.

# Gezinsbank

*Ons huishoudbudget, samen beheerd.*

Webapp om samen het huishoudbudget te beheren: budget in procenten met advies per gezinssituatie,
gezin/huisdieren/voertuigen, bankafschriften inlezen (de app vraagt wat iets is en onthoudt het),
facturen en garanties, beleggingsprojecties, studieschuld en studiesparen voor de kinderen.

Alles draait op het **gratis Firebase Spark-abonnement**:

| Onderdeel | Hoe |
|---|---|
| Inloggen | Firebase Authentication (e-mail/wachtwoord) |
| Gegevens | Firestore; alleen leden van het huishouden hebben toegang (`firestore.rules`) |
| Website | Firebase Hosting |
| Bankafschriften | worden **in de browser** gelezen met PDF.js; het afschrift zelf wordt nergens geüpload, alleen de transacties worden opgeslagen |
| Facturen en foto's | in Firestore (foto's worden verkleind, bestanden tot 8 MB in stukjes) |
| Back-ups | elke nacht versleuteld via GitHub Actions, plus downloaden/terugzetten in de app |

```
web/                       de webapp (React + TypeScript, Vite)
web/src/lib/statements/    afschrift-inlezer (ABN AMRO PDF) met tests
scripts/                   back-up en terugzetten (Node, firebase-admin)
firestore.rules            beveiliging van de database
.github/workflows/         controle, automatisch deployen, nachtelijke back-up
tools/make_fixture.py      maakt het nagemaakte test-afschrift (verzonnen gegevens)
```

## 1. Firebase instellen (eenmalig, gratis)

1. Ga naar <https://console.firebase.google.com> en maak een project aan. Het blijft op **Spark**.
2. **Authentication** → Aanmeldmethode → **E-mailadres/wachtwoord** aanzetten.
3. **Firestore Database** → database maken, locatie **europe-west1** (of `eur3`), productiemodus.
4. Projectinstellingen → *Jouw apps* → **Web-app** toevoegen. Kopieer `apiKey`, `authDomain`, `projectId` en `appId`.
5. Authentication → Instellingen → *Geautoriseerde domeinen*: controleer dat `JOUWPROJECT.web.app` erin staat.

Storage en Functions zijn **niet** nodig.

## 2. Eerste keer live zetten vanaf je computer

Nodig: Node.js 22 en git.

```bash
git clone https://github.com/Radionite/improve-budget.git && cd improve-budget
```

```bash
npm install -g firebase-tools && firebase login
```

```bash
firebase use --add
```

Kopieer `web/.env.example` naar `web/.env` en vul de waarden van stap 1.4 in. Daarna:

```bash
cd web && npm ci && npm test && npm run build && cd ..
```

```bash
firebase deploy --only hosting,firestore:rules
```

Open de Hosting-URL, maak een account en een huishouden aan. Je partner maakt een eigen account
en doet mee met de uitnodigingscode uit **Instellingen**.

## 3. Automatisch via GitHub

### Service-account maken

Google Cloud Console → *IAM en beheer* → *Serviceaccounts* (zelfde project) → **Serviceaccount maken**,
met de rollen:

- **Firebase Hosting Admin** (deployen website)
- **Firebase Rules Admin** (deployen beveiligingsregels)
- **Cloud Datastore User** (back-up lezen en terugzetten)
- **API Keys Viewer** (nodig voor `firebase deploy`)

Maak daarna onder *Sleutels* een **JSON-sleutel** aan. Zet die nooit in git.

### Secrets en variabelen

In de repository: *Settings → Secrets and variables → Actions*.

| Soort | Naam | Waarde |
|---|---|---|
| Secret | `FIREBASE_SERVICE_ACCOUNT` | de volledige inhoud van de JSON-sleutel |
| Secret | `FIREBASE_PROJECT_ID` | je project-id |
| Secret | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID` | uit de web-app config |
| Secret | `BACKUP_PASSWORD` | een lang wachtwoord; bewaar het ook in je wachtwoordmanager |

## 4. Back-ups

- **Elke nacht** (`.github/workflows/backup.yml`): de hele database, inclusief facturen en foto's,
  gecomprimeerd en versleuteld (AES-256). Te vinden bij *Actions → Back-up → een run → Artifacts*.
  Bewaard: 90 dagen. Handmatig starten kan met *Run workflow*.
- **In de app**: *Instellingen → Alles downloaden* en *Back-up terugzetten*.

### Nachtelijke back-up terugzetten

Download het artifact, pak de zip uit en:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in gezinsbank-backup-DATUM.json.gz.enc -out backup.json.gz
```

```bash
gunzip backup.json.gz
```

```bash
cd scripts && npm ci && FIREBASE_SERVICE_ACCOUNT="$(cat /pad/naar/sleutel.json)" node restore.mjs ../backup.json
```

## 5. Lokaal ontwikkelen

Met de Firebase-emulators (geen echt project nodig):

```bash
firebase emulators:start --project demo-gezinsbank --only auth,firestore
```

```bash
cd web && VITE_USE_EMULATORS=true npm run dev
```

Tests van de afschrift-inlezer:

```bash
cd web && npm test
```

Een echt afschrift lokaal testen (komt nooit in git):

```bash
cd web && REAL_PDF=/pad/naar/afschrift.pdf npm test
```

## Gratis limieten (Spark)

Firestore: 1 GiB opslag, 50.000 leesacties en 20.000 schrijfacties per dag. De app leest live alleen
de laatste 13 maanden aan transacties; voor een gezin blijft dat ruim binnen de limiet.
Facturen tellen mee voor de 1 GiB: met verkleinde foto's (~300 kB) passen er duizenden in.

## Een nieuwe bank toevoegen (ING, ASN)

1. Download een afschrift en maak namen en bedragen onherkenbaar.
2. Schrijf een inlezer in `web/src/lib/statements/` naar het voorbeeld van `abnAmro.ts` en registreer hem in `index.ts`.
3. Maak een nagemaakt voorbeeld in `__fixtures__/` en schrijf tests. De saldocontrole
   (beginsaldo + bij − af = eindsaldo) vangt de meeste fouten.

## Privacy

- Echte bankafschriften en facturen horen **nooit** in git: `.gitignore` sluit `*.pdf` en `*.csv` uit.
- Afschriften worden alleen in je eigen browser gelezen.
- Back-ups zijn versleuteld; zonder `BACKUP_PASSWORD` zijn ze onleesbaar.

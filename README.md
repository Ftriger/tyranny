# Tyranny – nettside, merch-butikk og admin

Nettside: https://tyranny-five.vercel.app · Admin: https://tyranny-five.vercel.app/admin

## Filer
- `index.html` – nettsiden
- `admin.html` – admin-panel (innlogging, varer, brukere)
- `products.json` – standardvarer (brukes til admin har lagret egne varer)
- `api/` – serverfunksjoner (innlogging, varer, bilder, betaling)
- `img/` – bilder

## Oppsett av admin (én gang)
Alt lagres i dette GitHub-repoet – gratis, ingen database.

1. **GitHub-nøkkel:** github.com/settings/personal-access-tokens/new
   - Navn: `tyranny-admin` · Expiration: 1 år
   - Repository access: **Only select repositories** → `Ftriger/tyranny`
   - Permissions → Repository → **Contents: Read and write**
   - Generate → kopier nøkkelen
2. **Vercel** → prosjektet → *Settings → Environment Variables*:
   - `GITHUB_TOKEN` = nøkkelen fra punkt 1
   - `ADMIN_PASSWORD` = et sterkt passord for eier-innlogging
3. *Deployments* → siste → **Redeploy**.
4. Gå til `/admin`, logg inn som **eier**, og lag brukere til bandet under «Brukere».

Hver lagring blir en commit i repoet, og nettsiden oppdateres etter ca. 1 minutt.
Brukerlisten lagres kryptert i `data/users.enc`. Bytter du `ADMIN_PASSWORD`, må brukerne legges inn på nytt.

Roller: **Admin** kan styre brukere og varer. **Butikk** kan bare endre varer.

## Lager
- «På lager» av = hele varen selges som forhåndsbestilling.
- «Tomt på lager i disse størrelsene» = bare de størrelsene blir forhåndsbestilling.
Kunden ser «Ikke på lager – bestill nå, leveres ved neste bestillingsrunde».

## Bestillinger på e-post
Bestillinger sendes til **shop@tyranny.no** (endres med `ORDER_EMAIL`). Kunden får bekreftelse med ordrenummer.

**Anbefalt – send via egen e-postkonto (havner ikke i spam).** Legg inn i Vercel → Environment Variables:
- `SMTP_HOST` – utgående server fra e-postleverandøren (f.eks. `smtp.domeneshop.no`, `send.one.com`, `smtp.office365.com`)
- `SMTP_PORT` – vanligvis `587` (eller `465`)
- `SMTP_USER` – `shop@tyranny.no` (eller brukernavnet leverandøren oppgir)
- `SMTP_PASS` – passordet til e-postkontoen
Deretter Redeploy.

**Reserve (uten SMTP):** FormSubmit. Første bestilling gir en aktiveringsmail fra `submissions@formsubmit.co` som må godkjennes.

## Kortbetaling (valgfritt)
En voksen oppretter Stripe-konto → legg `STRIPE_SECRET_KEY` i Environment Variables → Redeploy.

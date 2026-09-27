# Tyranny – nettside, merch-butikk og admin

Nettside: https://tyranny-five.vercel.app · Admin: https://tyranny-five.vercel.app/admin

## Filer
- `index.html` – nettsiden
- `admin.html` – admin-panel (innlogging, varer, brukere)
- `products.json` – standardvarer (brukes til admin har lagret egne varer)
- `api/` – serverfunksjoner (innlogging, varer, bilder, betaling)
- `img/` – bilder

## Oppsett av admin (én gang, i Vercel)
1. **Lagring:** Vercel → prosjektet → *Storage* → *Create* → **Upstash for Redis** (gratis) → koble til prosjektet.
2. **Eier-passord:** *Settings → Environment Variables* → `ADMIN_PASSWORD` = et sterkt passord.
3. *Deployments* → siste → **Redeploy**.
4. Gå til `/admin`, logg inn med brukernavn **eier** og passordet over, og lag brukere til bandet under «Brukere».

Roller: **Admin** kan styre brukere og varer. **Butikk** kan bare endre varer.

## Lager
- «På lager» av = hele varen selges som forhåndsbestilling.
- «Tomt på lager i disse størrelsene» = bare de størrelsene blir forhåndsbestilling.
Kunden ser «Ikke på lager – bestill nå, leveres ved neste bestillingsrunde».

## Kortbetaling (valgfritt)
En voksen oppretter Stripe-konto → legg `STRIPE_SECRET_KEY` i Environment Variables → Redeploy.

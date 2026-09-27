# Tyranny – nettside og merch-butikk

Statisk nettside + Stripe-betaling via Vercel.

## Filer
- `index.html` – hele nettsiden
- `products.json` – varer og priser (endre her – brukes både av siden og betalingen)
- `api/checkout.js` – lager Stripe-betaling (ikke rør)

## Slå på betaling
1. En voksen (18+) oppretter Stripe-konto på stripe.com (f.eks. forelder eller foreningen).
2. Kopier "Secret key" (sk_live_...) fra Stripe → Developers → API keys.
3. Vercel → prosjektet → Settings → Environment Variables:
   Navn `STRIPE_SECRET_KEY`, verdi = nøkkelen. Lagre og "Redeploy".

Uten nøkkel viser kurven "Betaling er ikke koblet på ennå".

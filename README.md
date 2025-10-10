# KHBF Admin

Administrativ webbapplikation för Kullaviks Havsbastuförening (KHBF).

## Funktioner

- **Medlemsregister**: Visa alla medlemmar med besöksstatistik
- **Sök & Filter**: Sök på namn, email, telefon eller kundnummer
- **Sortering**: Sortera medlemmar efter besök (vecka/månad/3 månader)
- **Besöksstatistik**: Se bastubesök för olika tidsperioder
- **Realtidsdata**: Automatisk synkning från Fortnox och Parakey via Supabase

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: CSS (kan uppgraderas till Tailwind)
- **Database**: Supabase (PostgreSQL)
- **Data Source**: `member_registry` view i Supabase

## Kom igång

```bash
# Installera dependencies
npm install

# Starta dev-server
npm run dev

# Bygg för produktion
npm run build
```

## Miljövariabler

Skapa `.env` med:

```
VITE_SUPABASE_URL=https://rzsoxgagglmitglvmfrk.supabase.co
VITE_SUPABASE_ANON_KEY=din_anon_key_här
```

## Datamodell

Appen hämtar data från `member_registry` view:

- Medlemsinformation från Fortnox
- Besöksdata från Aptus/Parakey
- Telefonnummer (mobile/landline)
- Email-mappningar

## Nästa steg

- [ ] Lägg till CSS för tabell-styling
- [ ] Implementera detaljvy för enskild medlem
- [ ] Visa phone_mappings och email_mappings
- [ ] Autentisering (Supabase Auth)
- [ ] Exportera till Excel/CSV
- [ ] Mobilanpassning

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KHBF Admin is an administrative web application for Kullaviks Havsbastuförening (KHBF), a Swedish sauna association. The app displays member data, visit statistics, and access credentials synced from Fortnox (accounting) and Aptus/Parakey (access control systems) via Supabase.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (Vite dev server on default port 5173)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **Routing**: react-router-dom v7
- **Database**: Supabase (PostgreSQL)
- **Styling**: Plain CSS (App.css, index.css)

## Database Architecture

The app reads from Supabase tables:

- `members` - Primary member data from Fortnox (fortnox_customer_number, first_name, last_name, email, status, address, etc.)
- `phone_mappings` - Maps member IDs to phone numbers with type (mobile/landline) and primary flag
- `email_mappings` - Maps member IDs to Parakey emails for access correlation
- `visits` - Access logs from Aptus/Parakey (userid, eventtime, department, accesscredential)
- `parakey_users` - Parakey user accounts (id, email, name)
- `aptus_users` - Aptus RFID card data (card, name, blocked, f0=customer_number, f1=notes)

**Key relationships:**
- `members.aptus_user_id` → `aptus_users.id` (RFID access)
- `members.parakey_user_id` → `parakey_users.id` (mobile app access)
- `visits.userid` can be either aptus_user_id or parakey_user_id
- `visits.accesscredential` contains RFID card number for Aptus visits or email for Parakey visits

## Application Structure

### Routes

- `/` - Member list (MemberList component)
- `/medlem/:id` - Member detail page (MemberDetail component)
- `/parakey-mapping` - Manual email mapping tool (ParakeyMapping component)

### Data Loading Pattern

**App.tsx** loads all members and recent visit counts (30 days) on mount:
- Fetches ALL members using pagination (1000 records per page) to avoid Supabase default limits
- Filters out system accounts (`is_system_account = true`)
- Fetches ALL visits from last 30 days using pagination
- Counts visits per user (aptus_user_id + parakey_user_id combined)
- Loads primary phone numbers from `phone_mappings`
- Passes merged data to child components

**MemberDetail.tsx** fetches additional details for a single member:
- Phone numbers (all, not just primary)
- Email addresses (Fortnox + Parakey if different)
- Recent visits (last 90 days)
- RFID card usage statistics (visits per card, department breakdown)
- Aptus keys from `aptus_users` table
- Parakey access info
- Invoices from external API (http://localhost:3002/api/invoices/:customer_number)

### Important Data Patterns

1. **Pagination for large datasets**: Always use `.range(from, from + pageSize - 1)` in while loops when fetching from tables that may exceed 1000 rows
2. **User ID correlation**: Members can have both aptus_user_id and parakey_user_id - combine visit counts from both
3. **Department naming**: Visits use both old ("GENTS"/"LADIES") and new ("Herrar"/"Damer") department names - handle both
4. **Swedish timezone**: Display all dates/times in 'Europe/Stockholm' timezone using `toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })`
5. **System accounts**: Filter out members where `is_system_account = true`

## Environment Variables

Required in `.env`:

```
VITE_SUPABASE_URL=https://rzsoxgagglmitglvmfrk.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Code Conventions

- Swedish language for UI text and variable names related to domain concepts
- Use TypeScript interfaces from `lib/supabase.ts` for type safety
- Supabase client is initialized in `lib/supabase.ts` and exported as singleton
- Component state managed with useState hooks - no global state management
- All dates displayed in Swedish locale and Stockholm timezone

## External Dependencies

- **Invoice API**: MemberDetail expects a local API server at `http://localhost:3002/api/invoices/:customer_number` that returns Fortnox invoice data
- **Supabase**: All member and visit data comes from Supabase database tables

# Whole-site and admin quality pass

## Goal
Make every public page and administrator workflow reliable, readable, and usable across phone and desktop sizes without changing AniEra’s core features.

## Work
1. Audit all public routes for broken loading/error/empty states, overflow, navigation, forms, and missing page metadata.
2. Strengthen the admin entry flow so access is checked before admin content renders, with a clear denied state and safe sign-out/navigation behavior.
3. Standardize admin layout and controls for small screens: compact navigation, consistent fields/buttons, accessible labels, stable tables, and clear pending/error states.
4. Verify users and roles, site settings, theme, providers, custom APIs, proxies/logs, SEO, backup/restore, and audit actions; fix concrete authorization, validation, refresh, and feedback bugs found.
5. Add unique no-index metadata for every protected admin page and unique sharing metadata for every public content page.
6. Test the public pages and the signed-in admin journey in a real browser, then resolve any build, runtime, console, or network errors discovered.

## Technical details
- Keep all admin writes behind authenticated server-side admin checks.
- Reuse the existing design tokens and shared admin shell rather than introducing a new visual system.
- Preserve the separate private API console and existing custom API/proxy behavior.
- Add focused tests only where business or access rules change.

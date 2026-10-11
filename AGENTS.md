# Project architecture rules

- Keep administrator data mutations behind authenticated server functions with a server-side administrator-role check, because route guards and hidden controls do not secure callable actions.
- Keep shared administrator navigation and presentation in `AdminShell`, because every admin page must remain usable and consistent on mobile and desktop.
- Define glass and flat-content surfaces centrally in the global stylesheet and use shared navigation primitives, because accessibility fallbacks and theme changes must apply consistently without changing data workflows.
- Read theme preferences only after hydration and retain system preference as the default, because server-rendered pages must not depend on browser storage.
- Keep site navigation in one Navbar with explicit bar positioning and CSS-only frosting, because nested blur and SVG displacement cause duplicate-looking bars and rendering instability.

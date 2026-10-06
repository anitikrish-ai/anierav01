# Project architecture rules

- Keep administrator data mutations behind authenticated server functions with a server-side administrator-role check, because route guards and hidden controls do not secure callable actions.
- Keep shared administrator navigation and presentation in `AdminShell`, because every admin page must remain usable and consistent on mobile and desktop.

# Security notes

This project is intentionally designed as a **static, local two-player chess game** for GitHub Pages.

## What is protected

- No external JavaScript libraries.
- No external network requests.
- No `eval`, `Function`, dynamic script loading, or remote code execution.
- No forms, authentication tokens, API keys, cookies, or backend secrets.
- DOM updates use `textContent`, `createElement`, and `replaceChildren` instead of injecting user-controlled HTML.
- A restrictive Content Security Policy is included with `<meta http-equiv="Content-Security-Policy">`.
- Referrer policy is set to `no-referrer`.
- The game does not store personal data.
- There is no chat, file upload, database, login, or account system.

## Important limitation

A GitHub Pages site is public client-side code. Anyone can view or modify the JavaScript **in their own browser**. You cannot create a truly tamper-proof security boundary using only HTML/CSS/JavaScript.

For this local two-player version, that is fine because:
- there is no server state to steal,
- no password or secret exists,
- no other player's remote game can be affected.

If you later add **online multiplayer, accounts, ratings, matchmaking, payments, or saved games**, security must move to a backend/server. Never trust moves, scores, user identity, or permissions sent by browser JavaScript alone.

## GitHub Pages limitation

GitHub Pages does not provide arbitrary custom response headers for every project. The CSP here is included as a meta policy, which protects many script/style/resource cases, but some browser security directives only work fully as HTTP headers.

For higher-assurance deployment, use a hosting platform where you can configure security headers such as:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security`

GitHub Pages already serves sites over HTTPS when HTTPS enforcement is enabled.

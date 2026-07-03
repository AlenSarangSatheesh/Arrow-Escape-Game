# Security Policy

## Supported Versions

Arrow Escape is a client-side browser game with no server component. The latest version on
the `main` branch is the supported version.

| Version | Supported |
| ------- | --------- |
| main    | ✅        |

## Reporting a Vulnerability

If you discover a security issue — for example, a way to break out of the local storage
sandbox, execute untrusted code via an imported level share-code, or a cross-site scripting
vector in the level editor — please report it privately.

- **Email:** alensarangsatheesh@gmail.com
- Please include a description, reproduction steps, and the potential impact.
- Do **not** open a public issue for security reports.

You can expect an acknowledgement within a few days. Once the issue is resolved, we are
happy to credit you in the release notes (with your permission).

## Scope Notes

Because the game runs entirely in the browser and stores data only in the user's own
`localStorage`, the primary areas of concern are:

- Parsing of imported level share-codes (must never `eval` untrusted input).
- The level editor's handling of user-provided text.
- Service worker cache poisoning.

All imported data is treated as untrusted and validated before use.

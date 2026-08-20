---
sidebar_position: 19
---

# Testing on a real phone over HTTPS

Some browser features refuse to work outside a **secure context**, and the device orientation
sensor is the strictest of them: on an insecure page it delivers no events, throws no error and
logs no warning, so a tilt feature looks like broken code rather than a blocked permission. On
iOS the permission prompt never appears either, which makes the sensor look absent.

This is only a problem on a phone. `http://localhost` counts as a secure context by
definition, so a laptop needs nothing. A phone cannot reach `localhost`, has to use the
machine's LAN address instead, and `http://192.168.x.x` is **not** a secure context.

## The quick way

```sh
pnpm dev:mobile
```

This is `vite --host` with `VITE_HTTPS=1`, which enables `@vitejs/plugin-basic-ssl` and prints
a `https://192.168.x.x:5173` address to open on the phone. The certificate is self-signed, so
the phone shows a warning the first time: tap **Show Details**, then **visit this website**.

The plugin is opt-in rather than always on, because a self-signed certificate costs that
warning on every fresh browser profile.

## When the phone will not accept the certificate

iOS is markedly fussier about self-signed certificates than a desktop browser, and sometimes
offers no way through the warning at all. When that happens, stop fighting the certificate and
borrow a trusted one from a tunnel:

```sh
pnpm dev
cloudflared tunnel --url http://localhost:5173
```

The tunnel prints a public `https://` address with a genuinely trusted certificate, so the
phone loads it without a warning and every secure-context feature works. `ngrok http 5173` does
the same thing. Two costs are worth knowing: the address changes on each run, and the traffic
leaves your machine, so it suits a scratch dev server rather than anything sensitive.

For a setup that survives across sessions, `mkcert` issues a locally-trusted certificate and
its root can be installed on the phone as a configuration profile. It is the most work and the
best long-term answer if phone testing is routine.

## Confirming it worked

The secure context is what matters, not the certificate warning. Any page can check it:

| Check                              | Meaning                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `window.isSecureContext` is `true` | Sensor APIs are allowed to run                                |
| The address bar shows `https://`   | Necessary, and on iOS sufficient once the warning is accepted |

Tilt Maze reports this directly: its **Sensor** readout lists the secure-context flag, the
permission state and how many times the platform prompt was actually invoked, so a blocked
sensor can be diagnosed from the phone without a tethered debugger.

## Related

- `documentation/docs/packages/controls.md` — the motion device and its three gates
- `documentation/docs/journey/tilt-maze.md` — why each gate fails silently

# On-prem staging host: roysauto-staging

Brian D1575 (2026-11-06): the catalog-connected test site runs on our servers,
like capautov3's `staging.autrex.ca`; Vercel stays for design previews only.

| Item | Value |
|---|---|
| Public URL | `https://roys-staging.autrex.ca/` (Cloudflare proxied, tunnel `da509a1d-…`) |
| VM | Proxmox **459** `roysauto-staging`, node0, `node0-db-ssd`, protection on, guest agent on |
| LAN | `192.168.88.250/24` static (netplan), `vmbr0`, gw `.1` |
| OS / runtime | Ubuntu 24.04 (template 800), Node 22 (NodeSource), nginx |
| Catalog upstream | `http://192.168.88.233/api/erp` (VM 453 staging gateway, LAN, read only) |
| Non-production | Yes. No secrets on the host; checkout and payments stay disabled. |

## Request path

```
visitor -> Cloudflare edge (TLS, *.autrex.ca)
        -> cloudflared on node0 (.253) / node1 (.252)  ingress: roys-staging.autrex.ca -> http://192.168.88.250
        -> nginx :80 on VM 459   static dist/ + /api/catalog, /healthz -> 127.0.0.1:3201
        -> roysauto-staging.service (node server/onprem-server.ts)
        -> http://192.168.88.233/api/erp (VM 453 gateway, LAN) -> ERP staging
```

## Layout on the VM (same shape as VM 453)

```
/opt/roysauto/staging/
  releases/<sha12>/{dist/, server/, package.json, REVISION, REVISION_FULL}   (owner roysdeploy)
  current -> releases/<sha12>
  shared/roysauto.env        non-secret settings only (owner root, 0644)
/var/log/roysauto/staging/{api.log, api.err.log}    (logrotate weekly x8)
```

- `roys`: system user, runs the service, no shell.
- `roysdeploy`: GitHub Actions runner (`~/actions-runner`, label `roysauto-staging`)
  and release publisher. sudo is limited to
  `systemctl restart|status|is-active roysauto-staging.service`
  (`/etc/sudoers.d/roysauto-staging-deploy`).

`shared/roysauto.env`:

```
NODE_ENV=production
ROYS_ONPREM=1
ROYS_CATALOG_PREVIEW_ENABLED=true
ROYS_CATALOG_UPSTREAM=http://192.168.88.233/api/erp
```

`ROYS_CATALOG_UPSTREAM` is informational; the proxy's upstream stays a fixed
constant in `server/catalog-proxy.ts` (selected by `ROYS_ONPREM=1`).

## Files in this folder (installed by infra, not by CI)

- `roysauto-staging.service` -> `/etc/systemd/system/`
- `nginx-roysauto-staging.conf` -> `/etc/nginx/sites-available/roysauto-staging`,
  symlinked in `sites-enabled` (the default site removed).

After changing either: `nginx -t && systemctl reload nginx`, or
`systemctl daemon-reload && systemctl restart roysauto-staging`.

## Deploy

`.github/workflows/deploy-onprem-staging.yml`, on push to `staging` or manual
dispatch: `npm ci`, tests, build, publish `releases/<sha12>`, flip `current`,
restart, smoke `/healthz` (revision), `/` (app shell) and
`/api/catalog?resource=years` (required once the catalog gate is open). A failed
smoke re-points `current` at the previous release and restarts. Keeps current plus
three older releases.

**Public repo rule:** the runner is self-hosted on this VM. Only `push`/
`workflow_dispatch` jobs may target `roysauto-staging`; never `pull_request`.
Fork-PR workflow approval is set to "all external contributors".

## Manual rollback

```
vm-exec 459 -- bash -c 'ls -1t /opt/roysauto/staging/releases'
vm-exec 459 -- bash -c 'ln -sfnT /opt/roysauto/staging/releases/<sha12> /opt/roysauto/staging/current && systemctl restart roysauto-staging'
```

## Public route (infra)

Both tunnel connectors carry the same rule in `/etc/cloudflared/config.yml`,
before the catch-all:

```yaml
  - hostname: roys-staging.autrex.ca
    service: http://192.168.88.250
    originRequest:
      httpHostHeader: roys-staging.autrex.ca
```

Apply one connector at a time (`cloudflared tunnel --config … ingress validate`,
restart, check, then the other). DNS: proxied `CNAME roys-staging ->
da509a1d-9545-4f47-acb3-bbd2c6d3de49.cfargotunnel.com`.

## Proposed environment split (not done here)

Today `staging` is both the integration branch and the only on-prem site. When a
second environment is wanted, mirror capautov3: `staging` -> `roys-staging`
(integration), `main` -> a release-candidate site, `production` -> live, each a
separate service root and host name. Until Brian opens checkout, there is no
production target.

# Reverse Cloud Compose hosting

This directory contains the server control plane for the Ubuntu laptop preview:

- `docker-compose.yml` defines pinned Ollama and Cloudflared services plus
  commit-tagged web and FastAPI AI services.
- `deploy.sh` polls GitHub `Dev` through SSH, tests AI and web candidates on
  ports 8001 and 3001, synchronizes public AI knowledge, deploys on ports 8000
  and 3000, and rolls back a failed replacement.

Installed server root: `/home/nafz/reverse-cloud-hosting`.

The server-only files `secrets/web.env`, `.deploy.env`, `state/`, `logs/`, and
`repository/` are intentionally not stored in this repository. Operational
commands and the named Cloudflare Tunnel lifecycle are documented in
[`HOSTING_PREVIEW.md`](../../HOSTING_PREVIEW.md).

After the activity logger is deployed, stream page visits, clicks, form
actions, API results, and browser errors on the main PC with:

```sh
./ops/hosting/watch-activity.sh
```

Press `Ctrl+C` to stop watching. This does not stop the website.

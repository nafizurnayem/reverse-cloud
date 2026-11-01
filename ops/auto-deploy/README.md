# Reverse Cloud automatic Dev deployment

The server checks the private GitHub `Dev` branch once per minute. A new commit
is built as a commit-tagged Docker image and tested on `127.0.0.1:3001`. Only a
healthy candidate replaces `reverse-cloud-web` on port 3000. The previous
container is retained during the switch and restored if the new container
fails its live health check.

## GitHub access

The server uses a repository-specific, read-only deploy key:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIWNG7W2PbcC3+/Pgcw28NqRCIGhFWyyRnGsGdbfLjJI reverse-cloud-auto-deploy
```

Add it at `Repository settings -> Deploy keys -> Add deploy key`. Name it
`Reverse Cloud server read-only` and leave **Allow write access** unchecked.

## Server locations

- Deployment program: `/home/nafz/bin/reverse-cloud-auto-deploy`
- Dedicated Git checkout: `/home/nafz/reverse-cloud-auto/repository`
- Last deployed Dev commit: `/home/nafz/reverse-cloud-auto/deployed-dev-sha`
- Deployment log: `/home/nafz/reverse-cloud-auto/deploy.log`
- Existing private environment: `/home/nafz/reverse-cloud-preview/apps/web/.env.local`

The initial state is set to the current remote `Dev` commit without deploying
it. This prevents installation from downgrading the currently running preview.
The first automatic deployment happens after the next commit reaches `Dev`.

## Operations

```sh
tail -f /home/nafz/reverse-cloud-auto/deploy.log
/home/nafz/bin/reverse-cloud-auto-deploy
docker ps --filter name=reverse-cloud-web
curl -fsS http://127.0.0.1:3000/api/health
```

The cron job is protected by `flock`, so a long build cannot overlap the next
one-minute check. A failed build or candidate health check never stops the live
container.

## Security and release rules

- Protect `Dev` and require pull-request review and passing CI before merge.
- Anyone allowed to merge executable code into `Dev` can affect this laptop.
- Keep `.env.local` off Git. The Docker build receives it as a BuildKit secret.
- Do not put a GitHub personal token on the server; the deploy key is read-only.
- Database migrations are not run automatically. Apply and review Supabase
  migrations separately and keep application changes backward-compatible.
- A Cloudflare Quick Tunnel address can change after its container restarts.
  This deployment job does not restart the tunnel or Ollama containers.


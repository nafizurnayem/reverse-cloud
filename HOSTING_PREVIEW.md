# Ubuntu laptop hosting preview

The preview is managed as one Docker Compose project on the Ubuntu laptop.
GitHub `Dev` is the only source of application code; do not copy or `rsync`
source files into the server checkout.

For a complete first-time setup, manual deployment, monitoring, and recovery
runbook, see [`MANUAL_HOSTING_GUIDE.md`](MANUAL_HOSTING_GUIDE.md).

Permanent public link:
https://reverse-cloud.dev/

The site uses the local `llama3.2:1b` Ollama model and public-catalog keyword
retrieval. It does not use the separate AI service, vector database, or private
knowledge documents. The origin remains the self-hosted Ubuntu laptop.

## Server layout

Everything is under one root:

```text
/home/nafz/reverse-cloud-hosting/
├── docker-compose.yml       # web, Ollama, and Cloudflare Tunnel
├── deploy.sh                # GitHub Dev fetch/build/health-check/rollback
├── .deploy.env              # generated image tag and public origin
├── repository/              # clean Git checkout of GitHub Dev
├── secrets/web.env          # private web environment, mode 600
├── secrets/cloudflare-tunnel-token # named-tunnel token, mode 600
├── state/deployed-dev-sha   # exact live Dev commit
└── logs/deploy.log          # automatic and manual deployment log
```

The removed `/home/nafz/reverse-cloud-preview` and
`/home/nafz/reverse-cloud-auto` trees are obsolete and must not be recreated.
The Ollama model is stored in the external Docker volume
`hosting_ollama_models`.

## How the containers connect

- `reverse-cloud-web` uses host networking and listens only on
  `127.0.0.1:3000`.
- `reverse-cloud-ollama` publishes port 11434 only on `127.0.0.1` and retains
  models in `hosting_ollama_models`.
- `reverse-cloud-tunnel` uses a named Cloudflare Tunnel and proxies
  `https://reverse-cloud.dev` to `http://127.0.0.1:3000` over HTTP/2.
- The router requires no port forwarding. Cloudflare is the only public entry
  point.

The Compose file pins the Ollama and Cloudflared image digests. The web image
is tagged with the full GitHub commit SHA, for example
`reverse-cloud-preview:8c74084...`.

## Connect and check

From the PC:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34
```

On the server:

```sh
cd /home/nafz/reverse-cloud-hosting
docker compose --env-file .deploy.env ps
cat state/deployed-dev-sha
docker inspect --format='{{.Config.Image}}' reverse-cloud-web
curl -fsS http://127.0.0.1:3000/api/health
docker exec reverse-cloud-ollama ollama list
docker logs --tail 60 reverse-cloud-tunnel
```

The state SHA, GitHub `Dev` SHA, checkout SHA, and live image tag should be
identical. Keep the laptop powered, awake, and connected to the router.

## Automatic updates from GitHub Dev

The server checks GitHub `Dev` once per minute. GitHub access uses the read-only
deploy key through `ssh.github.com:443` because this network blocks SSH port 22.

For every new SHA, `deploy.sh`:

1. Fetches and checks out the exact `Dev` commit.
2. Builds `reverse-cloud-preview:<full-sha>` with the environment mounted as a
   BuildKit secret.
3. Starts a candidate on `127.0.0.1:3001`.
4. Leaves the live site unchanged if the candidate health check fails.
5. Recreates only the web service and checks port 3000.
6. Restores the previous Compose image if the live health check fails.
7. Writes `state/deployed-dev-sha` only after success.

Watch deployments:

```sh
tail -f /home/nafz/reverse-cloud-hosting/logs/deploy.log
```

Check the cron entry:

```sh
crontab -l
```

It should contain:

```cron
* * * * * /home/nafz/reverse-cloud-hosting/deploy.sh >> /home/nafz/reverse-cloud-hosting/logs/deploy.log 2>&1
```

## Manual update

First commit and merge or push the desired code to GitHub `Dev`. Then run the
same safe deployment program used by cron:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh
```

Use a forced, no-cache rebuild only after changing the server environment or
public origin without changing the Git commit:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh --force
```

Never manually build a `:local` image or replace `reverse-cloud-web` with
`docker run`; that bypasses commit tracking and rollback.

## Private environment and tunnel credential

The only server environment file is:

```text
/home/nafz/reverse-cloud-hosting/secrets/web.env
```

It must remain mode `600`, must never be committed, and must not be replaced by
the PC's localhost environment. After editing it, run `deploy.sh --force` so
public Next.js variables are rebuilt into the image.

The named-tunnel credential is:

```text
/home/nafz/reverse-cloud-hosting/secrets/cloudflare-tunnel-token
```

It must also remain mode `600`. Anyone with this token can connect a replica to
the tunnel, so rotate it in Cloudflare immediately if it is exposed.

## Named Cloudflare Tunnel lifecycle

The named tunnel keeps the stable `reverse-cloud.dev` hostname across container
and server restarts. Restarting it does not create a new public URL.

Stop or start public access without stopping the local web application:

```sh
cd /home/nafz/reverse-cloud-hosting
docker compose --env-file .deploy.env stop tunnel
docker compose --env-file .deploy.env start tunnel
docker logs --tail 80 reverse-cloud-tunnel
```

If Cloudflare reports the tunnel token as invalid, rotate the tunnel token in
the dashboard, replace the server token file, and recreate only the tunnel
service. Do not delete the tunnel or its DNS record during normal recovery.

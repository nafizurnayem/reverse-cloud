# Reverse Cloud manual hosting and operations guide

This runbook explains how to host the Reverse Cloud website manually on an
Ubuntu computer, deploy code from the GitHub `Dev` branch, publish it through a
Cloudflare Tunnel, monitor it from another PC, and recover common failures.

The intended server is currently:

```text
SSH user:     nafz
Server IP:    192.168.6.34
Hosting root: /home/nafz/reverse-cloud-hosting
```

Replace these example values if the server, username, or address changes.

The public origin is the named Cloudflare Tunnel at
`https://reverse-cloud.dev`. Container and server restarts do not change this
hostname.

## 1. Understand the hosting layout

The hosting stack has six Docker containers:

| Container | Purpose | Network exposure |
| --- | --- | --- |
| `reverse-cloud-web` | Next.js website | `127.0.0.1:3000` only |
| `reverse-cloud-ai` | Guarded FastAPI agent, tools, RAG, and chat persistence | `127.0.0.1:8000` only |
| `reverse-cloud-knowledge-sync` | Refreshes public website knowledge every five minutes | Host network; no listening port |
| `reverse-cloud-ai-monitor` | Records daily token usage and sends threshold alerts | Host network; no listening port |
| `reverse-cloud-ollama` | Local `llama3.2:3b` model | `127.0.0.1:11434` only |
| `reverse-cloud-tunnel` | Cloudflare HTTPS tunnel to the web container | Outbound connection only |

GitHub `Dev` is the only source of application code. Do not manually copy
source files into the server repository. The deployment script builds an image
tagged with the exact Git commit, tests a candidate on port 3001, and switches
the live container only after the candidate passes its health check.

The server filesystem should look like this:

```text
/home/nafz/reverse-cloud-hosting/
├── docker-compose.yml
├── deploy.sh
├── .deploy.env
├── repository/
├── secrets/
│   ├── web.env
│   └── cloudflare-tunnel-token
├── state/
│   └── deployed-dev-sha
└── logs/
    └── deploy.log
```

The old `reverse-cloud-preview` and `reverse-cloud-auto` directories are
obsolete and must not be recreated.

## 2. Prepare the Ubuntu server

Keep the hosting computer powered on, connected to the network, and prevented
from sleeping. The router does not require port forwarding because the tunnel
makes an outbound connection to Cloudflare.

The server requires:

- Docker Engine and the Docker Compose v2 plugin
- Git
- `curl`
- OpenSSH client and server
- `flock`, normally provided by `util-linux`

On Ubuntu, install the missing base packages with:

```sh
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git curl openssh-client openssh-server util-linux
sudo systemctl enable --now docker ssh
sudo usermod -aG docker "$USER"
```

If the Ubuntu release does not provide `docker-compose-v2`, install Docker
Engine and the Compose plugin from Docker's official Ubuntu repository. Log out
and back in after adding the user to the `docker` group.

Verify the tools:

```sh
docker --version
docker compose version
git --version
curl --version
```

## 3. Connect to the server from the PC

Run this on the main PC:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34
```

All commands marked **on the server** in this guide are run inside that SSH
session.

## 4. Create a read-only GitHub deploy key

On the server, create a key used only for this repository:

```sh
install -d -m 700 /home/nafz/.ssh
ssh-keygen -t ed25519 -f /home/nafz/.ssh/reverse_cloud_deploy -C reverse-cloud-hosting
chmod 600 /home/nafz/.ssh/reverse_cloud_deploy
chmod 644 /home/nafz/.ssh/reverse_cloud_deploy.pub
cat /home/nafz/.ssh/reverse_cloud_deploy.pub
```

Copy the printed public key. In GitHub, open the Reverse Cloud repository and
go to **Settings → Deploy keys → Add deploy key**. Add it without enabling
write access.

This server uses GitHub's standard SSH endpoint on port 22. Add GitHub's host
key after comparing its fingerprint with the fingerprint published in
GitHub's official documentation:

```sh
ssh-keyscan github.com >> /home/nafz/.ssh/known_hosts
chmod 600 /home/nafz/.ssh/known_hosts
```

Test read-only access:

```sh
GIT_SSH_COMMAND='ssh -i /home/nafz/.ssh/reverse_cloud_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes' \
  git ls-remote git@github.com:nafizurnayem/reverse-cloud.git refs/heads/Dev
```

The result should contain one 40-character Git commit SHA followed by
`refs/heads/Dev`.

## 5. Create the hosting directories

On the server:

```sh
install -d -m 700 /home/nafz/reverse-cloud-hosting
install -d -m 700 /home/nafz/reverse-cloud-hosting/secrets
install -d -m 700 /home/nafz/reverse-cloud-hosting/state
install -d -m 700 /home/nafz/reverse-cloud-hosting/logs
```

On the main PC, from the repository root, upload the two control files:

```sh
scp -i /home/nafiz/.ssh/satellite_c50_hosting \
  ops/hosting/docker-compose.yml \
  ops/hosting/deploy.sh \
  nafz@192.168.6.34:/home/nafz/reverse-cloud-hosting/
```

Then set their permissions on the server:

```sh
chmod 600 /home/nafz/reverse-cloud-hosting/docker-compose.yml
chmod 700 /home/nafz/reverse-cloud-hosting/deploy.sh
```

Upload a blank environment template from the PC:

```sh
scp -i /home/nafiz/.ssh/satellite_c50_hosting \
  .env.example \
  nafz@192.168.6.34:/home/nafz/reverse-cloud-hosting/secrets/web.env
```

Protect it immediately on the server:

```sh
chmod 600 /home/nafz/reverse-cloud-hosting/secrets/web.env
```

## 6. Configure the private environment

Edit the server-only file:

```sh
nano /home/nafz/reverse-cloud-hosting/secrets/web.env
```

Never commit this file or paste its secret values into logs, issues, or chat.
Do not replace it with a development file that contains localhost URLs.

Use the permanent exact HTTPS origin:

```dotenv
NEXT_PUBLIC_SITE_URL=https://reverse-cloud.dev
TURNSTILE_EXPECTED_HOSTNAME=reverse-cloud.dev
```

Configure the remaining values needed by the enabled website features:

| Feature | Environment variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Chat/session security | `CHAT_COOKIE_SECRET`, `AI_HMAC_SECRET_CURRENT`, `AI_HMAC_SECRET_PREVIOUS`, `RATE_LIMIT_SALT` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Cloudflare Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME` |
| Scheduling | `CALCOM_API_KEY`, `CALCOM_API_BASE_URL`, API versions, and webhook secrets |
| Notifications | Resend/email variables and/or Telegram variables |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| AI agent | `DATABASE_URL_AI`, `AI_HMAC_SECRET_CURRENT`, `AI_DAILY_TOKEN_BUDGET`; provider keys are optional because hosting uses Ollama |

`DATABASE_URL_AI` must be a Postgres connection string for the least-privilege
`ai_service` role, not the public Supabase URL and not the service-role API key.
After applying all repository migrations to Supabase, generate a unique
database password and run the following once in the Supabase SQL editor,
substituting the generated value:

```sql
alter role ai_service login password 'GENERATED_AI_DATABASE_PASSWORD';
```

Then copy the Supabase session-pooler connection string, change its username to
the project-qualified `ai_service` username required by the pooler, insert that
password, and save the result as `DATABASE_URL_AI` in `web.env`. Use the exact
host, port, and project reference shown by **Supabase → Connect**; do not guess
them. Apply migration `0036_public_ai_knowledge.sql` before starting the AI
service so retrieval can only return explicitly public knowledge.

The Compose setup supplies the internal AI URL to the web container and the
local Ollama URL/model names to the private FastAPI AI container. Do not set
`LOCAL_OLLAMA_PREVIEW=true` on hosting; that bypasses the agent guardrails,
tools, RAG, usage accounting, and chat persistence.

Generate independent random server secrets when required:

```sh
openssl rand -hex 32
```

Run the command separately for each secret. Do not reuse one value for several
security variables.

Confirm permissions without displaying the contents:

```sh
stat -c '%a %U:%G %n' /home/nafz/reverse-cloud-hosting/secrets/web.env
```

The mode should be `600`.

## 7. Perform the first local deployment

Create the external Ollama model volume once:

```sh
docker volume create hosting_ollama_models
```

Run the safe deployment script:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh --force
```

The first run will:

1. Clone the GitHub `Dev` branch.
2. Build web and AI images tagged with the full Git commit SHA.
3. Start Ollama and download the configured chat and embedding models.
4. Test a candidate AI service on `127.0.0.1:8001`.
5. Synchronize published website content and run the live AI regression smoke test.
6. Test a candidate website on `127.0.0.1:3001`.
7. Start the AI service, knowledge sync, budget monitor, and website only after
   every candidate check succeeds.

Download the configured local model:

```sh
docker exec reverse-cloud-ollama ollama pull llama3.2:3b
docker exec reverse-cloud-ollama ollama list
```

Test the local website before publishing it:

```sh
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:8000/ready
```

## 8. Create and start the named Cloudflare Tunnel

In the Cloudflare dashboard, go to **Networking → Tunnels**, create a
Cloudflared tunnel named `reverse-cloud-production`, and choose Docker as the
connector type. The Docker command shown by Cloudflare contains the tunnel
token. Do not paste that token into chat, source code, or documentation.

Store the token through an interactive SSH session so it is not echoed:

```sh
umask 077
read -rsp 'Cloudflare tunnel token: ' CLOUDFLARE_TUNNEL_TOKEN
printf '%s' "$CLOUDFLARE_TUNNEL_TOKEN" > /home/nafz/reverse-cloud-hosting/secrets/cloudflare-tunnel-token
unset CLOUDFLARE_TUNNEL_TOKEN
printf '\n'
chmod 600 /home/nafz/reverse-cloud-hosting/secrets/cloudflare-tunnel-token
```

In the tunnel's **Published application routes**, add:

| Setting | Value |
| --- | --- |
| Hostname | `reverse-cloud.dev` |
| Service type | `HTTP` |
| Service URL | `localhost:3000` |

Cloudflare automatically creates the proxied DNS record pointing the hostname
to the named tunnel. Do not create an A record pointing at the home network.

Start the connector on the server:

```sh
cd /home/nafz/reverse-cloud-hosting
docker compose --env-file .deploy.env up -d tunnel
docker logs --tail 100 reverse-cloud-tunnel
```

The logs should show registered tunnel connections. The token file is mounted
read-only and the container runs as the unprivileged hosting user.

In the Cloudflare Turnstile dashboard, allow `reverse-cloud.dev`. Turnstile
error `110200` means this hostname is not authorized for the selected site key.

Update Supabase Authentication URL Configuration:

- Site URL: `https://reverse-cloud.dev`
- Redirect URL: `https://reverse-cloud.dev/en/auth/callback`
- Redirect URL: `https://reverse-cloud.dev/bn/auth/callback`

Run a forced rebuild after setting the permanent origin:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh --force
```

Verify from the main PC:

```sh
curl -I https://reverse-cloud.dev/
curl -fsS https://reverse-cloud.dev/api/health
```

Finally test login, Turnstile-protected forms, scheduling, email/Telegram
notifications, and chat in a browser.

## 9. Enable automatic updates from GitHub `Dev`

Open the server user's crontab:

```sh
crontab -e
```

Add exactly this line:

```cron
* * * * * /home/nafz/reverse-cloud-hosting/deploy.sh >> /home/nafz/reverse-cloud-hosting/logs/deploy.log 2>&1
```

Confirm it:

```sh
crontab -l
```

Every minute, the script checks the GitHub `Dev` branch. If the commit did not
change and the live container is healthy, it exits without rebuilding. If a
new commit exists, it builds and tests that exact commit before changing the
live website.

## 10. Deploy an update manually

First commit the desired code and push or merge it into GitHub `Dev`. Then run
on the server:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh
```

Use a forced, no-cache build only when the Git commit has not changed but a
server environment value or public origin has changed:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh --force
```

Do not manually build a `:local` image, edit the server checkout, or replace
the website with a standalone `docker run`. Those actions bypass commit
tracking, candidate checks, and rollback.

## 11. View logs from the main PC

These commands connect over SSH and stream logs directly to the PC. Press
`Ctrl+C` to stop viewing; this does not stop the website.

Website application logs:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  'docker logs --follow --tail 200 --timestamps reverse-cloud-web'
```

Show only the live website activity stream (page visits, clicks, form actions,
API results, and browser errors):

```sh
./ops/hosting/watch-activity.sh
```

The helper runs this equivalent SSH command:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  "docker logs --follow --tail 200 --timestamps reverse-cloud-web 2>&1 | grep --line-buffered '\[activity\]'"
```

Each line has an anonymous browser-session ID so simultaneous visitors can be
distinguished. Activity logging intentionally excludes passwords, field
contents, emails, phone numbers, messages, Turnstile tokens, and API bodies.

Deployment and GitHub update logs:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  'tail -n 200 -F /home/nafz/reverse-cloud-hosting/logs/deploy.log'
```

Cloudflare Tunnel logs and reconnect events:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  'docker logs --follow --tail 200 --timestamps reverse-cloud-tunnel'
```

Ollama logs:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  'docker logs --follow --tail 200 --timestamps reverse-cloud-ollama'
```

All Compose service logs together:

```sh
ssh -t -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  'cd /home/nafz/reverse-cloud-hosting && docker compose --env-file .deploy.env logs --follow --tail 100'
```

Show only recent errors from the website:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34 \
  "docker logs --since 1h reverse-cloud-web 2>&1 | grep -Ei 'error|failed|exception|fatal'"
```

## 12. Check health, status, and the live code version

On the server:

```sh
cd /home/nafz/reverse-cloud-hosting
docker compose --env-file .deploy.env ps
curl -fsS http://127.0.0.1:3000/api/health
docker exec reverse-cloud-ollama ollama list
cat state/deployed-dev-sha
git -C repository rev-parse HEAD
docker inspect --format='{{.Config.Image}}' reverse-cloud-web
```

The following values should identify the same commit:

- `state/deployed-dev-sha`
- `repository` checkout SHA
- The SHA at the end of the `reverse-cloud-web` image tag
- GitHub `Dev` after the latest successful deployment

Monitor container CPU and memory:

```sh
docker stats reverse-cloud-web reverse-cloud-ollama reverse-cloud-tunnel
```

Check free disk space and Docker storage usage:

```sh
df -h
docker system df
```

## 13. Start, stop, and restart services

From the hosting root:

```sh
cd /home/nafz/reverse-cloud-hosting
```

Stop or start public access while leaving the local website running:

```sh
docker compose --env-file .deploy.env stop tunnel
docker compose --env-file .deploy.env start tunnel
```

Stop or start the whole stack:

```sh
docker compose --env-file .deploy.env stop
docker compose --env-file .deploy.env start
```

Restart only the web container:

```sh
docker compose --env-file .deploy.env restart web
```

Avoid `docker compose down -v`. The `-v` flag can delete Docker volumes. The
Ollama model volume is deliberately external, but destructive volume commands
should still not be part of normal operation.

## 14. Recover the named tunnel

The public hostname remains `reverse-cloud.dev`. If Cloudflare returns a tunnel
error, check:

```sh
docker ps --filter name=reverse-cloud-tunnel
docker logs --tail 100 reverse-cloud-tunnel
curl -fsS http://127.0.0.1:3000/api/health
```

If the local health endpoint works but the public URL does not, the problem is
normally the named connector, tunnel route, or DNS record. Restart only the
tunnel first:

```sh
cd /home/nafz/reverse-cloud-hosting
docker compose --env-file .deploy.env restart tunnel
docker logs --tail 100 reverse-cloud-tunnel
```

If the token is rejected, rotate it in **Networking → Tunnels**, securely
replace `secrets/cloudflare-tunnel-token`, and recreate only the tunnel service.

## 15. Troubleshooting

### Deployment does not see a new GitHub commit

```sh
crontab -l
tail -n 100 /home/nafz/reverse-cloud-hosting/logs/deploy.log
/home/nafz/reverse-cloud-hosting/deploy.sh
```

If GitHub SSH port 22 times out, do not change the deployment to port 22. The
script intentionally uses `ssh.github.com:443`.

### Candidate health check fails

The script leaves the existing live website unchanged. Review the deployment
log and candidate output, then fix the code or environment and push a new
`Dev` commit:

```sh
tail -n 200 /home/nafz/reverse-cloud-hosting/logs/deploy.log
docker logs --tail 200 reverse-cloud-web
```

### Website is healthy locally but unavailable publicly

```sh
curl -fsS http://127.0.0.1:3000/api/health
docker compose --env-file /home/nafz/reverse-cloud-hosting/.deploy.env \
  -f /home/nafz/reverse-cloud-hosting/docker-compose.yml ps
docker logs --tail 100 reverse-cloud-tunnel
```

If local health works, follow the named-tunnel recovery steps in section 14.

### Cloudflare verification displays error `110200`

The Turnstile widget does not allow the current hostname. Confirm all three
items use the same host:

1. The hostname in the browser URL.
2. `TURNSTILE_EXPECTED_HOSTNAME` in `secrets/web.env`.
3. The allowed hostname in the Cloudflare Turnstile widget.

Then run:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh --force
```

### Scheduling remains on “Loading available slots”

Check website logs and verify the Cal.com API key, API base URL, API versions,
event configuration, and webhook secrets in `secrets/web.env`. After changing
the environment, run `deploy.sh --force`.

### Chat does not answer

```sh
docker exec reverse-cloud-ollama ollama list
curl -fsS http://127.0.0.1:11434/api/tags
docker logs --tail 200 reverse-cloud-ollama
docker logs --tail 200 reverse-cloud-web
```

If the model is missing:

```sh
docker exec reverse-cloud-ollama ollama pull llama3.2:3b
```

### The live image and state SHA do not match

Run the normal deployment program to restore a tracked state:

```sh
/home/nafz/reverse-cloud-hosting/deploy.sh
```

Use `--force` only if the same commit must be rebuilt.

## 16. Backups and security checklist

- Keep `secrets/web.env` mode `600` and back it up to an encrypted location.
- Keep `secrets/cloudflare-tunnel-token` mode `600`; rotate it immediately if
  exposed.
- Keep the GitHub deploy key read-only and dedicated to this repository.
- Never commit `.deploy.env`, `secrets/`, server logs, or private keys.
- Keep ports 3000 and 11434 bound to loopback, not `0.0.0.0`.
- Do not forward application ports on the router for this setup.
- Keep Ubuntu and Docker security updates current.
- Treat Cloudflare, Supabase, Cal.com, email, Telegram, Google, and Redis keys as
  secrets; rotate any value that is exposed.
- Back up persistent application data at its real owner. For this preview,
  Supabase data is backed up in Supabase; Ollama models can be downloaded again.
- Never use `docker system prune --volumes` or remove
  `hosting_ollama_models` unless model data deletion is intentional.

## 17. Normal operating routine

For day-to-day work:

1. Develop and test on the PC.
2. Commit and push or merge the change into GitHub `Dev`.
3. Watch `logs/deploy.log` from the PC.
4. Confirm the deployed SHA and container health.
5. Test the public health endpoint and affected website feature.
6. If only a server secret or URL changed, edit `secrets/web.env` and run
   `deploy.sh --force`.

This keeps the GitHub branch, server checkout, Docker image, and recorded live
SHA synchronized and makes failed releases recoverable.

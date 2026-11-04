# Ubuntu laptop hosting preview

This deployment uses the local `hosting-preview-current` checkout with the
auth and lightweight public-content retrieval fixes. The temporary website
uses Ollama with keyword retrieval from its published service, portfolio, and
blog catalogs; it does not use the separate AI service, vector database, or
private knowledge documents. The site runs on the server laptop at
`127.0.0.1:3000`; Ollama runs at `127.0.0.1:11434`. Only Cloudflare Tunnel is
public. The router does not need port forwarding.

Current public link (temporary):
https://likely-eve-cleanup-admissions.trycloudflare.com/

Cloudflare Quick Tunnel can change this address after a restart. It has no
uptime guarantee and does not support Server-Sent Events, so preview chat
returns one complete reply instead of streaming. The preview runs
`llama3.2:1b`, allows five chat requests per IP per minute, and processes one
generation at a time. Do not use this as production hosting.

The tunnel is forced to HTTP/2 because this network intermittently drops QUIC.
Build `ops/cloudflared/Dockerfile`, then run it with
`tunnel --protocol http2 --metrics 127.0.0.1:2000 --no-autoupdate
--url http://127.0.0.1:3000`. The image health check uses Cloudflared's `/ready`
endpoint; Docker health status is monitoring only and does not recreate the
temporary tunnel URL.

## Connect and check

From the PC:

```sh
ssh -i /home/nafiz/.ssh/satellite_c50_hosting nafz@192.168.6.34
```

On the server:

```sh
docker ps --filter name=reverse-cloud-web --filter name=hosting-ollama --filter name=reverse-cloud-tunnel
curl -i http://127.0.0.1:3000/api/health
docker exec hosting-ollama ollama list
docker logs --tail 50 reverse-cloud-web
docker logs --tail 50 reverse-cloud-tunnel
```

Keep the laptop powered, awake, and connected to the router. If its LAN address
changes, use `hostname -I` on the server to find the new address. A DHCP
reservation on the router can keep the address stable.

## Update the website

Edit and test this PC checkout first. The private environment file is
`apps/web/.env.local`; it is gitignored and must never be committed. The PC's
copy uses `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; the server's copy uses
the current HTTPS tunnel URL for Google sign-in. Do not overwrite the server's
copy with the PC's copy unless you adjust that setting. Sync the source from
the PC, excluding local build products and secrets:

```sh
rsync -az --exclude .git --exclude node_modules --exclude .next --exclude '.env*' \
  /home/nafiz/Documents/ChatGPT/Nafizur/reverse-cloud/ \
  nafz@192.168.6.34:/home/nafz/reverse-cloud-preview/
```

The SSH command above uses a dedicated key; if `rsync` asks for a password,
set `RSYNC_RSH='ssh -i /home/nafiz/.ssh/satellite_c50_hosting'` for that command.
Transfer `.env.local` separately only if it changed, then set its permissions
to `600` on the server. If only the server environment file changes, build with
`--no-cache` because Docker does not invalidate a cached build step when its
secret contents change.

On the server, build using a Docker secret so `.env.local` is not copied into
the image:

```sh
cd /home/nafz/reverse-cloud-preview
DOCKER_BUILDKIT=1 docker build \
  --secret id=web_env,src=/home/nafz/reverse-cloud-preview/apps/web/.env.local \
  -f Dockerfile.preview -t reverse-cloud-preview:local .
```

After a successful build, replace only the website container. Use the current
Quick Tunnel URL in `TRUSTED_PUBLIC_ORIGINS`:

```sh
docker stop reverse-cloud-web
docker rm reverse-cloud-web
docker run -d --name reverse-cloud-web --restart unless-stopped --network host \
  --mount type=bind,src=/home/nafz/reverse-cloud-preview/apps/web/.env.local,dst=/app/apps/web/.env.local,readonly \
  -e LOCAL_OLLAMA_PREVIEW=true \
  -e OLLAMA_URL=http://127.0.0.1:11434 \
  -e OLLAMA_MODEL=llama3.2:1b \
  -e TRUSTED_PUBLIC_ORIGINS=https://likely-eve-cleanup-admissions.trycloudflare.com \
  reverse-cloud-preview:local
```

Check `/`, `/api/health`, and `/api/chat` after every update. The source changes
in this checkout are not pushed to GitHub automatically.

## Tunnel lifecycle

To stop public access without stopping the local website:

```sh
docker stop reverse-cloud-tunnel
```

To resume, run `docker start reverse-cloud-tunnel` and read
`docker logs --tail 60 reverse-cloud-tunnel`. A new `trycloudflare.com` link
may appear. If it does, set the server's `NEXT_PUBLIC_SITE_URL` to the new
HTTPS origin, rebuild with `--no-cache`, and replace the website container with
the new URL in `TRUSTED_PUBLIC_ORIGINS`. Update Supabase Authentication → URL
Configuration: Site URL and the exact `/en/auth/callback` and
`/bn/auth/callback` Redirect URLs. Otherwise Google login may return to the
old address. You can always use `http://127.0.0.1:3000/en` on the server while
the tunnel is stopped.

For a stable address later, get a domain and a named Cloudflare Tunnel. Set
`NEXT_PUBLIC_SITE_URL` to that HTTPS origin before rebuilding; update your
authentication provider's allowed redirect URLs; then test login, forms, and
chat. Keep Ollama on localhost, use a persistent rate-limit store, add backups,
and monitor the laptop before calling it production.

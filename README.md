# Expensy

A small self-hosted expense tracker. Add expenses (amount, categories, optional note, photo and location), see the
total and simple statistics, and "settle up" to move the current list to an archive. Works as a web app on the phone
home screen. English and Polish. An expense can be entered in another currency; it's converted to the app's
currency with the daily ECB rate (via [Frankfurter](https://frankfurter.dev)).

> This project was written entirely with AI, for my own personal use. No support, no guarantees.

## Docker

Build and run from the source:

```bash
docker compose up -d --build
```

Or use the published image. Pushing a version tag (`git tag 1.0 && git push origin 1.0`) builds it with GitHub
Actions and publishes `ghcr.io/<owner>/<repo>:1.0` and `:latest` (amd64 and arm64). On the server, replace
`build: .` and `image:` in `docker-compose.yml` with:

```yaml
    image: ghcr.io/<owner>/<repo>:latest
```

and run `docker compose pull && docker compose up -d`. If the repository is private, log in first with
`docker login ghcr.io` (a GitHub token with `read:packages`), or make the package public in its GitHub settings.

The app runs on port 8080. On first start it asks you to create the admin account. The version is shown at the
bottom of Settings.

Location access and installing to the home screen need HTTPS, so put it behind a reverse proxy (Caddy, Tailscale,
etc.).

## Options

Set in `docker-compose.yml` (or a `.env` file next to it):

| Option | Default | |
|---|---|---|
| `PUID` / `PGID` | `1000` / `1000` | User and group the app runs as. |
| `EXPENSY_GEOCODING` | `true` in the compose file | Place names and mini maps from OpenStreetMap. |
| `EXPENSY_BACKUP` | `7` in the compose file | Daily CSV export of all expenses at midnight to `/data/backups`, keeping the last N days. `0` turns it off. |
| `EXPENSY_TRUSTED_PROXIES` | private networks | Reverse proxies allowed to set `X-Forwarded-*` headers. |
| `TZ` | `Europe/Warsaw` | Time zone. |

Data (SQLite database and photos) is stored in `/data` in the container, a named volume by default. To use a host
directory, map it to `/data` and make it writable for `PUID:PGID`.

Forgot the admin password: `docker exec expensy dotnet Expensy.dll reset-password admin`.

## Development

```bash
dotnet run --project src/Expensy --urls http://localhost:5110
```

Requires the .NET 11 SDK.

## License

MIT, see [LICENSE](LICENSE).

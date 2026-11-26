# ---- build ----
# Runs on the build machine's own architecture and cross-compiles for the target (amd64 / arm64),
# so multi-arch images build fast without emulation.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:11.0 AS build
ARG TARGETARCH
# Release version, e.g. 1.0 (GitHub Actions passes the git tag). Empty → the <Version> from Expensy.csproj.
ARG VERSION=""
WORKDIR /src
COPY src/Expensy/Expensy.csproj src/Expensy/
RUN dotnet restore src/Expensy/Expensy.csproj -a $TARGETARCH
COPY src/Expensy/ src/Expensy/
RUN dotnet publish src/Expensy/Expensy.csproj -c Release -a $TARGETARCH --no-restore -o /app \
    ${VERSION:+-p:InformationalVersion=$VERSION}

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:11.0
WORKDIR /app
COPY --from=build /app .

# Database (expensy.db) and photos live in /data — mount a volume there.
# The directory is writable for any user, so the container can run with whatever UID/GID you choose
# (docker-compose.yml: PUID / PGID). A new named volume inherits these permissions.
RUN mkdir -p /data && chmod 0777 /data
VOLUME /data

ENV ASPNETCORE_HTTP_PORTS=8080 \
    EXPENSY_DATA_DIR=/data \
    HOME=/tmp
EXPOSE 8080

# Never run as root. Override with `user:` in docker-compose.yml or `docker run --user UID:GID`.
USER 1000:1000
ENTRYPOINT ["dotnet", "Expensy.dll"]

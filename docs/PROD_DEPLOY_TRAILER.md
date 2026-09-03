# Deploy de Producao - Trailer

Este fluxo isola a aplicacao trailer do site principal e habilita deploy automatico via GitHub Actions.

## Objetivo

- Usuario de sistema dedicado para a app (`trailerapp`)
- Diretorio isolado para releases (`/srv/trailer-app`)
- Publicacao atomica para o webroot de producao (`/var/www/rpa4all.com/trailer`)
- Deploy automatico por push na branch `main`

## 1) Bootstrap no servidor (uma vez)

No servidor de producao, dentro do repo do trailer:

```bash
cd /home/edenilson/trailers-motorshome
sudo bash deploy/prod/bootstrap_server.sh
```

Isso cria:

- usuario: `trailerapp`
- base: `/srv/trailer-app`
- helper de publish: `/usr/local/sbin/trailer-prod-publish`

## 2) Secrets no GitHub

Configure os secrets no repositorio `trailers-motorshome`:

- `TRAILER_PROD_HOST` - host/IP do servidor de producao
- `TRAILER_PROD_SSH_USER` - usuario SSH de deploy (com sudo para rodar o publish)
- `TRAILER_PROD_SSH_KEY` - chave privada SSH (PEM)
- `TRAILER_PROD_SSH_PORT` - porta SSH (ex: `22`)

## 3) Workflow de deploy automatico

Arquivo: `.github/workflows/trailer-prod-deploy.yml`

Fluxo:

1. Empacota artefato estatico (`index.html`, `trailer_3d.html`, `src`, `trailer_lib`, etc.)
2. Envia para `/tmp/trailer-prod.tar.gz` no servidor
3. Executa publish atomico via `/usr/local/sbin/trailer-prod-publish`
4. Valida se o modulo publico contem assinatura do fix (`interiorGroup()`)

## 4) Estrutura final

- releases: `/srv/trailer-app/releases/<timestamp>`
- link atual: `/srv/trailer-app/current`
- webroot publico: `/var/www/rpa4all.com/trailer`

## 5) Rollback rapido

No servidor:

```bash
ls -1dt /srv/trailer-app/releases/*
sudo ln -sfn /srv/trailer-app/releases/<release_anterior> /srv/trailer-app/current
sudo rsync -a --delete /srv/trailer-app/current/ /var/www/rpa4all.com/trailer/
```

## Observacoes

- O workflow usa `sudo` no host remoto para publicar com ownership correto.
- O `publish_release.sh` limpa releases antigas mantendo as ultimas 5.
- Se usar Cloudflare/edge cache, mantenha `Cache-Control: no-store` para `src/*.js` do trailer.

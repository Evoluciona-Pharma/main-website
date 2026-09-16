# Jenkins + GitHub Actions (main-website)

Same pattern as Custom Hub: Jenkins builds the image on the agent, streams it with `docker save | ssh docker load`, and starts the container. GitHub Actions tests/builds on merge, then triggers the job.

Environment values come from a Jenkins **Secret file**. The one value that matters today is `NEXT_PUBLIC_API_URL`.

| Environment | Git branch | Jenkins job | SSH credential ID | Host | Public URL |
|-------------|------------|-------------|-------------------|------|------------|
| Staging | `staging` | `STG-WEBSITE` | `stg-deploy-ssh` | `4.227.178.18` | https://staging.evolucionapharma.com |
| Production | `main` | `PROD-WEBSITE` | `prod-ssh-key` | `48.216.240.184` | https://prod.evolucionapharma.com |

Linux user: `azureuser`. GitHub clone credential: `github-credentials`.

The container is published as **`127.0.0.1:8080`** (Next listens on 3001 inside). Custom Hub front uses **8081**; the API uses **3000**. Host nginx proxies the public site to 8080.

`next build` inlines `NEXT_PUBLIC_*` into the browser bundle. Changing the API URL requires a new Jenkins build; editing the file on the VM is not enough.

## Secret file (where the API URL lives)

Jenkins → Manage Jenkins → Credentials → System → Global credentials → **Add Credentials** → Kind **Secret file**.

| ID to type | Upload |
|------------|--------|
| `main-website-env-stg` | `deploy/env.example` → `NEXT_PUBLIC_API_URL=https://api-stg.evolucionapharma.com` |
| `main-website-env-prod` | `deploy/env.prod.example` → `NEXT_PUBLIC_API_URL=https://api.evolucionapharma.com` |

The same file is also copied to `/home/azureuser/main-website.env` and passed to `docker run --env-file`. Do not put `PORT` or `HOSTNAME` in it: the image binds 3001 and Jenkins maps host 8080 → 3001.

Save it as plain UTF-8 with LF endings. The pipeline strips CR, but it cannot repair UTF-16.

If the file has no `NEXT_PUBLIC_API_URL`, the job falls back to `WEBSITE_STG_API_URL` / `WEBSITE_PROD_API_URL`, then to the hardcoded staging/production API URLs.

The `Build Image` stage logs the value it used: `Building with NEXT_PUBLIC_API_URL=...`.

## Jenkins job `STG-WEBSITE`

1. New Item → `STG-WEBSITE` → Pipeline.
2. Parameterized: Choice `ENVIRONMENT` = `staging` / `production`.
3. Pipeline script from SCM:
   - Repo: `https://github.com/Evoluciona-Pharma/main-website.git`
   - Credentials: `github-credentials`
   - Branch: `*/staging`
   - Script Path: `Jenkinsfile`
4. Secret file: `main-website-env-stg`.
5. Save → **Build with Parameters** → `ENVIRONMENT=staging`.

## Jenkins job `PROD-WEBSITE`

1. New Item → `PROD-WEBSITE` → Pipeline.
2. Parameterized: Choice `ENVIRONMENT`. Always pick `production` on this job.
3. Pipeline script from SCM:
   - Repo: `https://github.com/Evoluciona-Pharma/main-website.git`
   - Credentials: `github-credentials`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Secret file: `main-website-env-prod`.
5. SSH: reuse `prod-ssh-key` (same as the API). Do not create a second SSH credential.
6. Host defaults to `48.216.240.184`. Override with `WEBSITE_PROD_HOST` only if the IP changes.
7. Save → **Build with Parameters** → `ENVIRONMENT=production`.

A Pipeline job has no environment section of its own. Optional overrides go in **Manage Jenkins → System → Global properties → Environment variables**, or as job-level env vars if the folder allows it:

| Variable | When to set |
|----------|-------------|
| `WEBSITE_PROD_HOST` | if production is not `48.216.240.184` |
| `WEBSITE_DEPLOY_USER` | if not `azureuser` |
| `WEBSITE_PROD_SSH_CREDENTIALS` | if the SSH ID is not `prod-ssh-key` |
| `WEBSITE_PROD_ENV` | if the secret file ID is not `main-website-env-prod` |

## GitHub

Secrets: `JENKINS_URL`, `JENKINS_USER`, `JENKINS_TOKEN` (same values as the API repo).

- Merge to `staging` → `STG-WEBSITE`
- Merge to `main` → `PROD-WEBSITE`

Create GitHub environments `staging` and `production`. Put required reviewers on `production`.

`pages.yml` still publishes GitHub Pages on every push to `main`. Disable Pages (or switch that workflow to `workflow_dispatch`) when Jenkins should be the only public site.

## DevOps on the production VM (`48.216.240.184`)

Same VM as the API. No git clone. Needs Docker (`azureuser` in the `docker` group), nginx, and DNS.

1. Confirm host port **8080** is free (`ss -lntp | grep 8080`). The API already owns 3000.
2. DNS `prod.evolucionapharma.com` → `48.216.240.184`.
3. Install `deploy/nginx-website-prod.conf.example` as an nginx site.
4. `sudo certbot --nginx -d prod.evolucionapharma.com`

CORS: the API currently answers `Access-Control-Allow-Origin: *`, so the website can call it without an extra API restart. Restrict `CORS_ORIGIN` later if you want.

## Flow

1. Push or merge to `main`.
2. GitHub Action `Deploy website production` runs tests + `next build`.
3. If `JENKINS_TOKEN` is set, it triggers `PROD-WEBSITE`.
4. Jenkins clones `main`, builds with `NEXT_PUBLIC_API_URL=https://api.evolucionapharma.com`, ships the image, runs `main-website` on `127.0.0.1:8080`, waits until Docker health is `healthy`.

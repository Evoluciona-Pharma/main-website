# Jenkins + GitHub Actions (main-website)

Same pattern as Custom Hub: Jenkins builds the image on the agent, streams it with `docker save | ssh docker load`, and starts the container. GitHub Actions tests/builds on merge, then triggers the job.

No Jenkins **Secret file** is required. The only environment-specific value is `NEXT_PUBLIC_API_URL`, baked into the Next.js bundle at **image build** time. When DevOps gives you the real API host, set it on the Jenkins job and rebuild (changing `.env` on the VM does nothing).

| Environment | Git branch | Jenkins job | SSH credential ID | Default host | Public URL |
|-------------|------------|-------------|-------------------|--------------|------------|
| Staging | `staging` | `STG-WEBSITE` | `stg-deploy-ssh` | `4.227.178.18` | https://staging.evolucionapharma.com |
| Production | `main` | `PROD-WEBSITE` | `prod-ssh-key` | set `WEBSITE_PROD_HOST` | confirm with DevOps |

Linux user: `azureuser`. GitHub clone credential: `github-credentials`.

The container listens on **3001 inside** and is published as **`127.0.0.1:8080`** so host nginx can keep the old website mapping. Custom Hub front uses **8081**; the API uses **3000**.

Default staging API URL: `https://api-stg.evolucionapharma.com`. Override with job env `WEBSITE_STG_API_URL` if the backend host is different. Production has no default — set `WEBSITE_PROD_API_URL` before the first prod deploy.

The Custom Hub API must allow CORS from the website origin (`CORS_ORIGIN=https://staging.evolucionapharma.com` on the API secret file). Login/catalog will fail until that API is reachable.

## 1. Git: create branch `staging`

This repo currently tracks `main`. Jenkins staging clones `staging`.

```bash
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

Keep `staging` as the integration branch. Merge to `main` only when you want production (and GitHub Pages, until you disable it).

## 2. GitHub (this repo)

Settings → Secrets and variables → Actions. Same names as the API/front repos (values can be identical):

- `JENKINS_URL` — e.g. `http://135.222.210.21:8080`
- `JENKINS_USER`
- `JENKINS_TOKEN`

Settings → Environments: create `staging` and `production`. Put required reviewers on `production` if you want a manual gate.

`github-credentials` on Jenkins must be allowed to clone this private repo.

`pages.yml` still publishes GitHub Pages on every push to `main`. Staging Jenkins deploys do **not** touch Pages. Disable Pages (or switch `pages.yml` to `workflow_dispatch` only) when Jenkins should be the only public site.

## 3. Jenkins job `STG-WEBSITE`

On the **new** Jenkins (`http://135.222.210.21:8080/`), not the old website Jenkins.

1. New Item → `STG-WEBSITE` → Pipeline.
2. This project is parameterized → Choice Parameter:
   - Name: `ENVIRONMENT`
   - Choices: `staging` then `production` (staging first).
3. Pipeline → Definition: **Pipeline script from SCM**
   - SCM: Git
   - Repository URL: `https://github.com/Evoluciona-Pharma/main-website.git`
   - Credentials: `github-credentials`
   - Branch Specifier: `*/staging`
   - Script Path: `Jenkinsfile`
4. Optional (Manage Jenkins or job Configure → Environment):

   | Variable | When to set |
   |----------|-------------|
   | `WEBSITE_STG_HOST` | if staging is not `4.227.178.18` |
   | `WEBSITE_DEPLOY_USER` | if not `azureuser` |
   | `WEBSITE_STG_SSH_CREDENTIALS` | if the SSH ID is not `stg-deploy-ssh` |
   | `WEBSITE_STG_API_URL` | when you have the real API public URL |

5. Save → **Build with Parameters** → `ENVIRONMENT=staging`.

The first build can run **before** DNS/nginx exist. Success means: image on the VM, container healthy on `127.0.0.1:8080`. The public hostname comes after DevOps wires nginx.

## 4. Jenkins job `PROD-WEBSITE` (later)

Same as staging, but:

- Branch: `*/main`
- Default parameter `production`
- Set `WEBSITE_PROD_HOST` and `WEBSITE_PROD_API_URL` (and SSH ID `prod-ssh-key` unless you override `WEBSITE_PROD_SSH_CREDENTIALS`)

Do not run production until staging is confirmed.

## 5. DevOps on the staging VM (`4.227.178.18`)

No git clone on the server. Needs Docker (`azureuser` in the `docker` group), nginx, and DNS.

1. Confirm host port **8080** is free (`ss -lntp | grep 8080`).
2. DNS `staging.evolucionapharma.com` → public IP of that VM.
3. Install `deploy/nginx-website-stg.conf.example` as an nginx site.
4. `sudo certbot --nginx -d staging.evolucionapharma.com`
5. On the **API** secret file, set `CORS_ORIGIN=https://staging.evolucionapharma.com` (and rebuild/restart the API container).

## Flow

1. Push or merge to `staging`.
2. GitHub Action `Deploy website staging` runs tests + `next build`.
3. If `JENKINS_TOKEN` is set, it triggers `STG-WEBSITE`.
4. Jenkins clones `staging`, builds `--target production` with `NEXT_PUBLIC_API_URL`, ships the image, runs `main-website`, waits until Docker health is `healthy`.

Do not `git clone` the site onto the VM. Local `docker compose up` is for development (`NEXT_PUBLIC_API_URL` in `.env`).

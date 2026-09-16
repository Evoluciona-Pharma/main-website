# Jenkins + GitHub Actions (main-website)

Same pattern as Custom Hub: Jenkins builds the image on the agent, streams it with `docker save | ssh docker load`, and starts the container. GitHub Actions tests/builds on merge, then triggers the job.

Environment values come from a Jenkins **Secret file**, same idea as the API. The one value that matters today is `NEXT_PUBLIC_API_URL`.

| Environment | Git branch | Jenkins job | SSH credential ID | Default host | Public URL |
|-------------|------------|-------------|-------------------|--------------|------------|
| Staging | `staging` | `STG-WEBSITE` | `stg-deploy-ssh` | `4.227.178.18` | https://staging.evolucionapharma.com |
| Production | `main` | `PROD-WEBSITE` | `prod-ssh-key` | set `WEBSITE_PROD_HOST` | confirm with DevOps |

Linux user: `azureuser`. GitHub clone credential: `github-credentials`.

The container is published as **`127.0.0.1:3001`** (same port Next uses inside the image). Custom Hub front uses **8081**; the API uses **3000**.

The Custom Hub API must allow CORS from the website origin (`CORS_ORIGIN=https://staging.evolucionapharma.com` on the API secret file). Login/catalog will fail until that API is reachable.

## Secret file (where the API URL lives)

Jenkins → Manage Jenkins → Credentials → System → Global credentials → **Add Credentials** → Kind **Secret file**.

| ID to type | Upload |
|------------|--------|
| `main-website-env-stg` | `deploy/env.example` filled with `NEXT_PUBLIC_API_URL=https://api-stg.evolucionapharma.com` |
| `main-website-env-prod` | same with `https://api.evolucionapharma.com` |

`next build` inlines `NEXT_PUBLIC_*` into the browser bundle, so Jenkins reads this value on the agent at **build** time. Editing the file on the VM changes nothing until the job runs again.

The same file is also copied to `/home/azureuser/main-website.env` and passed to `docker run --env-file`, which is where any future server-side variable belongs. Do not put `PORT` or `HOSTNAME` in it: the image binds 3001 and the deploy maps that port.

Save it as plain UTF-8 with LF endings. The pipeline strips CR, but it cannot repair UTF-16.

If the file has no `NEXT_PUBLIC_API_URL`, the job falls back to `WEBSITE_STG_API_URL` / `WEBSITE_PROD_API_URL`, and staging falls back again to `https://api-stg.evolucionapharma.com`. Production has no default and the build fails instead of shipping a bundle pointing nowhere.

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
4. Create the `main-website-env-stg` secret file (see above).
5. Optional overrides. A Pipeline job has no environment section of its own, so
   these go in **Manage Jenkins → System → Global properties → Environment
   variables**:

   | Variable | When to set |
   |----------|-------------|
   | `WEBSITE_STG_HOST` | if staging is not `4.227.178.18` |
   | `WEBSITE_DEPLOY_USER` | if not `azureuser` |
   | `WEBSITE_STG_SSH_CREDENTIALS` | if the SSH ID is not `stg-deploy-ssh` |
   | `WEBSITE_STG_ENV` | if the secret file ID is not `main-website-env-stg` |

6. Save → **Build with Parameters** → `ENVIRONMENT=staging`.

The `Build Image` stage logs the value it used: `Building with NEXT_PUBLIC_API_URL=...`.

The first build can run **before** DNS/nginx exist. Success means: image on the VM, container healthy on `127.0.0.1:3001`. The public hostname comes after DevOps wires nginx.

## 4. Jenkins job `PROD-WEBSITE` (later)

Same as staging, but:

- Branch: `*/main`
- Default parameter `production`
- Create the `main-website-env-prod` secret file with the production API URL
- Set `WEBSITE_PROD_HOST` (and SSH ID `prod-ssh-key` unless you override `WEBSITE_PROD_SSH_CREDENTIALS`)

Do not run production until staging is confirmed.

## 5. DevOps on the staging VM (`4.227.178.18`)

No git clone on the server. Needs Docker (`azureuser` in the `docker` group), nginx, and DNS.

1. Confirm host port **3001** is free (`ss -lntp | grep 3001`).
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

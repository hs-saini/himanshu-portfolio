# Himanshu Saini Portfolio

Responsive portfolio website with an Express admin studio for skills, certificates, projects, assistant replies, and contact messages.

## Run locally on Windows

```powershell
npm install
npm start
```

Open `http://localhost:3000`. The admin studio is at `http://localhost:3000/admin`. Local credentials are loaded from `.env`; `.env` is ignored by Git.

## Deploy to Vercel

The frontend files are in `public/`, as required for Vercel's static asset CDN. Express serves the API, login, and `/admin` redirect. Content is stored in Upstash Redis and certificate/project images in Vercel Blob, so edits persist across serverless instances.

1. Push this project to a GitHub repository. Keep the repository private unless you explicitly want the source code public.
2. Import the repository into Vercel and set the Vercel project name to `hsaini`. The `hsaini.vercel.app` subdomain must be available.
3. Connect an Upstash Redis store and Vercel Blob store to the Vercel project. Their environment variables must be available to the deployment:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `BLOB_READ_WRITE_TOKEN`
4. In Vercel Project Settings → Environment Variables, set:
   - `ADMIN_USERNAME` to `admin_saini`
   - `ADMIN_PASSWORD` to a strong, private password that has not been shared publicly
   - `ADMIN_SESSION_SECRET` to a separate, random secret
5. Redeploy after storage and environment variables are connected, then verify the public site, admin sign-in, editing, contact form, and image uploads.

Do not commit `.env`, `data/`, `uploads/`, or `.vercel/`. The local JSON data file and local image directory are only used during development; Vercel uses Redis and Blob.

## Publish the GitHub repository

Create an empty repository named `himanshu-portfolio`, then run these commands from this folder:

```powershell
git add .
git commit -m "Build responsive portfolio and Vercel admin studio"
git remote add origin https://github.com/YOUR-USERNAME/himanshu-portfolio.git
git push -u origin main
```

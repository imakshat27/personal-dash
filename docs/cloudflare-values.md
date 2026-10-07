# Cloud deployment checklist for orbit.imakshat.com

The Worker is configured for `orbit.imakshat.com` as a Cloudflare Custom Domain. The public `workers.dev` URL and preview URLs are disabled. Nothing has been deployed or changed in DNS yet.

## Domain prerequisite

`imakshat.com` must be an active Cloudflare zone in the same account as the Worker. For this deployment, use the Worker Custom Domain feature: Cloudflare provisions DNS and the certificate. If an `orbit` CNAME already exists, save its target and remove that specific record when ready to attach the Custom Domain; existing CNAMEs conflict with Worker Custom Domains. Keep other domain records untouched. If DNS is hosted elsewhere, resolve the domain setup before deployment.

## Get the storage values using your terminal

In the project directory:

```sh
npx wrangler login
npx wrangler whoami
npx wrangler d1 create orbit-db
npx wrangler r2 bucket create orbit-files
```

1. Login opens a browser. Authorize the Cloudflare account that owns `imakshat.com`.
2. `whoami` lists the account name and account ID. Share the account ID, especially if you have more than one account.
3. D1 creation prints a `database_id` UUID. Share that ID. If asked to update Wrangler automatically, you can decline; we will add the production binding without replacing the local one.
4. R2 creation prints confirmation. Share the bucket name `orbit-files`. If R2 is not enabled, enable it in Cloudflare's R2 dashboard and retry.

If those resources already exist, use the existing ones rather than recreating them. To retrieve IDs/names:

```sh
npx wrangler d1 list
npx wrangler r2 bucket list
```

No R2 S3 access key is needed: the Worker uses a bucket binding.

## Get the Access values using the dashboard

1. Open Cloudflare **Zero Trust**. If it is your first visit, complete organization setup and select an appropriate plan.
2. Go to **Custom pages → Team name and domain**. Copy the team domain, e.g. `akshat.cloudflareaccess.com`, without `https://`.
3. Go to **Access controls → Applications → Create new application**.
4. Choose **Self-hosted and private** (some layouts label this simply **Self-hosted**).
5. Name it **Orbit**. Select **Add public hostname**, using subdomain `orbit` and domain `imakshat.com`. Leave the path empty so the entire hostname is protected.
6. Add an **Allow** policy named **Only me**. Use **Include → Emails → your exact sign-in email**. Do not use an Everyone or Bypass policy.
7. In the application's login methods, choose your Cloudflare account login, or configure One-time PIN if you prefer email codes. New organizations may default to Cloudflare login. Make sure the policy email matches the login identity.
8. Save the application. Back in Applications, select **Configure → Additional settings** and copy **Application Audience (AUD) Tag**. This is the audience tag, not the application ID and not a login token.

If AUD is not visible in your dashboard layout, it can be retrieved through the Access applications API's `aud` field; do not create a new API token just for this if you can use the UI.

## Send these values

```text
Cloudflare account ID:
D1 database ID:
D1 database name: orbit-db
R2 bucket name: orbit-files
Access team domain: … .cloudflareaccess.com
Access application AUD:
Allowed sign-in email:
Domain DNS managed in Cloudflare: yes/no
```

These are configuration identifiers. Keep passwords, API tokens, OAuth tokens, and login codes out of chat. Wrangler login authorizes deployment on your machine; no provider secret needs to be pasted here.

After these values are supplied, we can add the production bindings/account ID, set the Access values as Worker secrets, apply the remote migration, build in live mode, deploy, and verify private sign-in and file storage. Until then the local preview remains in demo mode.

## Official instructions

- [Worker Custom Domains and CNAME conflicts](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Create D1](https://developers.cloudflare.com/d1/get-started/)
- [R2 setup with Wrangler](https://developers.cloudflare.com/r2/get-started/cli/)
- [Find the Zero Trust team domain](https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/)
- [Create an Access application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Access identity providers](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/)

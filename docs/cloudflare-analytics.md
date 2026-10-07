# Cloudflare traffic in Orbit

This connection reads existing zone traffic. It enables no paid service and changes no plans, DNS, or infrastructure. Keep your existing Free plans. It does not require R2 or Zero Trust.

1. Open the Cloudflare dashboard and select your existing account. Open **Account API tokens** (under account management), then **Create Token**.
2. Under **Custom token**, click **Get started**. Name it **Orbit analytics**.
3. Add these read permissions:

   | Scope   | Permission        | Access |
   | ------- | ----------------- | ------ |
   | Account | Account Analytics | Read   |
   | Zone    | Analytics         | Read   |
   | Zone    | Zone              | Read   |

4. Restrict **Account Resources** to your existing account. Set **Zone Resources** to **Include → Specific zone → imakshat.com**. Add other zones only if you want their traffic in Orbit (maximum 20).
5. Leave IP filtering empty: Worker outbound addresses are not fixed. Click **Continue to summary → Create Token**, then copy the token. Cloudflare shows it only once.
6. In the project terminal run:

   ```sh
   npx wrangler secret put CLOUDFLARE_API_TOKEN --env=""
   ```

   Paste the token at the secret prompt and press Enter. Never send it in chat or add it to frontend environment variables. The account ID is already configured.

7. Reload Orbit. Open **Integrations → Cloudflare → Verify Cloudflare connection**. Verification makes real read requests before marking the connection connected. Open **Sites** to see traffic.

Traffic covers the last 24 completed UTC hours, compared with the preceding 24 hours. Counts are adaptive estimates of HTTP requests, including proxied hostnames across the zone; they are not unique visitors. Bandwidth is edge response bytes. Active is Cloudflare zone status, not measured uptime. Zero means a successful empty response; unavailable analytics shows an error and unknown count. An unavailable zone does not hide other zones.

If verification fails, check all three read permissions and selected zone resources. If the dataset is unavailable on your existing plan, keep the plan unchanged and report the displayed message. Orbit does not add a paid plan. This milestone covers zone traffic, not Workers metrics, deployment history, or Web Analytics page views.

Sources: [Cloudflare token setup](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/), [adaptive HTTP analytics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/end-customer-analytics/), [query limits](https://developers.cloudflare.com/analytics/graphql-api/limits/).

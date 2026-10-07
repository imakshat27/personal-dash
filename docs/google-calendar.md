# Connect Google Calendar

Orbit can read your primary Google Calendar. It does not create, change, or delete events. Your dashboard shows today's events; Calendar supports previous/next days, recurring instances, and all-day events. Views use India Standard Time. Additional calendars and editing are later milestones.

1. In your existing Google Cloud project, open **APIs & Services → Library**, search **Google Calendar API**, and click **Enable**.
2. Go to **Google Auth Platform → Clients → your web client**. Keep existing redirects and add:

```text
https://orbit.imakshat.com/api/integrations/calendar/callback
```

3. Under **Data Access**, add `https://www.googleapis.com/auth/calendar.events.readonly`. Keep your existing Drive and identity scopes. Your email must remain in the Audience test-user list.
4. In Orbit, choose **Integrations → Google Calendar → Set up integration → Connect Google Calendar**. Use `agarwalakshat2710@gmail.com` and approve read access.
5. Open Calendar or your dashboard. No new client secret or encryption key is needed.

Calendar uses its own encrypted token record and OAuth state cookie. Adding it does not replace the existing Drive record. The shared Google OAuth adapter verifies your identity, scope grants, browser state, and PKCE. API data remains uncached and authenticated. Testing refresh-token expiry still applies; reconnect when needed.

Google event lists are paginated (up to ten pages per day). Extremely large days return a clear error rather than silently dropping events. Calendar failures do not hide the rest of the dashboard.

Optional local redirect: `http://localhost:5173/api/integrations/calendar/callback`. The API is `GET /api/calendar?date=YYYY-MM-DD`, with today in IST as the default.

- [Calendar read scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Event list, recurring instances, pagination, and all-day boundaries](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)

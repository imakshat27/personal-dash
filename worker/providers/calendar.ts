import type { CalendarEvent } from "../../shared/models";
import { dayWindow } from "../../shared/calendar";
import { googleToken, type GoogleEnv } from "./google-auth";
import { ProviderError } from "./errors";
interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}
export class GoogleCalendarProvider {
  constructor(private env: GoogleEnv) {}
  async events(date: string): Promise<CalendarEvent[]> {
    const window = dayWindow(date);
    const token = await googleToken(this.env, "calendar");
    const events: CalendarEvent[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({
        timeMin: window.start,
        timeMax: window.end,
        timeZone: "Asia/Kolkata",
        singleEvents: "true",
        orderBy: "startTime",
        showDeleted: "false",
        maxResults: "250",
        fields: "nextPageToken,items(id,summary,status,location,start,end)",
      });
      if (cursor) query.set("pageToken", cursor);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        if (response.status === 401) {
          await this.env
            .DB!.prepare(
              "UPDATE integrations SET status='needs_reauth' WHERE id='calendar'",
            )
            .run();
          throw new ProviderError(
            "Reconnect Google Calendar in Integrations.",
            401,
          );
        }
        if (response.status === 403)
          throw new ProviderError(
            "Google Calendar declined access. Enable its API in your Google project and reconnect with read permission.",
            403,
          );
        if (response.status === 429)
          throw new ProviderError(
            "Google Calendar is busy. Please try again shortly.",
            429,
          );
        throw new ProviderError(
          "Could not read Google Calendar. Please try again shortly.",
        );
      }
      const result = (await response.json()) as {
        items?: GoogleEvent[];
        nextPageToken?: string;
      };
      for (const event of result.items || []) {
        if (event.status === "cancelled" || !event.start || !event.end)
          continue;
        const start = event.start.dateTime || event.start.date,
          end = event.end.dateTime || event.end.date;
        if (!start || !end) continue;
        events.push({
          id: `calendar:${event.id}`,
          title: event.summary || "Busy",
          start,
          end,
          allDay: Boolean(event.start.date),
          color: event.start.date ? "sand" : "sage",
          location: event.location || "Google Calendar",
        });
      }
      cursor = result.nextPageToken;
      if (!cursor) return events;
    }
    throw new ProviderError(
      "This day has too many calendar entries to display. Open Google Calendar for the complete list.",
      413,
    );
  }
}

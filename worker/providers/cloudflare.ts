import type { Site } from "../../shared/models";
import { ProviderError } from "./errors";
export interface CloudflareEnv {
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}
interface Zone {
  id: string;
  name: string;
  status: string;
}
interface Group {
  count: number;
  dimensions?: { datetimeHour: string };
  sum?: { edgeResponseBytes: number };
}
export function cloudflareConfigured(env: CloudflareEnv) {
  return Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);
}
const query = `query OrbitTraffic($tag: string, $current: filter, $previous: filter) {
  viewer { zones(filter: {zoneTag: $tag}) {
    current: httpRequestsAdaptiveGroups(limit: 25, filter: $current, orderBy: [datetimeHour_ASC]) { count dimensions { datetimeHour } sum { edgeResponseBytes } }
    previous: httpRequestsAdaptiveGroups(limit: 1, filter: $previous) { count }
  } }
}`;
export class CloudflareProvider {
  constructor(private env: CloudflareEnv) {}
  private async call(path: string, options: RequestInit = {}) {
    if (!cloudflareConfigured(this.env))
      throw new ProviderError(
        "Set up the read-only Cloudflare token to connect your sites.",
        503,
      );
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/${path}`,
      { ...options, headers },
    );
    if (!response.ok) {
      if ([401, 403].includes(response.status))
        throw new ProviderError(
          "Cloudflare declined the token. Check its read permissions and selected resources.",
          403,
        );
      if (response.status === 429)
        throw new ProviderError(
          "Cloudflare's analytics limit was reached. Try again shortly.",
          429,
        );
      throw new ProviderError(
        "Cloudflare is temporarily unavailable. Please try again.",
      );
    }
    return response;
  }
  async zones(): Promise<Zone[]> {
    const params = new URLSearchParams({
      "account.id": this.env.CLOUDFLARE_ACCOUNT_ID || "",
      per_page: "20",
      order: "name",
      direction: "asc",
    });
    const result = (await (await this.call(`zones?${params}`)).json()) as {
      success: boolean;
      result: Zone[];
      result_info?: { total_count: number };
    };
    if (!result.success)
      throw new ProviderError(
        "Could not list Cloudflare zones. Check the token's Zone Read permission.",
        403,
      );
    if ((result.result_info?.total_count || 0) > 20)
      throw new ProviderError(
        "This connection supports up to 20 zones. Limit the token to the sites you want in Orbit.",
        413,
      );
    return result.result;
  }
  private async analytics(zone: Zone, now: Date): Promise<Site> {
    const end = new Date(now);
    end.setUTCMinutes(0, 0, 0);
    const start = new Date(end.getTime() - 86400000),
      previous = new Date(start.getTime() - 86400000);
    const result = (await (
      await this.call("graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            tag: zone.id,
            current: {
              datetime_geq: start.toISOString(),
              datetime_lt: end.toISOString(),
              requestSource: "eyeball",
            },
            previous: {
              datetime_geq: previous.toISOString(),
              datetime_lt: start.toISOString(),
              requestSource: "eyeball",
            },
          },
        }),
      })
    ).json()) as {
      errors?: unknown[];
      data?: { viewer?: { zones?: { current: Group[]; previous: Group[] }[] } };
    };
    if (result.errors?.length || !result.data?.viewer?.zones?.[0])
      throw new ProviderError(
        "Analytics isn't available for this zone. Check Analytics Read permissions and dataset availability on your current plan.",
        403,
      );
    const data = result.data.viewer.zones[0],
      series = Array<number>(24).fill(0);
    for (const group of data.current) {
      const hour = Math.floor(
        (Date.parse(group.dimensions!.datetimeHour) - start.getTime()) /
          3600000,
      );
      if (hour >= 0 && hour < 24) series[hour] += group.count;
    }
    const requests = data.current.reduce((sum, g) => sum + g.count, 0),
      prior = data.previous.reduce((sum, g) => sum + g.count, 0);
    return {
      id: zone.id,
      name: zone.name,
      url: zone.name,
      status: zone.status === "active" ? "healthy" : "warning",
      requests,
      bandwidth: data.current.reduce(
        (sum, g) => sum + (g.sum?.edgeResponseBytes || 0),
        0,
      ),
      change: prior
        ? Math.round(((requests - prior) / prior) * 1000) / 10
        : null,
      series,
    };
  }
  async sites(now = new Date()): Promise<Site[]> {
    const zones = await this.zones();
    const sites: Site[] = [];
    for (let index = 0; index < zones.length; index += 3) {
      sites.push(
        ...(await Promise.all(
          zones.slice(index, index + 3).map(async (zone) => {
            try {
              return await this.analytics(zone, now);
            } catch (error) {
              return {
                id: zone.id,
                name: zone.name,
                url: zone.name,
                status:
                  zone.status === "active"
                    ? ("healthy" as const)
                    : ("warning" as const),
                requests: null,
                change: null,
                series: [],
                analyticsError:
                  error instanceof ProviderError
                    ? error.message
                    : "Analytics is temporarily unavailable.",
              };
            }
          }),
        )),
      );
    }
    return sites;
  }
  async verify() {
    const sites = await this.sites();
    if (!sites.length)
      throw new ProviderError(
        "No zones are visible. Include your selected zones in the token's resources.",
        403,
      );
    if (sites.every((site) => site.analyticsError))
      throw new ProviderError(sites[0].analyticsError!, 403);
    return sites.length;
  }
}

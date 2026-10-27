import { and, desc, eq } from "drizzle-orm";
import { metaAdInsights } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

const META_ACCOUNT_ID = "1118607737611268";
const META_ACCOUNT_NAME = "RD ADS";
const META_GRAPH_VERSION = "v23.0";
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const INSIGHT_FIELDS = [
  "account_id",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "date_start",
  "date_stop",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "inline_link_click_ctr",
  "spend",
  "cpc",
  "cost_per_inline_link_click",
  "cpm",
  "actions",
  "cost_per_action_type",
].join(",");

type MetaInsightRow = Record<string, unknown> & {
  account_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  date_stop?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  inline_link_click_ctr?: string;
  spend?: string;
  cpc?: string;
  cost_per_inline_link_click?: string;
  cpm?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
};

type MetaRange = {
  days: number;
  dateStart: string;
  dateStop: string;
  account: Record<string, unknown> | null;
  campaigns: Record<string, unknown>[];
  ads: Record<string, unknown>[];
  syncedAt: string | null;
};

function dateKeyInArgentina(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(row: MetaInsightRow, actionType: string) {
  return asNumber(row.actions?.find(action => action.action_type === actionType)?.value);
}

function toStoredRow(row: MetaInsightRow, level: "account" | "campaign" | "ad", dateStart: string, dateStop: string) {
  const accountId = String(row.account_id || META_ACCOUNT_ID);
  const campaignId = String(row.campaign_id || (level === "account" ? "account" : "unknown"));
  const adId = String(
    row.ad_id ||
      (level === "campaign"
        ? `campaign:${campaignId}`
        : level === "account"
          ? `account:${accountId}`
          : "unknown")
  );
  return {
    accountId,
    currency: "USD",
    dateStart: String(row.date_start || dateStart),
    dateStop: String(row.date_stop || dateStop),
    level,
    campaignId,
    campaignName: String(row.campaign_name || (level === "account" ? META_ACCOUNT_NAME : "Sin nombre")),
    adsetId: row.adset_id ? String(row.adset_id) : null,
    adsetName: row.adset_name ? String(row.adset_name) : null,
    adId,
    adName: String(row.ad_name || (level === "campaign" ? row.campaign_name || "Campaña" : level === "account" ? META_ACCOUNT_NAME : "Anuncio")),
    impressions: Math.round(asNumber(row.impressions)),
    reach: Math.round(asNumber(row.reach)),
    frequency: asNumber(row.frequency).toFixed(4),
    clicksAll: Math.round(asNumber(row.clicks)),
    linkClicks: Math.round(asNumber(row.inline_link_clicks)),
    spend: asNumber(row.spend).toFixed(2),
    ctr: asNumber(row.ctr).toFixed(4),
    inlineLinkClickCtr: asNumber(row.inline_link_click_ctr).toFixed(4),
    cpc: asNumber(row.cpc).toFixed(4),
    costPerLinkClick: asNumber(row.cost_per_inline_link_click).toFixed(4),
    cpm: asNumber(row.cpm).toFixed(4),
    messagingConversations: Math.round(actionValue(row, "onsite_conversion.messaging_conversation_started_7d")),
    messagingReplies: Math.round(actionValue(row, "onsite_conversion.messaging_conversation_replied_7d")),
    messagingConnections: Math.round(actionValue(row, "onsite_conversion.total_messaging_connection")),
    messagingFirstReplies: Math.round(actionValue(row, "onsite_conversion.messaging_first_reply")),
    messagingDepth2: Math.round(actionValue(row, "onsite_conversion.messaging_user_depth_2_message_send")),
    messagingDepth3: Math.round(actionValue(row, "onsite_conversion.messaging_user_depth_3_message_send")),
    videoViews: Math.round(actionValue(row, "video_view")),
    syncedAt: new Date(),
  };
}

async function fetchInsights(
  level: "account" | "campaign" | "ad",
  dateStart: string,
  dateStop: string
): Promise<MetaInsightRow[]> {
  if (!ENV.metaAccessToken) throw new Error("Falta configurar el token de Meta Ads");
  const params = new URLSearchParams({
    access_token: ENV.metaAccessToken,
    level,
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: dateStart, until: dateStop }),
    limit: "500",
  });
  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${META_ACCOUNT_ID}/insights?${params.toString()}`;
  let pages = 0;
  while (nextUrl && pages < 10) {
    const response = await fetch(nextUrl);
    const payload = (await response.json()) as {
      data?: MetaInsightRow[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!response.ok || payload.error) {
      throw new Error(`Meta Ads: ${payload.error?.message || `HTTP ${response.status}`}`);
    }
    rows.push(...(payload.data || []));
    nextUrl = payload.paging?.next || null;
    pages += 1;
  }
  return rows;
}

async function upsertRows(rows: ReturnType<typeof toStoredRow>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  for (const row of rows) {
    await db
      .insert(metaAdInsights)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          currency: row.currency,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          adsetId: row.adsetId,
          adsetName: row.adsetName,
          adName: row.adName,
          impressions: row.impressions,
          reach: row.reach,
          frequency: row.frequency,
          clicksAll: row.clicksAll,
          linkClicks: row.linkClicks,
          spend: row.spend,
          ctr: row.ctr,
          inlineLinkClickCtr: row.inlineLinkClickCtr,
          cpc: row.cpc,
          costPerLinkClick: row.costPerLinkClick,
          cpm: row.cpm,
          messagingConversations: row.messagingConversations,
          messagingReplies: row.messagingReplies,
          messagingConnections: row.messagingConnections,
          messagingFirstReplies: row.messagingFirstReplies,
          messagingDepth2: row.messagingDepth2,
          messagingDepth3: row.messagingDepth3,
          videoViews: row.videoViews,
          syncedAt: row.syncedAt,
        },
      });
  }
}

async function readRange(days: number): Promise<MetaRange> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const today = dateKeyInArgentina();
  const dateStart = shiftDateKey(today, -days);
  const dateStop = shiftDateKey(today, -1);
  const rows = await db
    .select()
    .from(metaAdInsights)
    .where(
      and(
        eq(metaAdInsights.accountId, META_ACCOUNT_ID),
        eq(metaAdInsights.dateStart, dateStart),
        eq(metaAdInsights.dateStop, dateStop)
      )
    )
    .orderBy(desc(metaAdInsights.spend), desc(metaAdInsights.id));
  const present = (row: (typeof rows)[number]) => ({
    ...row,
    spend: Number(row.spend || 0),
    frequency: Number(row.frequency || 0),
    ctr: Number(row.ctr || 0),
    inlineLinkClickCtr: Number(row.inlineLinkClickCtr || 0),
    cpc: Number(row.cpc || 0),
    costPerLinkClick: Number(row.costPerLinkClick || 0),
    cpm: Number(row.cpm || 0),
    syncedAt: row.syncedAt?.toISOString?.() || String(row.syncedAt || ""),
  });
  const account = rows.find(row => row.level === "account");
  const campaigns = rows.filter(row => row.level === "campaign").map(present);
  const ads = rows.filter(row => row.level === "ad").map(present);
  const syncedAt = rows[0]?.syncedAt?.toISOString?.() || null;
  return {
    days,
    dateStart,
    dateStop,
    account: account ? present(account) : null,
    campaigns,
    ads,
    syncedAt,
  };
}

export async function getMetaAdsSnapshot() {
  const ranges = await Promise.all([readRange(7), readRange(30)]);
  return {
    connected: Boolean(ENV.metaAccessToken),
    accountId: META_ACCOUNT_ID,
    accountName: META_ACCOUNT_NAME,
    currency: "USD",
    ranges,
  };
}

export async function syncMetaAds() {
  if (!ENV.metaAccessToken) throw new Error("Falta configurar el token de Meta Ads");
  const today = dateKeyInArgentina();
  let rowCount = 0;
  for (const days of [7, 30]) {
    const dateStart = shiftDateKey(today, -days);
    const dateStop = shiftDateKey(today, -1);
    for (const level of ["account", "campaign", "ad"] as const) {
      const data = await fetchInsights(level, dateStart, dateStop);
      const stored = data.map(row => toStoredRow(row, level, dateStart, dateStop));
      await upsertRows(stored);
      rowCount += stored.length;
    }
  }
  return { ...(await getMetaAdsSnapshot()), rowCount };
}

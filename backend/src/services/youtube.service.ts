import axios from "axios";
import { cached } from "./cache.service";

const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

if (!API_KEY) {
  console.warn("[youtube] YOUTUBE_API_KEY is not set; calls will fail.");
}

const client = axios.create({ baseURL: BASE, timeout: 15000 });

function ensureKey() {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY env var is missing");
  return API_KEY;
}

export interface YTChannelSearchItem {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  customUrl?: string;
}

export async function searchChannels(query: string): Promise<YTChannelSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return cached(`yt:search:${trimmed.toLowerCase()}`, 60 * 30, async () => {
    const key = ensureKey();
    const handle = extractHandle(trimmed);
    if (handle) {
      const resolved = await resolveByHandle(handle);
      if (resolved.length > 0) return resolved;
    }
    const { data } = await client.get("/search", {
      params: { key, q: trimmed, type: "channel", part: "snippet", maxResults: 10 },
    });
    return (data.items || []).map((it: any) => ({
      id: it.snippet.channelId || it.id?.channelId,
      title: it.snippet.channelTitle || it.snippet.title,
      thumbnail:
        it.snippet.thumbnails?.high?.url ||
        it.snippet.thumbnails?.medium?.url ||
        it.snippet.thumbnails?.default?.url ||
        "",
      description: it.snippet.description || "",
    }));
  });
}

export async function searchSimilarChannels(seedTitle: string, niche: string, max = 4): Promise<YTChannelSearchItem[]> {
  const q = `${niche || seedTitle}`.trim();
  if (!q) return [];
  return cached(`yt:similar:${q.toLowerCase()}:${max}`, 60 * 60, async () => {
    const key = ensureKey();
    const { data } = await client.get("/search", {
      params: { key, q, type: "channel", part: "snippet", maxResults: max + 4 },
    });
    return (data.items || [])
      .map((it: any) => ({
        id: it.snippet.channelId || it.id?.channelId,
        title: it.snippet.channelTitle || it.snippet.title,
        thumbnail:
          it.snippet.thumbnails?.high?.url ||
          it.snippet.thumbnails?.medium?.url ||
          it.snippet.thumbnails?.default?.url ||
          "",
        description: it.snippet.description || "",
      }))
      .filter((c: YTChannelSearchItem) => !!c.id)
      .slice(0, max + 4);
  });
}

function extractHandle(input: string): string | null {
  if (input.startsWith("@")) return input;
  try {
    const url = new URL(input);
    const seg = url.pathname.split("/").filter(Boolean);
    const last = seg[seg.length - 1];
    if (last?.startsWith("@")) return last;
    if (seg[0] === "channel" && seg[1]) return null;
    if (seg[0] === "c" && seg[1]) return seg[1];
    if (seg[0] === "user" && seg[1]) return seg[1];
  } catch {
    // not a url
  }
  return null;
}

async function resolveByHandle(handle: string): Promise<YTChannelSearchItem[]> {
  const key = ensureKey();
  const cleaned = handle.replace(/^@/, "");
  try {
    const { data } = await client.get("/channels", {
      params: { key, part: "snippet", forHandle: `@${cleaned}` },
    });
    const items = data.items || [];
    return items.map((c: any) => ({
      id: c.id,
      title: c.snippet.title,
      thumbnail:
        c.snippet.thumbnails?.high?.url ||
        c.snippet.thumbnails?.medium?.url ||
        c.snippet.thumbnails?.default?.url ||
        "",
      description: c.snippet.description || "",
      customUrl: c.snippet.customUrl,
    }));
  } catch {
    return [];
  }
}

export interface YTChannelRaw {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  bannerUrl?: string;
  publishedAt: string;
  country?: string;
  subscriberCount: number;
  hiddenSubscriberCount: boolean;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export async function getChannelRaw(channelId: string): Promise<YTChannelRaw | null> {
  return cached(`yt:channel:${channelId}`, 60 * 10, () => fetchChannelRaw(channelId));
}

async function fetchChannelRaw(channelId: string): Promise<YTChannelRaw | null> {
  const key = ensureKey();
  let data;
  try {
    const resp = await client.get("/channels", {
      params: {
        key,
        id: channelId,
        part: "snippet,statistics,contentDetails,brandingSettings",
      },
    });
    data = resp.data;
  } catch (err: any) {
    console.error("[youtube] fetchChannelRaw FAILED for channelId:", channelId);
    console.error("[youtube]   HTTP status:", err.response?.status);
    console.error("[youtube]   Google error body:", JSON.stringify(err.response?.data));
    console.error("[youtube]   Request URL was:", err.config?.url, "params:", JSON.stringify(err.config?.params));
    throw err;
  }
  const c = (data.items || [])[0];
  if (!c) return null;

  return {
    id: c.id,
    title: c.snippet.title,
    description: c.snippet.description || "",
    thumbnail:
      c.snippet.thumbnails?.high?.url ||
      c.snippet.thumbnails?.medium?.url ||
      c.snippet.thumbnails?.default?.url ||
      "",
    bannerUrl: c.brandingSettings?.image?.bannerExternalUrl,
    publishedAt: c.snippet.publishedAt,
    country: c.snippet.country,
    subscriberCount: Number(c.statistics?.subscriberCount || 0),
    hiddenSubscriberCount: Boolean(c.statistics?.hiddenSubscriberCount),
    viewCount: Number(c.statistics?.viewCount || 0),
    videoCount: Number(c.statistics?.videoCount || 0),
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads,
  };
}

export interface YTVideoSummary {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
}

export async function getRecentVideos(uploadsPlaylistId: string, max = 25): Promise<YTVideoSummary[]> {
  if (!uploadsPlaylistId) return [];
  return cached(`yt:uploads:${uploadsPlaylistId}:${max}`, 60 * 10, () =>
    fetchRecentVideos(uploadsPlaylistId, max),
  );
}

async function fetchRecentVideos(uploadsPlaylistId: string, max: number): Promise<YTVideoSummary[]> {
  const key = ensureKey();

  let pl;
  try {
    const resp = await client.get("/playlistItems", {
      params: { key, playlistId: uploadsPlaylistId, part: "contentDetails,snippet", maxResults: max },
    });
    pl = resp.data;
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.warn("[youtube] uploads playlist not found (channel likely has 0 videos):", uploadsPlaylistId);
      return [];
    }
    throw err;
  }

  const ids: string[] = (pl.items || []).map((i: any) => i.contentDetails.videoId);
  if (ids.length === 0) return [];

  const { data: vids } = await client.get("/videos", {
    params: { key, id: ids.join(","), part: "snippet,contentDetails,statistics", maxResults: max },
  });

  return (vids.items || []).map((v: any) => ({
    id: v.id,
    title: v.snippet.title,
    thumbnail:
      v.snippet.thumbnails?.maxres?.url ||
      v.snippet.thumbnails?.high?.url ||
      v.snippet.thumbnails?.medium?.url ||
      v.snippet.thumbnails?.default?.url ||
      "",
    publishedAt: v.snippet.publishedAt,
    durationSeconds: parseISODuration(v.contentDetails?.duration || "PT0S"),
    views: Number(v.statistics?.viewCount || 0),
    likes: Number(v.statistics?.likeCount || 0),
    comments: Number(v.statistics?.commentCount || 0),
  }));
}

export async function getVideo(videoId: string): Promise<YTVideoSummary | null> {
  const key = ensureKey();
  const { data } = await client.get("/videos", {
    params: { key, id: videoId, part: "snippet,contentDetails,statistics" },
  });
  const v = (data.items || [])[0];
  if (!v) return null;
  return {
    id: v.id,
    title: v.snippet.title,
    thumbnail:
      v.snippet.thumbnails?.maxres?.url ||
      v.snippet.thumbnails?.high?.url ||
      v.snippet.thumbnails?.medium?.url ||
      v.snippet.thumbnails?.default?.url ||
      "",
    publishedAt: v.snippet.publishedAt,
    durationSeconds: parseISODuration(v.contentDetails?.duration || "PT0S"),
    views: Number(v.statistics?.viewCount || 0),
    likes: Number(v.statistics?.likeCount || 0),
    comments: Number(v.statistics?.commentCount || 0),
  };
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

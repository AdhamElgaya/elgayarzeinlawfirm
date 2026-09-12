const FALLBACK_API_ORIGIN = "https://elgayarzeinlawfirm-production-f6ce.up.railway.app";

function apiOrigin(env) {
  return String(env?.RAILWAY_API_URL || FALLBACK_API_ORIGIN || "")
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
}

async function proxyToRailway(request, env) {
  const origin = apiOrigin(env);
  if (!origin) {
    return Response.json({ error: "Portal API origin is not configured." }, { status: 503 });
  }

  const incoming = new URL(request.url);
  const target = origin + incoming.pathname + incoming.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(target, init);
    if (upstream.status === 404) {
      return Response.json(
        {
          error:
            "خادم Railway لا يستجيب على مسار API. افتح إعدادات Railway وانسخ Public Domain وتأكد أن الخدمة تعمل.",
        },
        { status: 502 }
      );
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch {
    return Response.json({ error: "تعذر الاتصال بالخادم (Railway)." }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) {
      return proxyToRailway(request, env);
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};

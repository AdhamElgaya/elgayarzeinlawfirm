const FALLBACK_API_ORIGIN = "https://elgayarzeinlawfirm-production-f6ce.up.railway.app";

export default {
  async fetch(request, env) {
    const origin = String(env.RAILWAY_API_URL || FALLBACK_API_ORIGIN || "")
      .trim()
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");

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

    const upstream = await fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  },
};

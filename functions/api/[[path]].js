const FALLBACK_API_ORIGIN = "https://elgayarzeinlawfirm-production-f6ce.up.railway.app";

export async function onRequest(context) {
  const origin = String(context.env.RAILWAY_API_URL || FALLBACK_API_ORIGIN || "")
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

  if (!origin) {
    return Response.json({ error: "Portal API origin is not configured." }, { status: 503 });
  }

  const splat = context.params.path;
  const suffix = Array.isArray(splat) ? splat.join("/") : splat || "";
  const incoming = new URL(context.request.url);
  const target = origin + "/api/" + suffix + incoming.search;

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

  const init = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

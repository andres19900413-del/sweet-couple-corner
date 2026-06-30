import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import type { Database } from "@/integrations/supabase/types";

interface PushPayload {
  channel?: string;
  sender_id?: string;
  title?: string;
  body?: string;
  url?: string;
}

export const Route = createFileRoute("/api/public/hooks/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
          const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
          const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:rinconcito@example.com";

          if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
            return new Response(JSON.stringify({ error: "vapid_not_configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const payload = (await request.json()) as PushPayload;
          const { sender_id, title, body, url, channel } = payload;

          if (!title) {
            return new Response(JSON.stringify({ error: "missing_title" }), { status: 400 });
          }

          const admin = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          );

          let query = admin.from("push_subscriptions").select("*");
          if (sender_id) query = query.neq("user_id", sender_id);
          const { data: subs, error } = await query;

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          }

          const notificationBody = { title, body: body || "", url: url || "/", channel };
          const vapid = { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE };

          let sent = 0;
          let removed = 0;

          await Promise.all(
            (subs || []).map(async (s) => {
              const subscription: PushSubscription = {
                endpoint: s.endpoint,
                expirationTime: null,
                keys: { p256dh: s.p256dh, auth: s.auth },
              };
              try {
                const message = await buildPushPayload(
                  { data: notificationBody, options: { ttl: 60 * 60 * 24 } },
                  subscription,
                  vapid,
                );
                const res = await fetch(s.endpoint, {
                  method: message.method,
                  headers: message.headers,
                  body: message.body,
                });
                if (res.status === 404 || res.status === 410) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                  removed++;
                } else if (res.ok) {
                  sent++;
                } else {
                  console.error("push send non-ok", res.status, await res.text().catch(() => ""));
                }
              } catch (err) {
                console.error("push send error", err);
              }
            })
          );

          return new Response(JSON.stringify({ ok: true, sent, removed }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("send-push fatal", e);
          return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database } from "@/integrations/supabase/types";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:rinconcito@example.com";

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
          if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
            return new Response(JSON.stringify({ error: "vapid_not_configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

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

          // Send to everyone EXCEPT the sender (so they don't get notified for their own actions).
          let query = admin.from("push_subscriptions").select("*");
          if (sender_id) query = query.neq("user_id", sender_id);
          const { data: subs, error } = await query;

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          }

          const notificationBody = JSON.stringify({
            title,
            body: body || "",
            url: url || "/",
            channel,
          });

          let sent = 0;
          let removed = 0;

          await Promise.all(
            (subs || []).map(async (s) => {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth },
                  },
                  notificationBody,
                  { TTL: 60 * 60 * 24 }
                );
                sent++;
              } catch (err) {
                const status = (err as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                  removed++;
                } else {
                  console.error("push send error", err);
                }
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

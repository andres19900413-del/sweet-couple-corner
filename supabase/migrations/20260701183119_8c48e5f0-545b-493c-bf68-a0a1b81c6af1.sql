
-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public.
-- These are only invoked by triggers (which run with definer privileges) and by
-- notify_push called from other definer functions; no client needs direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_note_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_calendar_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_mood_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_message_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_thought_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Scope push_subscriptions policy explicitly to authenticated role.
DROP POLICY IF EXISTS "users manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "users manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi bildirimlerini silebilsin
DROP POLICY IF EXISTS "user_notifications_delete_own" ON public.user_notifications;
CREATE POLICY "user_notifications_delete_own"
  ON public.user_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

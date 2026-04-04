import { supabase } from './supabase';

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function deleteUserNotification(notificationId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);
  return !error;
}

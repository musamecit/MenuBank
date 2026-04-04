import { supabase } from './supabase';

export interface BlockedUser {
  blocked_id: string;
  display_name: string;
  created_at: string;
}

export async function blockUser(blockedId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const blockerId = session?.user?.id;
  if (!blockerId) {
    throw new Error('Giriş gerekli');
  }
  if (blockerId === blockedId) {
    throw new Error('Kendinizi engelleyemezsiniz');
  }
  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

export async function unblockUser(blockedId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const blockerId = session?.user?.id;
  if (!blockerId) {
    throw new Error('Giriş gerekli');
  }
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data: blocks, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false });
    
  if (error || !blocks?.length) {
    return [];
  }
  
  const blockedIds = blocks.map(b => b.blocked_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', blockedIds);
    
  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]));
  
  return blocks.map(b => ({
    blocked_id: b.blocked_id,
    display_name: profileMap.get(b.blocked_id) || 'Bilinmeyen Kullanıcı',
    created_at: b.created_at,
  }));
}

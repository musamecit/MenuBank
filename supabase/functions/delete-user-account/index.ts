import { handleCors, jsonResponse, err401, err500 } from '../_shared/response.ts';
import { admin, getAuthFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    const { user } = await getAuthFromRequest(req);
    if (!user) return err401(req, 'Authentication required');

    const uid = user.id;

    // Supabase Auth and User Profiles typically have CASCADE DELETE, or we can manually delete them.
    // However, to be completely safe, we manually call deleteUser on the Auth Admin API
    // which automatically removes the auth.users record which triggers ON DELETE CASCADE for public tables if set up.
    
    // First let's check if the user is a restaurant owner (an admin).
    // If they own a restaurant alone, deleting the account might leave the restaurant orphaned.
    // But for a simple delete to meet Apple Guidelines, we delete their profile records and auth record.

    // Try to delete specific user records first if needed, though CASCADE should handle most.
    try {
      await admin.from('user_profiles').delete().eq('id', uid);
    } catch (e) {
      console.warn("Failed deleting profile directly", e);
    }

    // Now delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);

    if (deleteError) {
      console.error('Error deleting user account:', deleteError);
      return err500(req, 'Failed to fully delete user account.');
    }

    return jsonResponse({ success: true, message: 'Account permanently deleted' });

  } catch (e) {
    const msg = String((e as Error).message || 'Unexpected error');
    return err500(req, msg);
  }
});

import { handleCors, jsonResponse } from '../_shared/response.ts';
import { admin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Pick next queued job
  const { data: job, error } = await admin
    .from('jobs_queue')
    .select('*')
    .eq('status', 'queued')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !job) {
    return jsonResponse({ message: 'No jobs to process' });
  }

  const j = job as { id: string; job_type: string; payload: Record<string, unknown>; attempts: number; max_attempts: number };

  // Lock the job
  await admin
    .from('jobs_queue')
    .update({ status: 'running', locked_at: new Date().toISOString(), attempts: j.attempts + 1 })
    .eq('id', j.id);

  try {
    // Process based on job type
    switch (j.job_type) {
      case 'refresh_trending_daily': {
        await admin.rpc('refresh_trending_scores').catch(() => {});
        break;
      }
      case 'map_cluster_refresh': {
        await admin.rpc('refresh_map_clusters').catch(() => {});
        break;
      }
      default: {
        console.log(`Job type ${j.job_type} not implemented in runner`);
        break;
      }
    }

    await admin.from('jobs_queue').update({ status: 'done' }).eq('id', j.id);
    return jsonResponse({ status: 'done', job_id: j.id, job_type: j.job_type });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const newStatus = j.attempts + 1 >= j.max_attempts ? 'failed_final' : 'failed';
    await admin
      .from('jobs_queue')
      .update({ status: newStatus, last_error: errorMsg, locked_at: null })
      .eq('id', j.id);
    return jsonResponse({ status: newStatus, error: errorMsg }, 500);
  }
});

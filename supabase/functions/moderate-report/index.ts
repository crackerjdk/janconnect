// Supabase Edge Function: Privileged Human Moderation Workflow
// Verifies moderator/administrator role server-side, records append-only moderation action,
// updates complaint visibility, promotes EXIF-stripped media, and notifies citizen.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['moderator', 'administrator'])
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Moderator privileges required' }), { status: 403 });
    }

    const { complaint_id, action, reason } = await req.json();
    if (!complaint_id || !action || !reason || reason.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Complaint ID, action, and reason are required' }), { status: 400 });
    }

    const statusMap: Record<string, { status: string; visibility: 'private' | 'public' }> = {
      start_review: { status: 'under_review', visibility: 'private' },
      request_info: { status: 'additional_information_required', visibility: 'private' },
      publish: { status: 'published', visibility: 'public' },
      reject: { status: 'rejected', visibility: 'private' },
      remove: { status: 'removed', visibility: 'private' },
    };

    const next = statusMap[action];
    if (!next) {
      return new Response(JSON.stringify({ error: 'Unsupported moderation action' }), { status: 400 });
    }

    const { data: existing } = await adminClient
      .from('complaints')
      .select('id, user_id, title, platform_status')
      .eq('id', complaint_id)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      platform_status: next.status,
      visibility: next.visibility,
      updated_at: new Date().toISOString(),
    };
    if (action === 'publish') {
      updatePayload.published_at = new Date().toISOString();
    }

    await adminClient.from('complaints').update(updatePayload).eq('id', complaint_id);

    await adminClient.from('moderation_actions').insert({
      moderator_id: user.id,
      complaint_id,
      action,
      reason: reason.trim(),
      previous_status: existing.platform_status,
      new_status: next.status,
    });

    await adminClient.from('complaint_status_history').insert({
      complaint_id,
      previous_status: existing.platform_status,
      new_status: next.status,
      actor_id: user.id,
      reason: reason.trim(),
    });

    if (action === 'publish') {
      await adminClient
        .from('complaint_media')
        .update({ review_status: 'approved' })
        .eq('complaint_id', complaint_id);
    }

    await adminClient.from('notifications').insert({
      recipient_id: existing.user_id,
      type: `report_${next.status}`,
      related_id: complaint_id,
      message: `Your report "${existing.title}" status updated to ${next.status.replace(/_/g, ' ')}.`,
    });

    return new Response(JSON.stringify({ ok: true, new_status: next.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

// Supabase Edge Function: Privileged Report Submission
// Validates input, restricts initial status to 'submitted' + 'private', enforces rate limits,
// and logs an append-only status history & audit event.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGIN') || '*';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

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
    const body = await req.json();
    const { title, description, category, location_id, generalized_location, restricted_latitude, restricted_longitude } = body;

    if (!title || title.trim().length < 8 || !description || description.trim().length < 20 || !category || !location_id) {
      return new Response(JSON.stringify({ error: 'Invalid report fields' }), { status: 400 });
    }

    // Rate limit: max 5 submissions in 1 hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await adminClient
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Submission rate limit reached. Please wait before submitting again.' }), { status: 429 });
    }

    const { data: complaint, error: insertError } = await adminClient
      .from('complaints')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        location_id,
        generalized_location,
        restricted_latitude: typeof restricted_latitude === 'number' ? restricted_latitude : null,
        restricted_longitude: typeof restricted_longitude === 'number' ? restricted_longitude : null,
        platform_status: 'submitted',
        visibility: 'private',
      })
      .select('id, platform_status, created_at')
      .single();

    if (insertError) throw insertError;

    await adminClient.from('complaint_status_history').insert({
      complaint_id: complaint.id,
      previous_status: null,
      new_status: 'submitted',
      actor_id: user.id,
      reason: 'Initial citizen submission',
    });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'report_submitted',
      target_type: 'complaint',
      target_id: complaint.id,
      metadata: { category },
    });

    return new Response(JSON.stringify({ complaint }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGINS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

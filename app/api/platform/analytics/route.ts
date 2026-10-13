import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const dayUTC = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (days: number) => dayUTC(new Date(Date.now() - days * 86400000));

async function allRows(makeQuery: () => any) {
  const result: any[] = [];
  const size = 500;
  for (let offset = 0; offset < 50000; offset += size) {
    const { data, error } = await makeQuery().range(offset, offset + size - 1);
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < size) return result;
  }
  throw new Error('Activity report exceeds the current retrieval limit.');
}

export async function GET() {
  const c = await createClient();
  const { data: { user }, error } = await c.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Super Owner access required.' }, { status: 403, headers: noStore });
  const admin = createAdminClient();
  const { data: role, error: roleError } = await admin.from('platform_roles')
    .select('user_id').eq('user_id', user.id).eq('role', 'super_owner').maybeSingle();
  if (roleError || !role) return NextResponse.json({ error: 'Super Owner access required.' }, { status: 403, headers: noStore });

  try {
    const start30 = daysAgo(29);
    const start7 = daysAgo(6);
    const today = dayUTC(new Date());
    const [profiles, activity, daily, orgs, orgMembers, teamMembers, teams, parentLinks] = await Promise.all([
      allRows(() => admin.from('profiles').select('id,app_role,created_at,account_status,registration_status').order('id')),
      allRows(() => admin.from('platform_user_activity').select('user_id,last_seen_at').order('user_id')),
      allRows(() => admin.from('platform_user_activity_daily').select('user_id,activity_date').gte('activity_date', start30).order('activity_date').order('user_id')),
      allRows(() => admin.from('organizations').select('id,name,branch_name').order('id')),
      allRows(() => admin.from('organization_members').select('user_id,organization_id,status').eq('status', 'active').order('user_id')),
      allRows(() => admin.from('team_members').select('user_id,team_id').order('user_id')),
      allRows(() => admin.from('teams').select('id,organization_id').order('id')),
      allRows(() => admin.from('parent_guardian_access').select('parent_user_id,athlete_user_id').eq('status', 'active').order('parent_user_id')),
    ]);

    const eligible = profiles.filter((p: any) => p.account_status === 'active' && p.registration_status === 'active');
    const eligibleIds = new Set(eligible.map((p: any) => p.id));
    const lastSeen = new Map(activity.map((a: any) => [a.user_id, a.last_seen_at]));
    const userDays = new Map<string, Set<string>>();
    const dailyUsers = new Map<string, Set<string>>();
    for (const row of daily) {
      if (!eligibleIds.has(row.user_id)) continue;
      if (!userDays.has(row.user_id)) userDays.set(row.user_id, new Set());
      userDays.get(row.user_id)!.add(row.activity_date);
      if (!dailyUsers.has(row.activity_date)) dailyUsers.set(row.activity_date, new Set());
      dailyUsers.get(row.activity_date)!.add(row.user_id);
    }
    const activeDays = (id: string, from: string) => [...(userDays.get(id) || [])].filter(d => d >= from).length;
    const active7 = eligible.filter((p: any) => activeDays(p.id, start7) > 0).length;
    const active30 = eligible.filter((p: any) => activeDays(p.id, start30) > 0).length;
    const returning30 = eligible.filter((p: any) => activeDays(p.id, start30) >= 2).length;
    const activeDaysSum = eligible.reduce((sum: number, p: any) => sum + activeDays(p.id, start30), 0);
    const dailySeries = Array.from({ length: 30 }, (_, i) => {
      const date = daysAgo(29 - i);
      return { date, active: date < '2026-10-13' ? null : (dailyUsers.get(date)?.size || 0) };
    });

    const roleNames: Record<string, string> = {
      athlete: 'Athletes', parent: 'Parents / Guardians', advisor: 'Advisors', admin: 'Admins',
    };
    const roleBuckets = new Map<string, any>();
    for (const p of eligible) {
      const key = p.app_role || 'other';
      if (!roleBuckets.has(key)) roleBuckets.set(key, { key, name: roleNames[key] || 'Other', total: 0, active7: 0, active30: 0 });
      const b = roleBuckets.get(key);
      b.total++;
      if (activeDays(p.id, start7) > 0) b.active7++;
      if (activeDays(p.id, start30) > 0) b.active30++;
    }

    const teamOrg = new Map(teams.map((t: any) => [t.id, t.organization_id]));
    const userOrgs = new Map<string, Set<string>>();
    const assign = (userId: string, orgId: string) => {
      if (!userOrgs.has(userId)) userOrgs.set(userId, new Set());
      userOrgs.get(userId)!.add(orgId);
    };
    for (const m of orgMembers) assign(m.user_id, m.organization_id);
    for (const m of teamMembers) {
      const orgId = teamOrg.get(m.team_id);
      if (orgId) assign(m.user_id, orgId);
    }
    for (const link of parentLinks) {
      for (const orgId of userOrgs.get(link.athlete_user_id) || []) assign(link.parent_user_id, orgId);
    }
    const orgBuckets = new Map<string, any>();
    for (const org of orgs) {
      orgBuckets.set(org.id, { id: org.id, name: org.name + (org.branch_name ? ' · ' + org.branch_name : ''), total: 0, active7: 0, active30: 0 });
    }
    orgBuckets.set('independent', { id: 'independent', name: 'Independent / unassigned', total: 0, active7: 0, active30: 0 });
    for (const p of eligible) {
      const orgIds = userOrgs.get(p.id);
      for (const orgId of orgIds?.size ? orgIds : ['independent']) {
        const b = orgBuckets.get(orgId);
        if (!b) continue;
        b.total++;
        if (activeDays(p.id, start7) > 0) b.active7++;
        if (activeDays(p.id, start30) > 0) b.active30++;
      }
    }

    return NextResponse.json({
      trackingStarted: '2026-10-13',
      generatedAt: new Date().toISOString(),
      metrics: {
        totalAccounts: profiles.length,
        eligibleAccounts: eligible.length,
        dailyActive: dailyUsers.get(today)?.size || 0,
        weeklyActive: active7,
        monthlyActive: active30,
        newAccounts30: profiles.filter((p: any) => p.created_at?.slice(0, 10) >= start30).length,
        noActivityRecorded: eligible.filter((p: any) => !lastSeen.has(p.id)).length,
        dormant30: eligible.filter((p: any) => {
          const seen = lastSeen.get(p.id);
          return seen && String(seen).slice(0, 10) < start30;
        }).length,
        returning30,
        avgActiveDays30: active30 ? Math.round((activeDaysSum / active30) * 10) / 10 : 0,
      },
      daily: dailySeries,
      roles: [...roleBuckets.values()].sort((a, b) => b.total - a.total),
      organizations: [...orgBuckets.values()].filter(b => b.total > 0).sort((a, b) => b.total - a.total),
    }, { headers: noStore });
  } catch (err) {
    console.error('Platform analytics failed', err);
    return NextResponse.json({ error: 'Unable to load usage analytics.' }, { status: 500, headers: noStore });
  }
}

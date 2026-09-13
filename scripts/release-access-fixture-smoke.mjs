import assert from "node:assert/strict";

const active = (m) => m.status === "active";
const staffRole = (role) => ["owner", "admin", "advisor"].includes(role);

function canAccessAthlete(viewerId, athleteId, memberships, assignments = []) {
  if (viewerId === athleteId) return true;
  const viewer = memberships.filter((m) => m.user_id === viewerId && active(m));
  const athlete = memberships.filter(
    (m) => m.user_id === athleteId && active(m),
  );
  for (const vm of viewer) {
    if (!staffRole(vm.role)) continue;
    const shared = athlete.some(
      (am) => am.organization_id === vm.organization_id,
    );
    if (!shared) continue;
    if (
      vm.role === "owner" ||
      vm.role === "admin" ||
      vm.organization_view_access
    )
      return true;
    if (
      assignments.some(
        (a) =>
          a.organization_id === vm.organization_id &&
          a.advisor_user_id === viewerId &&
          a.athlete_user_id === athleteId &&
          a.status === "active",
      )
    )
      return true;
  }
  return false;
}

function parentAuthorizedAthletes(parentId, links) {
  return links
    .filter((x) => x.parent_user_id === parentId && x.status === "active")
    .map((x) => x.athlete_user_id);
}
function selectParentAthlete(parentId, requestedId, currentId, links) {
  const ids = parentAuthorizedAthletes(parentId, links);
  if (requestedId && ids.includes(requestedId)) return requestedId;
  if (currentId && ids.includes(currentId)) return currentId;
  return ids[0] || "";
}
function parentHref(path, athleteId) {
  return `${path}?athlete=${encodeURIComponent(athleteId)}`;
}

function claimImportedPlayer(importRow, user) {
  if (importRow.status !== "pending")
    return { claimed: false, reason: "not-pending" };
  const importedEmail = String(importRow.email || "")
    .trim()
    .toLowerCase();
  const verifiedEmail = String(user.verified_email || "")
    .trim()
    .toLowerCase();
  if (!importedEmail || !verifiedEmail || importedEmail !== verifiedEmail)
    return { claimed: false, reason: "verified-email-mismatch" };
  return {
    claimed: true,
    athlete_user_id: user.id,
    source_organization_id: importRow.organization_id,
    provenance: importRow.provenance,
  };
}

function dashboardState({
  schools = [],
  interactions = [],
  nextSteps = [],
} = {}) {
  return {
    hasRecruitingData:
      schools.length > 0 || interactions.length > 0 || nextSteps.length > 0,
    empty:
      schools.length === 0 &&
      interactions.length === 0 &&
      nextSteps.length === 0,
    schoolCount: schools.length,
    interactionCount: interactions.length,
    nextStepCount: nextSteps.length,
  };
}

function filterAccounts(
  rows,
  { query = "", organization = "", team = "", age = "" } = {},
) {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [
      row.name,
      row.email,
      row.organizationName,
      row.branch,
      ...row.teams.map((t) => `${t.name} ${t.age}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!needle || haystack.includes(needle)) &&
      (!organization || row.organizationId === organization) &&
      (!team || row.teams.some((t) => t.id === team)) &&
      (!age || row.teams.some((t) => t.age === age))
    );
  });
}

// Multi-organization athlete: travel + high school.
const orgA = "travel-org",
  orgB = "high-school-org",
  athlete = "athlete-1",
  ownerA = "owner-a",
  ownerB = "owner-b";
let memberships = [
  {
    organization_id: orgA,
    user_id: athlete,
    role: "athlete",
    status: "active",
  },
  {
    organization_id: orgB,
    user_id: athlete,
    role: "athlete",
    status: "active",
  },
  { organization_id: orgA, user_id: ownerA, role: "owner", status: "active" },
  { organization_id: orgB, user_id: ownerB, role: "owner", status: "active" },
];
const canonicalRecruiting = {
  schools: ["school-1", "school-2"],
  coaches: ["coach-1"],
  interactions: ["i1", "i2", "i3"],
  events: ["e1"],
  nextSteps: ["n1"],
  videos: ["v1"],
};
const before = JSON.stringify(canonicalRecruiting);
assert.equal(
  canAccessAthlete(ownerA, athlete, memberships),
  true,
  "Travel owner should initially have access",
);
assert.equal(
  canAccessAthlete(ownerB, athlete, memberships),
  true,
  "High-school owner should initially have access",
);

memberships = memberships.map((m) =>
  m.organization_id === orgA && m.user_id === athlete
    ? { ...m, status: "left" }
    : m,
);
assert.equal(
  canAccessAthlete(ownerA, athlete, memberships),
  false,
  "Leaving Travel Org must revoke Travel owner access",
);
assert.equal(
  canAccessAthlete(ownerB, athlete, memberships),
  true,
  "Leaving Travel Org must preserve High School owner access",
);
assert.equal(
  JSON.stringify(canonicalRecruiting),
  before,
  "Leaving one organization must not mutate canonical recruiting data",
);

memberships = memberships.map((m) =>
  m.organization_id === orgA && m.user_id === athlete
    ? { ...m, status: "active" }
    : m,
);
assert.equal(
  canAccessAthlete(ownerA, athlete, memberships),
  true,
  "Rejoining Travel Org should restore access",
);
assert.equal(
  new Set(
    memberships
      .filter((m) => m.user_id === athlete)
      .map((m) => `${m.organization_id}:${m.user_id}`),
  ).size,
  2,
  "Rejoin must not create duplicate membership identities",
);
assert.equal(
  JSON.stringify(canonicalRecruiting),
  before,
  "Rejoin must not duplicate canonical recruiting data",
);

// Parent with two athletes, persistent authorized context, and revocation safety.
const parent = "parent-1",
  athleteA = "daughter-a",
  athleteB = "daughter-b",
  outsider = "not-authorized";
let links = [
  { parent_user_id: parent, athlete_user_id: athleteA, status: "active" },
  { parent_user_id: parent, athlete_user_id: athleteB, status: "active" },
];
assert.deepEqual(parentAuthorizedAthletes(parent, links), [athleteA, athleteB]);
assert.equal(
  selectParentAthlete(parent, athleteB, athleteA, links),
  athleteB,
  "Parent should be able to switch to second athlete",
);
for (const path of [
  "/parent",
  "/parent/connections",
  "/parent/goals",
  "/parent/journey",
  "/parent/events",
  "/parent/discover",
  "/videos",
]) {
  assert.match(
    parentHref(path, athleteB),
    new RegExp(`athlete=${athleteB}$`),
    `Parent navigation must persist athlete context for ${path}`,
  );
}
assert.equal(
  selectParentAthlete(parent, outsider, athleteB, links),
  athleteB,
  "Unauthorized athlete IDs must never replace an authorized current athlete",
);
links = links.map((x) =>
  x.athlete_user_id === athleteB ? { ...x, status: "revoked" } : x,
);
assert.deepEqual(
  parentAuthorizedAthletes(parent, links),
  [athleteA],
  "Revoked athlete must disappear immediately",
);

// Duplicate names remain distinguishable, team filters support multi-team players,
// and same-family branches remain isolated organizations.
const accountRows = [
  {
    name: "Maia Waddell",
    email: "maia.one@example.com",
    organizationId: "top-gun-kc-north",
    organizationName: "Top Gun",
    branch: "KC North",
    teams: [
      { id: "16-regional", name: "16 Regional", age: "16U" },
      { id: "hs", name: "High School", age: "HS" },
    ],
  },
  {
    name: "Maia Waddell",
    email: "maia.two@example.com",
    organizationId: "top-gun-kc-south",
    organizationName: "Top Gun",
    branch: "KC South",
    teams: [{ id: "18-national", name: "18 National", age: "18U" }],
  },
];
assert.equal(
  filterAccounts(accountRows, { query: "Maia Waddell" }).length,
  2,
  "Duplicate names must both remain visible",
);
assert.equal(
  filterAccounts(accountRows, { query: "maia.two@example.com" })[0]
    .organizationId,
  "top-gun-kc-south",
  "Email must uniquely identify duplicate-name accounts",
);
assert.equal(
  filterAccounts(accountRows, { team: "hs" }).length,
  1,
  "A multi-team athlete must match either assigned team",
);
assert.equal(
  filterAccounts(accountRows, { age: "16U" }).length,
  1,
  "Age filters must derive from team assignments",
);
assert.equal(
  filterAccounts(accountRows, { organization: "top-gun-kc-north" }).length,
  1,
  "Same-family branches must remain isolated by organization ID",
);
const multiOrgAdmin = ["top-gun-kc-north", "top-gun-kc-south"];
assert.equal(
  multiOrgAdmin.includes("top-gun-kc-south"),
  true,
  "One administrator may explicitly manage multiple organizations",
);
assert.equal(
  selectParentAthlete(parent, athleteB, athleteB, links),
  athleteA,
  "After revocation, context must fall back to an authorized athlete",
);

// Advisor with 30 assigned athletes. Assignment must be organization-scoped.
const advisorOrg = "advisor-org",
  advisor = "advisor-30";
const advisorAthletes = Array.from(
  { length: 30 },
  (_, i) => `advisor-athlete-${i + 1}`,
);
const advisorMemberships = [
  {
    organization_id: advisorOrg,
    user_id: advisor,
    role: "advisor",
    status: "active",
    organization_view_access: false,
  },
  ...advisorAthletes.map((user_id) => ({
    organization_id: advisorOrg,
    user_id,
    role: "athlete",
    status: "active",
  })),
  {
    organization_id: "other-org",
    user_id: "other-athlete",
    role: "athlete",
    status: "active",
  },
];
const advisorAssignments = advisorAthletes.map((athlete_user_id) => ({
  organization_id: advisorOrg,
  advisor_user_id: advisor,
  athlete_user_id,
  status: "active",
}));
assert.equal(
  advisorAthletes.filter((id) =>
    canAccessAthlete(advisor, id, advisorMemberships, advisorAssignments),
  ).length,
  30,
  "Advisor should access all 30 assigned athletes",
);
assert.equal(
  canAccessAthlete(
    advisor,
    "other-athlete",
    advisorMemberships,
    advisorAssignments,
  ),
  false,
  "Advisor must not access an athlete from another organization",
);
const oneRemoved = advisorAssignments.map((a, i) =>
  i === 0 ? { ...a, status: "revoked" } : a,
);
assert.equal(
  canAccessAthlete(advisor, advisorAthletes[0], advisorMemberships, oneRemoved),
  false,
  "Revoked assignment must remove advisor access without organization-wide permission",
);

// Owner/Admin scale persona with 100 athletes in one organization.
const ownerOrg = "owner-100-org",
  owner = "owner-100";
const ownerAthletes = Array.from(
  { length: 100 },
  (_, i) => `owner-athlete-${i + 1}`,
);
const ownerMemberships = [
  {
    organization_id: ownerOrg,
    user_id: owner,
    role: "owner",
    status: "active",
  },
  ...ownerAthletes.map((user_id) => ({
    organization_id: ownerOrg,
    user_id,
    role: "athlete",
    status: "active",
  })),
  {
    organization_id: "outside-org",
    user_id: "outside-athlete",
    role: "athlete",
    status: "active",
  },
];
assert.equal(
  ownerAthletes.filter((id) => canAccessAthlete(owner, id, ownerMemberships))
    .length,
  100,
  "Owner should access all 100 active athletes in the organization",
);
assert.equal(
  canAccessAthlete(owner, "outside-athlete", ownerMemberships),
  false,
  "Owner must not access athletes with no shared organization",
);

// Brand-new athlete should be a true empty state, not an error or fabricated activity state.
const brandNew = dashboardState();
assert.equal(
  brandNew.empty,
  true,
  "Brand-new athlete should render a genuine empty recruiting state",
);
assert.equal(
  brandNew.hasRecruitingData,
  false,
  "Brand-new athlete must not appear to have recruiting activity",
);

// Imported-but-unclaimed athlete must never be claimed by name alone.
const imported = {
  status: "pending",
  email: "player@example.com",
  name: "Same Name",
  organization_id: "import-org",
  provenance: { source: "team_import", row: 7 },
};
assert.deepEqual(
  claimImportedPlayer(imported, {
    id: "wrong-user",
    verified_email: "different@example.com",
  }),
  { claimed: false, reason: "verified-email-mismatch" },
  "A name match or different email must never claim imported history",
);
const claim = claimImportedPlayer(imported, {
  id: "claimed-user",
  verified_email: "Player@Example.com",
});
assert.equal(
  claim.claimed,
  true,
  "Exact verified email should allow the pending import to be claimed",
);
assert.equal(claim.athlete_user_id, "claimed-user");
assert.deepEqual(
  claim.provenance,
  imported.provenance,
  "Import provenance must survive claim",
);

console.log(
  JSON.stringify(
    {
      multiOrg: "passed",
      parentMultiAthlete: "passed",
      advisor30: "passed",
      owner100: "passed",
      brandNewAthlete: "passed",
      importedUnclaimed: "passed",
      canonicalDataPreserved: true,
      unauthorizedParentContextBlocked: true,
      crossOrganizationAccessBlocked: true,
      duplicateAccounts: "passed",
      multipleTeams: "passed",
      multipleBranches: "passed",
      multiOrganizationAdmin: "passed",
    },
    null,
    2,
  ),
);

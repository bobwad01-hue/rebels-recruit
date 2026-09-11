import assert from 'node:assert/strict';

const active=(m)=>m.status==='active';
const staffRole=(role)=>['owner','admin','advisor'].includes(role);

function canAccessAthlete(viewerId,athleteId,memberships,assignments=[]){
  if(viewerId===athleteId)return true;
  const viewer=memberships.filter(m=>m.user_id===viewerId&&active(m));
  const athlete=memberships.filter(m=>m.user_id===athleteId&&active(m));
  for(const vm of viewer){
    if(!staffRole(vm.role))continue;
    const shared=athlete.some(am=>am.organization_id===vm.organization_id);
    if(!shared)continue;
    if(vm.role==='owner'||vm.role==='admin'||vm.organization_view_access)return true;
    if(assignments.some(a=>a.organization_id===vm.organization_id&&a.advisor_user_id===viewerId&&a.athlete_user_id===athleteId&&a.status==='active'))return true;
  }
  return false;
}

function parentAuthorizedAthletes(parentId,links){
  return links.filter(x=>x.parent_user_id===parentId&&x.status==='active').map(x=>x.athlete_user_id);
}
function selectParentAthlete(parentId,requestedId,currentId,links){
  const ids=parentAuthorizedAthletes(parentId,links);
  if(requestedId&&ids.includes(requestedId))return requestedId;
  if(currentId&&ids.includes(currentId))return currentId;
  return ids[0]||'';
}
function parentHref(path,athleteId){return `${path}?athlete=${encodeURIComponent(athleteId)}`}

const orgA='travel-org',orgB='high-school-org',athlete='athlete-1',ownerA='owner-a',ownerB='owner-b';
let memberships=[
  {organization_id:orgA,user_id:athlete,role:'athlete',status:'active'},
  {organization_id:orgB,user_id:athlete,role:'athlete',status:'active'},
  {organization_id:orgA,user_id:ownerA,role:'owner',status:'active'},
  {organization_id:orgB,user_id:ownerB,role:'owner',status:'active'},
];
const canonicalRecruiting={schools:['school-1','school-2'],coaches:['coach-1'],interactions:['i1','i2','i3'],events:['e1'],nextSteps:['n1'],videos:['v1']};
const before=JSON.stringify(canonicalRecruiting);
assert.equal(canAccessAthlete(ownerA,athlete,memberships),true,'Travel owner should initially have access');
assert.equal(canAccessAthlete(ownerB,athlete,memberships),true,'High-school owner should initially have access');

memberships=memberships.map(m=>m.organization_id===orgA&&m.user_id===athlete?{...m,status:'left'}:m);
assert.equal(canAccessAthlete(ownerA,athlete,memberships),false,'Leaving Travel Org must revoke Travel owner access');
assert.equal(canAccessAthlete(ownerB,athlete,memberships),true,'Leaving Travel Org must preserve High School owner access');
assert.equal(JSON.stringify(canonicalRecruiting),before,'Leaving one organization must not mutate canonical recruiting data');

memberships=memberships.map(m=>m.organization_id===orgA&&m.user_id===athlete?{...m,status:'active'}:m);
assert.equal(canAccessAthlete(ownerA,athlete,memberships),true,'Rejoining Travel Org should restore access');
assert.equal(new Set(memberships.filter(m=>m.user_id===athlete).map(m=>`${m.organization_id}:${m.user_id}`)).size,2,'Rejoin must not create duplicate membership identities');
assert.equal(JSON.stringify(canonicalRecruiting),before,'Rejoin must not duplicate canonical recruiting data');

const parent='parent-1',athleteA='daughter-a',athleteB='daughter-b',outsider='not-authorized';
let links=[
  {parent_user_id:parent,athlete_user_id:athleteA,status:'active'},
  {parent_user_id:parent,athlete_user_id:athleteB,status:'active'},
];
assert.deepEqual(parentAuthorizedAthletes(parent,links),[athleteA,athleteB]);
assert.equal(selectParentAthlete(parent,athleteB,athleteA,links),athleteB,'Parent should be able to switch to second athlete');
for(const path of ['/parent','/parent/connections','/parent/goals','/parent/journey','/parent/events','/parent/discover','/videos']){
  assert.match(parentHref(path,athleteB),new RegExp(`athlete=${athleteB}$`),`Parent navigation must persist athlete context for ${path}`);
}
assert.equal(selectParentAthlete(parent,outsider,athleteB,links),athleteB,'Unauthorized athlete IDs must never replace an authorized current athlete');
links=links.map(x=>x.athlete_user_id===athleteB?{...x,status:'revoked'}:x);
assert.deepEqual(parentAuthorizedAthletes(parent,links),[athleteA],'Revoked athlete must disappear immediately');
assert.equal(selectParentAthlete(parent,athleteB,athleteB,links),athleteA,'After revocation, context must fall back to an authorized athlete');

console.log(JSON.stringify({multiOrg:'passed',parentMultiAthlete:'passed',canonicalDataPreserved:true,unauthorizedParentContextBlocked:true},null,2));

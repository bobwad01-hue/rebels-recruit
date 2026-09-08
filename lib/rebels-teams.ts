export const REBELS_TEAMS=[
'KC Rebels 18 National Mayhugh',
'KC Rebels 18 Regional Jenkins',
'KC Rebels 16 National Olsen',
'KC Rebels 16 Regional Lickel',
'KC Rebels 16A Frans',
'KC Rebels 14 National Shafer',
'KC Rebels 14 Regional Oestmann',
] as const;

export type RebelsTeamName=typeof REBELS_TEAMS[number];

# Onboarding organization/team picker fix

The profile UI filters organization picker rows to `status === "active"`. The onboarding API now marks directory choices as selectable/active for the picker while still creating the real organization membership only when the athlete saves Profile Essentials.

This restores organization options for brand-new athletes and enables the dependent Team selector after an organization is selected.

A reusable searchable `OrganizationTeamPicker` component is included for the follow-up UI replacement of the native select.

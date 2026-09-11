insert into public.legal_document_versions(document_type,version,effective_at,document_url,is_current)
values
 ('terms_of_service','2026-09-08','2026-09-08T00:00:00Z','https://rebelsrecruit.com/terms',true),
 ('privacy_policy','2026-09-08','2026-09-08T00:00:00Z','https://rebelsrecruit.com/privacy',true)
on conflict (document_type,version) do update
set effective_at=excluded.effective_at,
    document_url=excluded.document_url,
    is_current=true;

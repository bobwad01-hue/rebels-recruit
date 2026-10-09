CREATE POLICY platform_owner_coach_update
ON public.college_coaches
FOR UPDATE TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.platform_roles
 WHERE user_id = auth.uid() AND role = 'super_owner'
))
WITH CHECK (EXISTS (
 SELECT 1 FROM public.platform_roles
 WHERE user_id = auth.uid() AND role = 'super_owner'
));

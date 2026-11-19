-- Applied to production 2026-09-12 (migration revoke_trigger_function_execute).
-- Trigger functions fire regardless of the invoking role's EXECUTE privilege,
-- so revoking only closes the anon-callable-over-RPC advisor finding.
revoke all on function public.enforce_application_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_negotiation_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_hire_request_update_authority() from public, anon, authenticated;
revoke all on function public.enforce_contract_update_authority() from public, anon, authenticated;

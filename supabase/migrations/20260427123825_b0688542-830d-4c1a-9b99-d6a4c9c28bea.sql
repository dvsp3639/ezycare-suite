REVOKE ALL ON FUNCTION public.next_pharmacy_invoice_no(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_pharmacy_invoice_no(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.next_pharmacy_invoice_no(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.prepare_pharmacy_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_pharmacy_order() FROM anon;
REVOKE ALL ON FUNCTION public.prepare_pharmacy_order() FROM authenticated;
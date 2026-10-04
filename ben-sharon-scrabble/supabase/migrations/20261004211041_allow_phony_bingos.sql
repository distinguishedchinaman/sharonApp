-- Matches the migration applied to production; preserve all other validation.
DO $migration$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.valid_journal_game(jsonb,uuid)'::regprocedure);
  IF position('^[A-Za-z?]{2,30}$' in definition) = 0 THEN RAISE EXCEPTION 'Expected bingo validation not found'; END IF;
  EXECUTE replace(definition, '^[A-Za-z?]{2,30}$', '^[A-Za-z?]{2,30}[*]?$');
END;
$migration$;

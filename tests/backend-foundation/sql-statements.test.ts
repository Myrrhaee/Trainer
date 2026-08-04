import assert from "node:assert/strict";
import test from "node:test";

import { splitPostgresStatements } from "../../scripts/db/sql-statements.mjs";

test("PostgreSQL migration statements preserve quoted semicolons and comments", () => {
  const statements = splitPostgresStatements(`
    -- setup; remains attached to the statement
    CREATE TABLE example (value text DEFAULT ';');
    CREATE FUNCTION example_fn()
    RETURNS text LANGUAGE plpgsql AS $function$
    BEGIN
      /* nested /* comment; */ remains valid */
      RETURN 'value;still-value';
    END
    $function$;
    SELECT "semi;colon" FROM example;
  `);

  assert.equal(statements.length, 3);
  assert.match(statements[0], /CREATE TABLE example/);
  assert.match(statements[1], /RETURN 'value;still-value'/);
  assert.match(statements[2], /"semi;colon"/);
});

test("PostgreSQL migration splitter rejects unterminated delimiters", () => {
  assert.throws(
    () => splitPostgresStatements("SELECT $body$unterminated;"),
    /Unterminated PostgreSQL statement delimiter/,
  );
});

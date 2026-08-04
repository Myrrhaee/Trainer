function dollarQuoteAt(sql, index) {
  if (sql[index] !== "$") return null;
  const end = sql.indexOf("$", index + 1);
  if (end === -1) return null;
  const tag = sql.slice(index + 1, end);
  if (tag && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) return null;
  return sql.slice(index, end + 1);
}

export function splitPostgresStatements(sql) {
  const statements = [];
  let start = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let dollarQuote = null;
  let lineComment = false;
  let blockCommentDepth = 0;

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (current === "/" && next === "*") {
        blockCommentDepth += 1;
        index += 1;
      } else if (current === "*" && next === "/") {
        blockCommentDepth -= 1;
        index += 1;
      }
      continue;
    }
    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }
    if (singleQuoted) {
      if (current === "'" && next === "'") {
        index += 1;
      } else if (current === "\\") {
        index += 1;
      } else if (current === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (current === '"' && next === '"') {
        index += 1;
      } else if (current === '"') {
        doubleQuoted = false;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      lineComment = true;
      index += 1;
    } else if (current === "/" && next === "*") {
      blockCommentDepth = 1;
      index += 1;
    } else if (current === "'") {
      singleQuoted = true;
    } else if (current === '"') {
      doubleQuoted = true;
    } else if (current === "$") {
      const tag = dollarQuoteAt(sql, index);
      if (tag) {
        dollarQuote = tag;
        index += tag.length - 1;
      }
    } else if (current === ";") {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }

  if (singleQuoted || doubleQuoted || dollarQuote || blockCommentDepth > 0) {
    throw new Error("Unterminated PostgreSQL statement delimiter");
  }
  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  return statements;
}

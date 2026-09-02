# Formula reference

Formula columns compute a value per row from the other columns of the note. The syntax is spreadsheet-style — if you have used Excel or Google Sheets, you already know most of it.

```text
IF(status = "Done", "✓", DATEDIFF(created, NOW(), "days") & " days open")
```

## Referencing columns

| Syntax | Example | Notes |
|--------|---------|-------|
| Bare name | `price * quantity` | Works when the name has no spaces |
| Brackets | `[Due Date]` | For names with spaces or symbols |
| `PROP("name")` | `PROP("Due Date")` | Notion-style; the name is a string, matched case-insensitively |
| `_title` | `LEN(_title)` | The note's title |

## Operators

| Operator | Meaning |
|----------|---------|
| `+` `-` `*` `/` | Arithmetic (division by zero returns empty, not an error) |
| `&` | Text concatenation: `"v" & version` |
| `=` or `==` | Equal |
| `<>` or `!=` | Not equal |
| `>` `<` `>=` `<=` | Comparison (numbers, text or dates) |

Function names are case-insensitive: `if(...)`, `If(...)` and `IF(...)` are the same function.

## Logic

| Function | Description |
|----------|-------------|
| `IF(condition, then, else?)` | Returns `then` when the condition is truthy, otherwise `else` (or empty) |
| `IFS(cond1, val1, cond2, val2, …)` | Returns the value paired with the first true condition |
| `AND(a, b, …)` | True when every argument is truthy |
| `OR(a, b, …)` | True when any argument is truthy |
| `NOT(value)` | Logical negation |

## Aggregation

With a single column argument, these operate **across all rows** of the database. `SUM`, `MIN` and `MAX` also accept a list of values; `AVG`, `COUNT` and `COUNTA` take a column only.

| Function | Description |
|----------|-------------|
| `SUM(column)` / `SUM(a, b, …)` | Sum |
| `AVG(column)` (aliases: `AVERAGE`, `MEAN`) | Arithmetic mean |
| `COUNT(column)` | Count of numeric values |
| `COUNTA(column)` | Count of non-empty values |
| `MIN(…)` / `MAX(…)` | Smallest / largest value |

## Text

| Function | Description |
|----------|-------------|
| `CONCAT(a, b, …)` | Joins values into one string |
| `LEN(text)` (alias: `LENGTH`) | Number of characters |
| `UPPER(text)` / `LOWER(text)` | Case conversion |
| `TRIM(text)` | Strips surrounding whitespace |
| `LEFT(text, n)` / `RIGHT(text, n)` | First / last `n` characters |
| `MID(text, start, count)` | `count` characters starting at position `start` (1-based) |
| `SUBSTITUTE(text, from, to)` | Replaces every occurrence of `from` with `to` (literal, no regex) |

## Math

| Function | Description |
|----------|-------------|
| `ROUND(n, decimals?)` | Rounds to `decimals` places (default 0) |
| `FLOOR(n)` / `CEIL(n)` (alias: `CEILING`) | Round down / up to an integer |
| `ABS(n)` | Absolute value |
| `MOD(n, divisor)` | Remainder |
| `POWER(base, exponent)` (alias: `POW`) | Exponentiation |
| `SQRT(n)` | Square root |

## Empty values and conversion

| Function | Description |
|----------|-------------|
| `ISNULL(value)` | True when the value is missing |
| `ISEMPTY(value)` (alias: `EMPTY`) | True when missing or blank |
| `COALESCE(a, b, …)` | First non-empty argument |
| `TEXT(value)` | Converts to text |
| `VALUE(text)` (alias: `TONUMBER`) | Converts to a number |

## Dates

Date units accept singular, plural and short forms: `years`/`y`, `months`/`m`, `weeks`/`w`, `days`/`d` (the default), `hours`/`h`, `minutes`/`min`.

| Function | Description |
|----------|-------------|
| `NOW()` | Current date and time |
| `TODAY()` | Current date at midnight |
| `DATE(year, month, day)` | Builds a date |
| `YEAR(date)` `MONTH(date)` `DAY(date)` `HOUR(date)` `MINUTE(date)` | Extracts a component (`DAY` is the day of the month) |
| `WEEKDAY(date)` | Day of the week: 1 = Sunday … 7 = Saturday |
| `DATEDIFF(start, end, unit?)` (alias: `DATEDIF`) | `end − start` in the given unit |
| `DATEBETWEEN(end, start, unit?)` | Notion's argument order: `end − start` |
| `DATEADD(date, n, unit?)` | Date shifted forward by `n` units |
| `DATESUBTRACT(date, n, unit?)` | Date shifted back by `n` units |
| `FORMATDATE(date, format)` | Formats with `YYYY` `YY` `MM` `DD` `HH` `mm` `ss` tokens, e.g. `"DD/MM/YYYY"` |

Day differences are computed on calendar days, so daylight-saving transitions do not shift the result.

## Coming from Notion?

Most Notion formula names work as-is — `dateBetween`, `dateSubtract`, `dateAdd`, `prop`, `formatDate`, `length`, `empty`, `toNumber`, `mean`, `pow`, `if`, `and`, `or`, `not`, `concat`, `abs`, `ceil`, `floor`, `round`, `sqrt`, `min`, `max`, `now`, `today` all evaluate the way you expect. The differences worth knowing:

| Notion | Here | Note |
|--------|------|------|
| `prop("Status")` | `PROP("Status")`, `[Status]` or `status` | All three work |
| `day(date)` | `WEEKDAY(date)` | Notion's `day()` is the day of the **week**; here it returns 1–7 (Sunday = 1) instead of 0–6 |
| `date(date)` | `DAY(date)` | Day of the month; `DATE(y, m, d)` here is the date constructor |
| `format(x)` | `TEXT(x)` | |
| `replaceAll(t, a, b)` | `SUBSTITUTE(t, a, b)` | Literal match — no regular expressions |
| `slice(t, a, b)` | `MID(t, start, count)` | 1-based start and a length, not an end index |
| Ternary `a ? b : c` | `IF(a, b, c)` | |

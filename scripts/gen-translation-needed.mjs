// Regenerates messages/TRANSLATION_NEEDED.md from src/i18n/untranslated-baseline.json.
// Usage: node scripts/gen-translation-needed.mjs .
import fs from "node:fs";
const root = process.argv[2];
const en = JSON.parse(fs.readFileSync(`${root}/messages/en.json`, "utf8"));
const baseline = JSON.parse(fs.readFileSync(`${root}/src/i18n/untranslated-baseline.json`, "utf8")).keys;
const flat = {};
(function walk(o, p) { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") walk(v, key); else flat[key] = v; } })(en, "");
const groups = new Map();
for (const key of baseline) {
  if (!(key in flat)) continue;
  const ns = key.split(".")[0];
  if (!groups.has(ns)) groups.set(ns, []);
  groups.get(ns).push(key);
}
// What students see first, then teachers, then staff screens.
const priority = ["classJoin", "enroll", "liveSession", "login", "register", "forgotPassword", "resetPassword", "classDetail", "classes", "dashboard", "nav", "profile", "ai", "landing", "contact", "attendance", "classLifecycle", "teacherSetup"];
const order = [...groups.keys()].sort((a, b) => {
  const pa = priority.indexOf(a), pb = priority.indexOf(b);
  if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
  return groups.get(b).length - groups.get(a).length;
});
const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
const old = fs.readFileSync(`${root}/messages/TRANSLATION_NEEDED.md`, "utf8");
const swStart = old.indexOf("## Outside the message files");
const swEnd = old.indexOf("\n---", swStart);
const swSection = old.slice(swStart, swEnd).trimEnd();
const esc = (s) => s.replace(/"/g, '\\"');
let out = `# Dari translation needed

**${total} strings** in the app are still showing **English** to Dari readers.
The keys exist in \`messages/fa.json\`, so nothing errors — the English text was left in place
when these features shipped. The sections are ordered by who sees them: what students see first
(the class join page, the live class page, sign-in), then teachers, then staff screens.

This file is generated from \`src/i18n/untranslated-baseline.json\` by \`node scripts/gen-translation-needed.mjs .\`.
Regenerate it rather than editing the list by hand, so it never drifts from what the app shows.

## Who fills this in

A native Dari speaker on the team. **Please do not run this through Google Translate or an AI**
— machine-translated Dari has gone out on this platform before and had to be pulled. If a string
is awkward to translate, leave it blank and say so; blank is better than wrong.

## How to fill it in

Write the Dari next to each line. Anything in curly braces — \`{count}\`, \`{name}\`, \`{date}\` —
is a value the app substitutes at runtime. **Keep those exactly as they are**, including the braces;
you can move them to wherever they belong in the Dari sentence, but do not translate or rename them.

Send the finished file back and we will load it in. A test blocks any *new* English-only
string from being added, so this list can only get shorter.

---

${swSection}

---
`;
for (const ns of order) {
  const keys = groups.get(ns);
  out += `\n## \`${ns}\`  ·  ${keys.length} string${keys.length === 1 ? "" : "s"}\n\n`;
  for (const key of keys) out += `- **English:** "${esc(String(flat[key]))}"\n  **Dari:** \n  <sub>\`${key}\`</sub>\n\n`;
}
fs.writeFileSync(`${root}/messages/TRANSLATION_NEEDED.md`, out.trimEnd() + "\n");
console.log("strings:", total, "sections:", order.length, "missing-from-en:", baseline.length - total);

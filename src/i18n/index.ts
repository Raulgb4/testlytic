import en from "./locales/en.json";
import es from "./locales/es.json";

export type Language = "English" | "Spanish";

type Dictionaries = {
  English: Record<string, unknown>;
  Spanish: Record<string, unknown>;
};

const dictionaries: Dictionaries = {
  English: en,
  Spanish: es,
};

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function format(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(.*?)\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function createTranslator(language: Language) {
  return (key: string, values?: Record<string, string | number>) => {
    const primary = getByPath(dictionaries[language], key);
    const fallback = getByPath(dictionaries.English, key);
    const message =
      typeof primary === "string" ? primary : typeof fallback === "string" ? fallback : key;
    return format(message, values);
  };
}

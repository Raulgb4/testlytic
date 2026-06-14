import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import es from "./locales/es.json";

describe("i18n locale parity", () => {
  it("keeps English and Spanish locale keys in sync", () => {
    expect(flattenKeys(es)).toEqual(flattenKeys(en));
  });

  it("keeps placeholder variables in sync across locales", () => {
    const enMessages = flattenMessages(en);
    const esMessages = flattenMessages(es);

    for (const key of Object.keys(enMessages)) {
      expect(placeholders(esMessages[key] ?? ""), key).toEqual(placeholders(enMessages[key]));
    }
  });
});

function flattenKeys(source: unknown) {
  return Object.keys(flattenMessages(source)).sort();
}

function flattenMessages(source: unknown, prefix = ""): Record<string, string> {
  if (!source || typeof source !== "object") return {};
  return Object.entries(source as Record<string, unknown>).reduce<Record<string, string>>(
    (messages, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") {
        messages[path] = value;
      } else {
        Object.assign(messages, flattenMessages(value, path));
      }
      return messages;
    },
    {},
  );
}

function placeholders(message: string) {
  return Array.from(message.matchAll(/\{(.*?)\}/g), ([, key]) => key.trim()).sort();
}

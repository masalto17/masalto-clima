import { describe, expect, it, vi } from "vitest";
import { handleUpdate, isValidSecret, type TelegramDeps, type TelegramUpdate } from "./handler";
import { generateLinkCode, hashLinkCode } from "./link-codes";

function deps(linkedName: string | null): TelegramDeps {
  return {
    appUrl: "https://clima.test",
    findLinkedName: vi.fn().mockResolvedValue(linkedName),
    createLinkCode: vi.fn().mockResolvedValue("codigo-1"),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

function update(text: string, type = "private"): TelegramUpdate {
  return { message: { text, chat: { id: 42, type }, from: { first_name: "Hugo" } } };
}

describe("handleUpdate", () => {
  it("saluda por nombre a un chat vinculado", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("buenas"), d);
    expect(d.sendMessage).toHaveBeenCalledWith("42", "hola, Hugo");
    expect(d.createLinkCode).not.toHaveBeenCalled();
  });

  it("ignora a un chat no vinculado", async () => {
    const d = deps(null);
    await handleUpdate(update("buenas"), d);
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.createLinkCode).not.toHaveBeenCalled();
  });

  it("con /start manda el link de vinculación a un chat no vinculado", async () => {
    const d = deps(null);
    await handleUpdate(update("/start"), d);
    expect(d.createLinkCode).toHaveBeenCalledWith("42", "Hugo");
    expect(d.sendMessage).toHaveBeenCalledWith(
      "42",
      expect.stringContaining("https://clima.test/vincular?codigo=codigo-1"),
    );
  });

  it("ignora grupos y updates sin mensaje", async () => {
    const d = deps("Hugo");
    await handleUpdate(update("/start", "group"), d);
    await handleUpdate({}, d);
    expect(d.findLinkedName).not.toHaveBeenCalled();
    expect(d.sendMessage).not.toHaveBeenCalled();
  });
});

describe("isValidSecret", () => {
  it("acepta solo el secreto exacto", () => {
    expect(isValidSecret("abc", "abc")).toBe(true);
    expect(isValidSecret("abd", "abc")).toBe(false);
    expect(isValidSecret("abcd", "abc")).toBe(false);
    expect(isValidSecret(null, "abc")).toBe(false);
    expect(isValidSecret("", "")).toBe(false);
  });
});

describe("link codes", () => {
  it("genera códigos distintos y hashea de forma estable", () => {
    const a = generateLinkCode();
    expect(a).not.toBe(generateLinkCode());
    expect(hashLinkCode(a)).toBe(hashLinkCode(a));
    expect(hashLinkCode(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

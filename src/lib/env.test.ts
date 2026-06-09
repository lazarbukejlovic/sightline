import { describe, it, expect } from "vitest";
import { parseClientEnv, parseServerEnv } from "@/lib/env";

const validClient = {
  NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_SITE_URL: "https://sightline.app",
};

const validServer = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  DATABASE_URL: "postgresql://user:pass@host:6543/postgres",
  DIRECT_URL: "postgresql://user:pass@host:5432/postgres",
  ANTHROPIC_API_KEY: "sk-ant-test",
  OPENAI_API_KEY: "sk-openai-test",
  FIRECRAWL_API_KEY: "fc-test",
};

describe("client env", () => {
  it("parses a valid client environment", () => {
    const env = parseClientEnv(validClient);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://sightline.app");
  });

  it("defaults the site url when omitted", () => {
    const { NEXT_PUBLIC_SITE_URL: _omit, ...rest } = validClient;
    void _omit;
    const env = parseClientEnv(rest);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a non-url supabase url", () => {
    expect(() =>
      parseClientEnv({ ...validClient, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow(/Invalid client environment/);
  });

  it("rejects a missing anon key", () => {
    expect(() =>
      parseClientEnv({ ...validClient, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }),
    ).toThrow(/Invalid client environment/);
  });
});

describe("server env", () => {
  it("parses a valid server environment", () => {
    const env = parseServerEnv(validServer);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
  });

  it("defaults the reasoning model to claude-opus-4-8", () => {
    const env = parseServerEnv(validServer);
    expect(env.ANTHROPIC_MODEL).toBe("claude-opus-4-8");
    expect(env.OPENAI_EMBEDDING_MODEL).toBe("text-embedding-3-small");
  });

  it("rejects a missing Anthropic key", () => {
    const { ANTHROPIC_API_KEY: _omit, ...rest } = validServer;
    void _omit;
    expect(() => parseServerEnv(rest)).toThrow(/Invalid server environment/);
  });

  it("rejects a missing service role key", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omit, ...rest } = validServer;
    void _omit;
    expect(() => parseServerEnv(rest)).toThrow(/Invalid server environment/);
  });
});

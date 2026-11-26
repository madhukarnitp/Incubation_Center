import type { FastifyInstance } from "fastify";
import { toNodeHandler } from "better-auth/node";

import { auth } from "@repo/auth/server";
import { env } from "../../env";

const handler = toNodeHandler(auth);

export async function betterAuthRoutes(app: FastifyInstance) {
  // Support direct browser GET navigation to /sign-in/social
  app.get("/sign-in/social", async (request, reply) => {
    const query = (request.query || {}) as {
      provider?: string;
      callbackURL?: string;
    };
    const provider = query.provider || "google";
    const callbackURL = query.callbackURL;
    if (!callbackURL) {
      return reply.status(400).send({ error: "callbackURL query parameter is required" });
    }

    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") webHeaders.append(key, value);
      else if (Array.isArray(value)) value.forEach((v) => webHeaders.append(key, v));
    }

    try {
      const res = await auth.api.signInSocial({
        body: {
          provider: provider as any,
          callbackURL,
        },
        headers: webHeaders,
      });

      if (res && (res as any).url) {
        return reply.redirect((res as any).url);
      }
    } catch (err) {
      request.log.error(err, "Failed to get social sign-in URL from BetterAuth");
    }

    // Direct Google OAuth URL redirect fallback
    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = env.GOOGLE_URL;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=openid%20profile%20email&prompt=select_account&state=${encodeURIComponent(
      callbackURL,
    )}`;

    return reply.redirect(googleAuthUrl);
  });

  // Prevent Fastify from consuming the request body for standard BetterAuth endpoints -
  // BetterAuth needs to read the raw Node stream itself.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", function (_request, _payload, done) {
    done(null);
  });

  app.all("/*", async (request, reply) => {
    // Copy headers set by Fastify (like CORS) to the raw Node response
    for (const [key, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) {
        reply.raw.setHeader(key, value as any);
      }
    }

    const isOAuthCallback =
      request.method === "GET" && request.url.includes("/callback/");

    reply.hijack();

    if (isOAuthCallback) {
      const raw = reply.raw;
      const origWrite = raw.write.bind(raw);
      const origEnd = raw.end.bind(raw);
      const origWriteHead = raw.writeHead.bind(raw);
      const chunks: Buffer[] = [];
      let capturedStatus = 200;
      let bufferingError = false;

      raw.writeHead = ((statusCode: number, ...args: any[]) => {
        capturedStatus = statusCode;
        if (statusCode >= 400) {
          bufferingError = true;
          return raw;
        }
        // Rewrite BetterAuth OAuth redirect errors (e.g. unable_to_create_user) to /login?error=not_found
        if (statusCode >= 300 && statusCode < 400) {
          const headersArg =
            typeof args[0] === "object" ? args[0] : typeof args[1] === "object" ? args[1] : null;
          const loc = headersArg?.location || headersArg?.Location || raw.getHeader("location");
          if (typeof loc === "string" && loc.includes("error=")) {
            const lowerLoc = loc.toLowerCase();
            const frontendOrigin =
              env.CORS_ORIGIN?.[0]?.replace(/\/+$/, "") || "http://localhost:3000";
            let mappedError = "sign_in_failed";
            if (
              lowerLoc.includes("unable_to_create_user") ||
              lowerLoc.includes("not_found") ||
              lowerLoc.includes("not_registered")
            ) {
              mappedError = "not_found";
            } else if (
              lowerLoc.includes("forbidden") ||
              lowerLoc.includes("access_denied") ||
              lowerLoc.includes("suspended")
            ) {
              mappedError = "forbidden";
            }
            const nextLoc = `${frontendOrigin}/login?error=${mappedError}`;
            if (headersArg) {
              if ("location" in headersArg) headersArg.location = nextLoc;
              if ("Location" in headersArg) headersArg.Location = nextLoc;
            }
            if (raw.hasHeader("location")) {
              raw.setHeader("location", nextLoc);
            }
          }
        }
        return origWriteHead(statusCode, ...args);
      }) as any;

      raw.write = ((chunk: any, ...args: any[]) => {
        if (bufferingError || raw.statusCode >= 400) {
          bufferingError = true;
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          return true;
        }
        return origWrite(chunk, ...args);
      }) as any;

      raw.end = ((chunk?: any, ...args: any[]) => {
        if (bufferingError || raw.statusCode >= 400 || capturedStatus >= 400) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          let msg = "";
          try {
            const parsed = JSON.parse(bodyStr);
            msg = parsed?.message || parsed?.error || bodyStr;
          } catch {
            msg = bodyStr;
          }

          const lower = msg.toLowerCase();
          let errorCode = "sign_in_failed";
          if (lower.includes("not found") || lower.includes("not registered")) {
            errorCode = "not_found";
          } else if (
            lower.includes("suspended") ||
            lower.includes("forbidden") ||
            lower.includes("invalid google")
          ) {
            errorCode = "forbidden";
          }

          const frontendOrigin =
            env.CORS_ORIGIN?.[0]?.replace(/\/+$/, "") || "http://localhost:3000";
          const loginUrl = `${frontendOrigin}/login?error=${encodeURIComponent(errorCode)}`;

          raw.removeHeader("content-type");
          raw.removeHeader("content-length");
          origWriteHead(302, { Location: loginUrl });
          return origEnd();
        }
        return origEnd(chunk, ...args);
      }) as any;
    }

    try {
      await handler(request.raw, reply.raw);
    } catch (err) {
      console.error("BetterAuth error:");
      console.error(err);
      if (isOAuthCallback && !reply.raw.headersSent) {
        const frontendOrigin =
          env.CORS_ORIGIN?.[0]?.replace(/\/+$/, "") || "http://localhost:3000";
        reply.raw.writeHead(302, {
          Location: `${frontendOrigin}/login?error=sign_in_failed`,
        });
        reply.raw.end();
        return;
      }
      throw err;
    }
    return;
  });
}

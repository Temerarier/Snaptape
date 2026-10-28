import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (_auth, request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-snaptape-return-to", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}, () => ({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  proxyUrl: process.env.CLERK_PROXY_URL || undefined,
  signInUrl: "/login",
  signUpUrl: "/sign-up",
}));

export const config = { matcher: [
  // Staff routes may have file extensions (debug.svg); they still need Clerk.
  "/viewer-next/:path*",
  "/((?!_next|.*\\.(?:css|js|jpg|jpeg|png|gif|svg|ico|woff2?)).*)",
] };

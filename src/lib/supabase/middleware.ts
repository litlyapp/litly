import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const SUPABASE_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Supabase request timed out")), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const protectedRoutes = ["/saved", "/following", "/dashboard", "/events/new", "/become-organizer", "/account"];
  const organizerRoutes = ["/dashboard", "/events/new"];
  const pathname = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isOrganizerOnly = organizerRoutes.some((r) => pathname.startsWith(r));
  const isEditRoute = /^\/events\/[^/]+\/edit$/.test(pathname);

  let user;
  try {
    const {
      data: { user: authUser },
    } = await withTimeout(supabase.auth.getUser(), SUPABASE_TIMEOUT_MS);
    user = authUser;
  } catch {
    // Supabase auth is slow/unreachable. Don't hang the whole request on it —
    // let public pages through, but still gate protected routes.
    if (isProtected || isEditRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if ((isProtected || isEditRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((isOrganizerOnly || isEditRoute) && user) {
    try {
      const { data: profile } = await withTimeout(
        supabase.from("users").select("role").eq("id", user.id).single(),
        SUPABASE_TIMEOUT_MS
      );

      if (profile?.role !== "organizer") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    } catch {
      // Supabase DB is slow/unreachable — fail closed on the organizer check.
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

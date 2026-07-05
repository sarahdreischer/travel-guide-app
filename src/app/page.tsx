import { redirect } from "next/navigation";

/**
 * Root page — immediately redirects to the login page.
 * Authenticated users will be redirected onward by middleware.
 */
export default function RootPage() {
  redirect("/login");
}

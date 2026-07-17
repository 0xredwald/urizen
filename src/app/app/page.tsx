import { redirect } from "next/navigation";

// The fund dashboard now lives at /fund; keep /app as a redirect for old links.
export default function AppRedirect() {
  redirect("/fund");
}

import { Link } from "react-router-dom";
import { Btn, Card, EmptyState } from "../shared/ui";

/** Shown for any URL that doesn't match a real route — an explicit "page not found" instead of a
 * silent redirect to /dashboard, so a broken/stale link or a typo is obvious rather than looking
 * like the app just ignored the navigation. */
export function NotFound() {
  return (
    <Card>
      <EmptyState
        icon="🧭"
        title="Page not found"
        hint="There's no page at this address — it may have moved, or the link might be out of date."
        action={
          <Link to="/dashboard">
            <Btn>Back to Dashboard</Btn>
          </Link>
        }
      />
    </Card>
  );
}

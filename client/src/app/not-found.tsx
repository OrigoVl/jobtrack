import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Btn, Card, EmptyState } from "../shared/ui";

/** Shown for any URL that doesn't match a real route — an explicit "page not found" instead of a
 * silent redirect to /dashboard, so a broken/stale link or a typo is obvious rather than looking
 * like the app just ignored the navigation. */
export function NotFound() {
  const { t } = useTranslation(["chrome", "common"]);
  return (
    <Card>
      <EmptyState
        icon="🧭"
        title={t("notFound.title")}
        hint={t("notFound.hint")}
        action={
          <Link to="/dashboard">
            <Btn>{t("notFound.backToDashboard")}</Btn>
          </Link>
        }
      />
    </Card>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authInputClass } from "./auth-layout";
import { EyeIcon, EyeOffIcon } from "../../shared/icons";

/** Password field with a show/hide toggle glued to the right edge — same positioning convention
 * as shared/date-input.tsx's calendar-icon button. Extra right padding (pr-9) keeps typed text
 * from running under the icon. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
}) {
  const { t } = useTranslation("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${authInputClass} pr-9`}
      />
      <button
        type="button"
        aria-label={visible ? t("passwordInput.hide") : t("passwordInput.show")}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink leading-none"
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

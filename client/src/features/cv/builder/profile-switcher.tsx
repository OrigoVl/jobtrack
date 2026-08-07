import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CvProfile } from "../../../shared/types";
import { useConfirm } from "../../../shared/use-confirm";
import { usePopover } from "../../../shared/use-popover";
import { PopoverPanel } from "../../../shared/popover";
import { Btn } from "../../../shared/ui";

interface ProfileSwitcherProps {
  profiles: CvProfile[];
  activeId: number;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  creating: boolean;
  /** Profile id currently being renamed/duplicated/deleted (the mutation's own `variables`), or
   * `undefined` when none is in flight — lets the menu disable/dim only while ITS profile's own
   * mutation is pending, not just while any one of them anywhere is. */
  renamingProfileId: number | undefined;
  duplicatingProfileId: number | undefined;
  deletingProfileId: number | undefined;
  atLimit: boolean;
  maxProfiles: number;
}

/**
 * Switches between the account's (up to `maxProfiles`) named CV versions, each with its own
 * doc/presets/share-link, and manages them (rename/duplicate/delete/new).
 *
 * This used to be a full-width strip of tab pills under the page header — a THIRD row of tabs on
 * a page that already has the CV section's own nav above it and the editor's Content/Appearance
 * switch below, none of which are the same kind of choice. Which CV you're editing is closer to a
 * document title than to navigation, so it now lives as one compact control in the page header's
 * action row: the current CV's name, opening a menu of the others plus the management actions.
 * Rename still happens inline (the trigger becomes an input), and delete still goes through the
 * app-wide confirm dialog, same as every other destructive action here.
 */
export function ProfileSwitcher({
  profiles,
  activeId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  creating,
  renamingProfileId,
  duplicatingProfileId,
  deletingProfileId,
  atLimit,
  maxProfiles,
}: ProfileSwitcherProps) {
  const { t } = useTranslation(["cv", "common"]);
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const width = 240;
  const { open, setOpen, anchorRef, panelRef, coords } = usePopover((rect) => ({
    top: rect.bottom + 4,
    left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
  }));

  const active = profiles.find((p) => p.id === activeId);
  const activeName = active?.name || t("builder.profiles.unnamed");

  // Switching CVs shouldn't leave a stale "renaming" input open over the new one's name.
  useEffect(() => setRenaming(false), [activeId]);
  // Focuses the rename input on open without the project-banned `autoFocus` prop — same pattern
  // as shared/confirm.tsx's confirm button.
  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const startRename = () => {
    setRenameValue(active?.name ?? "");
    setRenaming(true);
    setOpen(false);
  };
  const commitRename = () => {
    const name = renameValue.trim();
    if (name && name !== active?.name) onRename(activeId, name);
    setRenaming(false);
  };
  const confirmDelete = async () => {
    if (!active) return;
    setOpen(false);
    if (await confirm({ title: t("builder.profiles.confirmDelete", { name: activeName }) })) onDelete(active.id);
  };

  if (renaming) {
    return (
      <input
        ref={renameInputRef}
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") setRenaming(false);
        }}
        maxLength={60}
        aria-label={t("builder.profiles.rename")}
        className="w-36 self-center rounded-lg border border-signal/40 bg-signal/10 px-2.5 py-1.5 text-sm focus:outline-none"
      />
    );
  }

  return (
    <div ref={anchorRef} className="relative self-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("builder.profiles.switcherAria", { name: activeName })}
        className="flex items-center gap-1.5 rounded-lg border border-grid bg-surface-2 px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-grid focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
      >
        <span className="max-w-[10rem] truncate">{activeName}</span>
        <span className={`text-[10px] text-ink-dim transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)} className="p-1" style={{ width }}>
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onSelect(p.id);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-surface-2 ${p.id === activeId ? "text-signal font-medium" : "text-ink"}`}
          >
            <span className="w-3 shrink-0" aria-hidden>
              {p.id === activeId ? "✓" : ""}
            </span>
            <span className="truncate">{p.name || t("builder.profiles.unnamed")}</span>
          </button>
        ))}
        <div className="my-1 h-px bg-grid" aria-hidden />
        <button
          type="button"
          onClick={startRename}
          disabled={renamingProfileId === activeId}
          className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          {t("builder.profiles.rename")}
        </button>
        <button
          type="button"
          onClick={() => {
            onDuplicate(activeId);
            setOpen(false);
          }}
          disabled={atLimit || duplicatingProfileId === activeId}
          title={atLimit ? t("builder.profiles.limitReached", { max: maxProfiles }) : undefined}
          className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          {t("builder.profiles.duplicate")}
        </button>
        {profiles.length > 1 && (
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deletingProfileId === activeId}
            className="w-full text-left rounded-lg px-2 py-1.5 text-sm text-alert hover:bg-alert/10 disabled:opacity-40"
          >
            {t("builder.profiles.delete")}
          </button>
        )}
        <div className="my-1 h-px bg-grid" aria-hidden />
        <div className="px-1 pb-0.5">
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            loading={creating}
            disabled={atLimit}
            title={atLimit ? t("builder.profiles.limitReached", { max: maxProfiles }) : undefined}
          >
            + {t("builder.profiles.addTab")}
          </Btn>
        </div>
      </PopoverPanel>
    </div>
  );
}

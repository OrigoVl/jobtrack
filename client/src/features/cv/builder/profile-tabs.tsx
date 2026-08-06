import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CvProfile } from "../../../shared/types";
import { useConfirm } from "../../../shared/use-confirm";
import { usePopover } from "../../../shared/use-popover";
import { PopoverPanel } from "../../../shared/popover";
import { Btn } from "../../../shared/ui";

interface ProfileTabsProps {
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

interface ProfileMenuProps {
  canDelete: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateDisabled: boolean;
  renamePending: boolean;
  duplicatePending: boolean;
  deletePending: boolean;
}

/** The active tab's "⋮" menu (rename/duplicate/delete) — a bare, borderless trigger (no Btn
 * chrome of its own) so it sits flush INSIDE the active tab's own pill instead of looking like a
 * second button bolted on next to it. Built directly on usePopover/PopoverPanel rather than the
 * shared Dropdown component, which always wraps its trigger in a bordered ghost Btn. */
function ProfileMenu({
  canDelete,
  onRename,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  renamePending,
  duplicatePending,
  deletePending,
}: ProfileMenuProps) {
  const { t } = useTranslation(["cv", "common"]);
  const width = 170;
  const { open, setOpen, anchorRef, panelRef, coords } = usePopover((rect) => ({
    top: rect.bottom + 4,
    left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
  }));
  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("builder.profiles.menuAria")}
        className="flex items-center justify-center w-6 h-6 rounded text-ink-dim hover:text-signal hover:bg-signal/15"
      >
        ⋮
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)} className="p-1" style={{ width }}>
        <button
          type="button"
          onClick={onRename}
          disabled={renamePending}
          className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          {t("builder.profiles.rename")}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={duplicateDisabled || duplicatePending}
          className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          {t("builder.profiles.duplicate")}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="w-full text-left rounded-lg px-2 py-1.5 text-sm text-alert hover:bg-alert/10 disabled:opacity-40"
          >
            {t("builder.profiles.delete")}
          </button>
        )}
      </PopoverPanel>
    </div>
  );
}

/** CV Builder's tab strip — up to `maxProfiles` named CV versions per account, each with its own
 * doc/presets/share-link. The active tab is a single bordered pill containing BOTH its label and
 * its "⋮" menu trigger (not two separately-boxed buttons side by side) — inactive tabs are plain
 * pills with no menu, since acting on a tab you're not viewing would need a switch first anyway.
 * Rename happens inline (double-click, or the menu's "Rename" item); delete goes through the
 * app-wide confirm dialog (shared/confirm.tsx), same as every other destructive action here. */
export function ProfileTabs({
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
}: ProfileTabsProps) {
  const { t } = useTranslation(["cv", "common"]);
  const confirm = useConfirm();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Switching tabs shouldn't leave a stale "renaming" input open on a tab that's no longer active.
  useEffect(() => setRenamingId(null), [activeId]);
  // Focuses the rename input on open without the project-banned `autoFocus` prop — same pattern
  // as shared/confirm.tsx's confirm button.
  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus();
  }, [renamingId]);

  const startRename = (p: CvProfile) => {
    setRenamingId(p.id);
    setRenameValue(p.name);
  };
  const commitRename = () => {
    if (renamingId == null) return;
    const name = renameValue.trim();
    if (name && name !== profiles.find((p) => p.id === renamingId)?.name) onRename(renamingId, name);
    setRenamingId(null);
  };
  const confirmDelete = async (p: CvProfile) => {
    if (await confirm({ title: t("builder.profiles.confirmDelete", { name: p.name || t("builder.profiles.unnamed") }) })) onDelete(p.id);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {profiles.map((p) => {
        const active = p.id === activeId;
        if (renamingId === p.id) {
          return (
            <input
              key={p.id}
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              maxLength={60}
              className="w-28 rounded-lg border border-signal/40 bg-signal/10 px-2.5 py-1.5 text-sm focus:outline-none"
            />
          );
        }
        if (!active) {
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              onDoubleClick={() => startRename(p)}
              title={t("builder.profiles.renameHint")}
              className="rounded-lg border border-grid bg-surface px-2.5 py-1.5 text-sm font-medium text-ink-dim hover:text-ink"
            >
              {p.name || t("builder.profiles.unnamed")}
            </button>
          );
        }
        return (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border border-signal/40 bg-signal/10 pl-2.5 pr-1 py-1">
            <button
              type="button"
              onDoubleClick={() => startRename(p)}
              title={t("builder.profiles.renameHint")}
              className="text-sm font-medium text-signal"
            >
              {p.name || t("builder.profiles.unnamed")}
            </button>
            <ProfileMenu
              canDelete={profiles.length > 1}
              onRename={() => startRename(p)}
              onDuplicate={() => onDuplicate(p.id)}
              onDelete={() => confirmDelete(p)}
              duplicateDisabled={atLimit}
              renamePending={renamingProfileId === p.id}
              duplicatePending={duplicatingProfileId === p.id}
              deletePending={deletingProfileId === p.id}
            />
          </div>
        );
      })}
      <Btn
        size="sm"
        variant="ghost"
        onClick={onCreate}
        loading={creating}
        disabled={atLimit}
        title={atLimit ? t("builder.profiles.limitReached", { max: maxProfiles }) : undefined}
      >
        + {t("builder.profiles.addTab")}
      </Btn>
    </div>
  );
}

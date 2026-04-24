'use client';

import { useEffect, useRef } from 'react';

import { useEditorStore } from '../model/editor.store';

interface Options {
  /**
   * When true, Delete/Backspace are suppressed because deletion is a
   * domain mutation. Tool-switch keys and Escape remain active —
   * switching tools and cancelling a draft are pure UI and do not
   * change `data`.
   */
  isMutatingBlocked: boolean;
}

const isEditableTarget = (t: EventTarget | null): boolean => {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
};

/**
 * Global keyboard shortcuts for the editor.
 *
 *   Escape      - cancel an in-progress draft or clear selection (UI, always on)
 *   Delete/Back - remove current selection (mutation, gated by isMutatingBlocked)
 *   V / W / R / D / O - quick tool switch (UI, always on)
 *
 * Any keypress originating from inside an input / textarea / select /
 * contenteditable element is ignored outright — so typing "w" in the
 * room-name field does not flip the active tool, and Delete/Backspace
 * continue to do their normal text-editing job.
 */
export function useEditorKeyboard({ isMutatingBlocked }: Options): void {
  // Latest flag value, so the handler closure never reads a stale copy
  // without forcing the effect itself to re-subscribe the listener.
  const blockedRef = useRef(isMutatingBlocked);
  blockedRef.current = isMutatingBlocked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return;

      const store = useEditorStore.getState();

      if (e.key === 'Escape') {
        if (store.draft) store.cancelDraft();
        else if (store.selection) store.setSelection(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (blockedRef.current) return;
        if (store.selection) {
          e.preventDefault();
          store.deleteSelected();
        }
        return;
      }

      // Quick tool switches only when no modifiers so we don't eat
      // browser shortcuts like Ctrl+W.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'v':
          store.setTool('select');
          break;
        case 'w':
          store.setTool('wall');
          break;
        case 'r':
          store.setTool('room');
          break;
        case 'd':
          store.setTool('door');
          break;
        case 'o':
          store.setTool('window');
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

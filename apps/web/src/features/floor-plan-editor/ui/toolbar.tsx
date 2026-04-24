'use client';

import { Button } from '@/components/ui/button';

import { useEditorStore, type Tool } from '../model/editor.store';

interface ToolDescriptor {
  id: Tool;
  label: string;
  hint: string;
}

const TOOLS: ToolDescriptor[] = [
  { id: 'select', label: 'Выбрать', hint: 'V — выделять и редактировать' },
  { id: 'wall', label: 'Стена', hint: 'W — два клика: начало и конец' },
  { id: 'room', label: 'Комната', hint: 'R — два клика: противоположные углы' },
  { id: 'door', label: 'Дверь', hint: 'D — клик по стене: позиция вдоль стены' },
  { id: 'window', label: 'Окно', hint: 'O — клик по стене' },
  { id: 'delete', label: 'Удалить', hint: 'клик по элементу' },
];

/**
 * Tool switcher. Never disabled: switching tools is pure UI and does
 * not mutate `data`. Drawing tools can be selected during a save — the
 * actual commit is gated separately by `isMutatingBlocked` in the
 * canvas.
 */
export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div
      className="flex items-center gap-2 border-b bg-card px-4 py-2"
      role="toolbar"
      aria-label="Инструменты редактора"
    >
      {TOOLS.map((t) => (
        <Button
          key={t.id}
          size="sm"
          variant={tool === t.id ? 'default' : 'outline'}
          onClick={() => setTool(t.id)}
          title={t.hint}
          aria-pressed={tool === t.id}
        >
          {t.label}
        </Button>
      ))}
      <div className="ml-auto text-xs text-muted-foreground">
        Средняя кнопка мыши — панорама, колесо — зум, Esc — отмена, Del — удалить
      </div>
    </div>
  );
}

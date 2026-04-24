'use client';

import {
  type CreateProjectInput,
  createProjectSchema,
  type ProjectType,
} from '@app/contracts';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/shared/api/client';

interface CreateProjectFormProps {
  onSubmit: (input: CreateProjectInput) => Promise<unknown>;
  onCancel: () => void;
}

interface FieldErrors {
  name?: string;
  description?: string;
  form?: string;
}

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  HOUSE: 'Частный дом',
  APARTMENT: 'Квартира',
  OTHER: 'Другое',
};

export function CreateProjectForm({ onSubmit, onCancel }: CreateProjectFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('HOUSE');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrors({});

    const parsed = createProjectSchema.safeParse({
      name,
      type,
      description: description.length > 0 ? description : undefined,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name') next.name = issue.message;
        else if (key === 'description') next.description = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
      setName('');
      setType('HOUSE');
      setDescription('');
      onCancel();
    } catch (e) {
      setErrors({
        form: e instanceof ApiError ? e.message : 'Не удалось создать проект',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый проект</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Название</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Загородный дом"
                disabled={submitting}
                aria-invalid={!!errors.name}
                autoFocus
                required
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-type">Тип</Label>
              <select
                id="project-type"
                value={type}
                onChange={(e) => setType(e.target.value as ProjectType)}
                disabled={submitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((key) => (
                  <option key={key} value={key}>
                    {PROJECT_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">Описание (необязательно)</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание проекта…"
              disabled={submitting}
              aria-invalid={!!errors.description}
              rows={3}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>

          {errors.form ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

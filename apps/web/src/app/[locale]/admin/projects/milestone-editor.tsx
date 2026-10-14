"use client";

import { useMemo, useState } from "react";
import { replaceProjectMilestones } from "./actions";

type Milestone = {
  key: string; id: string | null; title: string; description: string; weight: number;
  is_done: boolean; is_client_visible: boolean; preview_url: string; due_on: string;
};

type Labels = {
  title: string; description: string; weight: string; dueOn: string; previewUrl: string;
  done: string; visible: string; add: string; remove: string; save: string; total: string; totalHint: string;
};

function blank(index: number): Milestone {
  return { key: `new-${index}-${Math.random().toString(36).slice(2)}`, id: null, title: "", description: "", weight: 0, is_done: false, is_client_visible: true, preview_url: "", due_on: "" };
}

export function MilestoneEditor({ locale, projectId, initial, labels }: {
  locale: string; projectId: string; initial: Omit<Milestone, "key">[]; labels: Labels;
}) {
  const [rows, setRows] = useState<Milestone[]>(initial.length ? initial.map((row) => ({ ...row, key: row.id ?? crypto.randomUUID() })) : [blank(0)]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0), [rows]);
  const validTotal = Math.abs(total - 100) < 0.001;
  const serialized = JSON.stringify(rows.map((row, sort_order) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    weight: row.weight,
    is_done: row.is_done,
    is_client_visible: row.is_client_visible,
    preview_url: row.preview_url,
    due_on: row.due_on,
    sort_order,
  })));

  function update(index: number, values: Partial<Milestone>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row));
  }

  return (
    <form action={replaceProjectMilestones} className="milestone-editor">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="milestones" value={serialized} />
      <div className="milestone-total" data-valid={validTotal}><strong>{labels.total}: {total.toFixed(2)}%</strong><span>{labels.totalHint}</span></div>
      {rows.map((row, index) => (
        <fieldset className="milestone-card" key={row.key}>
          <legend>{index + 1}. {row.title || labels.title}</legend>
          <label className="content-field"><span>{labels.title}</span><input required maxLength={200} value={row.title} onChange={(event) => update(index, { title: event.target.value })} /></label>
          <label className="content-field"><span>{labels.weight}</span><input required type="number" min="0.01" max="100" step="0.01" value={row.weight || ""} onChange={(event) => update(index, { weight: Number(event.target.value) })} /></label>
          <label className="content-field content-field-wide"><span>{labels.description}</span><textarea rows={3} maxLength={3000} value={row.description} onChange={(event) => update(index, { description: event.target.value })} /></label>
          <label className="content-field"><span>{labels.dueOn}</span><input type="date" value={row.due_on} onChange={(event) => update(index, { due_on: event.target.value })} /></label>
          <label className="content-field"><span>{labels.previewUrl}</span><input type="url" maxLength={500} value={row.preview_url} onChange={(event) => update(index, { preview_url: event.target.value })} /></label>
          <label className="content-checkbox"><input type="checkbox" checked={row.is_done} onChange={(event) => update(index, { is_done: event.target.checked })} /><span><strong>{labels.done}</strong></span></label>
          <label className="content-checkbox"><input type="checkbox" checked={row.is_client_visible} onChange={(event) => update(index, { is_client_visible: event.target.checked })} /><span><strong>{labels.visible}</strong></span></label>
          <button className="content-secondary-button danger" type="button" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>{labels.remove}</button>
        </fieldset>
      ))}
      <div className="content-form-actions">
        <button className="content-secondary-button" type="button" onClick={() => setRows((current) => [...current, blank(current.length)])}>{labels.add}</button>
        <button className="content-primary-button" type="submit" disabled={!validTotal}>{labels.save}</button>
      </div>
    </form>
  );
}

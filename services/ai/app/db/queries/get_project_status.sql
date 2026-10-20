-- Retrieve client project status for AI status tool
SELECT
    project_id,
    title,
    description,
    status,
    client_progress_pct,
    due_on,
    preview_url,
    milestones,
    recent_updates
FROM public.get_client_project_status($1, $2);

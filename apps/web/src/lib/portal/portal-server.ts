import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPortalProjects, getPortalProjectById } from "./portal-catalog";
import type { PortalProject } from "./types";

export async function fetchClientProjects(): Promise<PortalProject[]> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return getPortalProjects();
    }

    // Attempt to query Supabase projects table if available
    const { data: dbProjects, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !dbProjects || dbProjects.length === 0) {
      return getPortalProjects();
    }

    // When real DB rows exist, fallback mapping or merge
    return getPortalProjects();
  } catch {
    return getPortalProjects();
  }
}

export async function fetchClientProjectById(id: string): Promise<PortalProject | null> {
  try {
    const project = getPortalProjectById(id);
    if (project) return project;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return getPortalProjectById(id) ?? null;
  } catch {
    return getPortalProjectById(id) ?? null;
  }
}

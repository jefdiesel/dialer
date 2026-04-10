"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createPlaybookFromResearch } from "@/lib/playbookResearch";

export async function generatePlaybook(formData: FormData) {
  const industry = String(formData.get("industry") ?? "").trim();
  if (!industry) throw new Error("industry required");
  const id = await createPlaybookFromResearch(industry);
  revalidatePath("/playbooks");
  redirect(`/playbooks/${id}`);
}

export async function updatePlaybook(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const markdown = String(formData.get("markdown") ?? "");
  const top3 = String(formData.get("top3UseCases") ?? "");
  // Validate JSON fields before saving so the user gets a clear error rather
  // than silently corrupting the row.
  try {
    JSON.parse(top3 || "[]");
  } catch {
    throw new Error("top3UseCases must be valid JSON");
  }
  await prisma.playbook.update({
    where: { id },
    data: { name, summary, markdown, top3UseCases: top3 || "[]" },
  });
  revalidatePath(`/playbooks/${id}`);
}

export async function publishPlaybook(id: string) {
  await prisma.playbook.update({ where: { id }, data: { status: "published" } });
  revalidatePath(`/playbooks/${id}`);
  revalidatePath("/playbooks");
}

export async function unpublishPlaybook(id: string) {
  await prisma.playbook.update({ where: { id }, data: { status: "draft" } });
  revalidatePath(`/playbooks/${id}`);
  revalidatePath("/playbooks");
}

export async function deletePlaybook(id: string) {
  await prisma.playbook.delete({ where: { id } });
  revalidatePath("/playbooks");
  redirect("/playbooks");
}

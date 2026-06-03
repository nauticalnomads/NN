import { createServiceClient } from "@/lib/supabase/service";

// Upload an image to the public `cms-assets` bucket and return its public URL,
// or null on failure / empty file. Shared by the homepage CMS and collection
// cover photos. Images are pre-cropped client-side (see ImageSlot) so this just
// stores the bytes.
export async function uploadImage(file: File, keyHint: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const sb = createServiceClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${keyHint}/${Date.now()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage
    .from("cms-assets")
    .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) return null;
  const { data } = sb.storage.from("cms-assets").getPublicUrl(path);
  return data.publicUrl;
}

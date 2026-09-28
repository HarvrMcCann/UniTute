import { createAdminClient } from "../src/lib/supabase/admin";
async function main() {
  const admin = createAdminClient();
  const { data: courses } = await admin.from("courses").select("id").like("id", "zz-test-%");
  for (const { id } of courses ?? []) {
    const { data: objs } = await admin.storage.from("source-files").list(`zz-test/${id}`);
    if (objs?.length) await admin.storage.from("source-files").remove(objs.map((o) => `zz-test/${id}/${o.name}`));
    await admin.from("courses").delete().eq("id", id).throwOnError();
    console.log("removed", id, "with", objs?.length ?? 0, "stored file(s)");
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

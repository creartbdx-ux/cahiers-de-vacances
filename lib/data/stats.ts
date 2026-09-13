import { createClient } from "@/lib/supabase/server"

type CountTable = "book_projects" | "games" | "templates" | "assets" | "universes" | "styles" | "palettes"

async function countRows(table: CountTable): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true })
  return count ?? 0
}

export async function getLibraryCounts() {
  const [books, games, templates, assets, universes, styles, palettes] = await Promise.all([
    countRows("book_projects"),
    countRows("games"),
    countRows("templates"),
    countRows("assets"),
    countRows("universes"),
    countRows("styles"),
    countRows("palettes"),
  ])

  return { books, games, templates, assets, universes, styles, palettes }
}

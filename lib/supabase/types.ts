/**
 * Hand-maintained types that mirror the SQL migrations in `scripts/`.
 * Keep this file in sync whenever a migration changes a table's columns.
 */

export type AssetType = "ICON" | "DECOR" | "HERO"
export type AssetStatus = "DRAFT" | "VALIDATED" | "REJECTED"
export type UserRole = "admin" | "customer"

export type Profile = {
  id: string
  role: UserRole
  created_at: string
  updated_at: string
}

export type Palette = {
  id: string
  name: string
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  active: boolean
  created_at: string
  updated_at: string
}

export type Style = {
  id: string
  name: string
  description: string | null
  typography_title: string | null
  typography_body: string | null
  decor_density: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Universe = {
  id: string
  name: string
  category: string | null
  /** Cadre éditorial pour la génération de contenu thématique. */
  editorial_description: string | null
  allowed_topics: string[]
  excluded_topics: string[]
  quiz_guidance: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Asset = {
  id: string
  name: string
  universe_id: string | null
  style_id: string | null
  asset_type: AssetType
  svg_storage_path: string
  recolorable: boolean
  color_slots: string[]
  priority: number
  status: AssetStatus
  active: boolean
  created_at: string
  updated_at: string
  validated_at: string | null
  validated_by: string | null
}

export type Game = {
  id: string
  name: string
  family: string
  personalization_type: string
  technical_engine: string | null
  min_difficulty: number
  max_difficulty: number
  max_per_book: number
  correction_required: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export type Template = {
  id: string
  name: string
  /**
   * Legacy single-game link, kept nullable for back-compat. Compatibility is
   * resolved via `technical_engine`, so a template can be shared by every game
   * that uses the same engine without duplication.
   */
  game_id: string | null
  /** Technical engine (algorithm) this template renders, e.g. "CROSSWORD". */
  technical_engine: string | null
  structure_key: string
  active: boolean
  created_at: string
  updated_at: string
}

export type BookProject = {
  id: string
  user_id: string | null
  recipient_first_name: string | null
  status: string
  style_id: string | null
  palette_id: string | null
  questionnaire_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BookPhoto = {
  id: string
  book_project_id: string
  storage_path: string
  caption: string | null
  anecdote: string | null
  use_authorized: boolean
  created_at: string
}

export type GeneratedPage = {
  id: string
  book_project_id: string
  page_number: number
  game_id: string | null
  template_id: string | null
  universe_id: string | null
  page_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

type TableConfig<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  // PostgREST's GenericTable contract requires a Relationships field. Without
  // it the schema fails to match GenericSchema and query results collapse to
  // `null`. We declare no foreign-table embeddings, hence the empty tuple.
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableConfig<Profile, Partial<Profile> & { id: string }, Partial<Profile>>
      palettes: TableConfig<Palette, Palette, Partial<Palette>>
      styles: TableConfig<Style, Style, Partial<Style>>
      universes: TableConfig<Universe, Universe, Partial<Universe>>
      assets: TableConfig<Asset, Asset, Partial<Asset>>
      games: TableConfig<Game, Game, Partial<Game>>
      templates: TableConfig<Template, Template, Partial<Template>>
      book_projects: TableConfig<BookProject, Partial<BookProject>, Partial<BookProject>>
      book_photos: TableConfig<BookPhoto, Partial<BookPhoto>, Partial<BookPhoto>>
      generated_pages: TableConfig<GeneratedPage, Partial<GeneratedPage>, Partial<GeneratedPage>>
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}

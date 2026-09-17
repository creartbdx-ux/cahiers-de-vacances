export * from "./types"
export * from "./audience"
export * from "./creator"
export * from "./audience-copy"
export * from "./journey"
export * from "./photos"
export {
  validateStep,
  validateQuestionnaireComplete,
  withDerivedAudienceFields,
  isCoreComplete,
} from "./validate"
export { buildBookProfile } from "./build-profile"
export { calculateProfileRichness } from "./richness"
export {
  computePersonalizationCapabilities,
  computeQuestionnaireCapabilities,
  buildPersonalizationTouches,
  normalizePersonalizationDepth,
  canSatisfyDataNeed,
  type PersonalizationCapabilities,
  type PersonalizationTouches,
  type PageDataNeed,
} from "./capabilities"
export {
  fixtureProfileLight,
  fixtureProfilePersonalized,
  fixtureProfileRich,
} from "./fixtures"

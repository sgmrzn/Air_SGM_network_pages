export const PUBLICATION_MAX_POSTS = 15;

export function publicationPostCount(value: number, mode: "new_network" | "expand") {
  const minimum = mode === "expand" ? 0 : 1;
  return Math.min(PUBLICATION_MAX_POSTS, Math.max(minimum, Number.isFinite(value) ? Math.round(value) : minimum));
}

type PublicationDraft = {
  planningMode: "new_network" | "expand";
  postCount: number;
  gridKm: number;
  radiusM: number;
  networkSizeMode: "required_network_size" | "budget_ceiling";
  useExclusionMasks: boolean;
  sourceContextRadiusKm: number;
  windSectorToleranceDeg: number;
};

// Older browser drafts may contain settings for which no published result exists.
export function normalizePublicationDraft<T extends PublicationDraft>(draft: T): T {
  return {
    ...draft,
    postCount: publicationPostCount(draft.postCount, draft.planningMode),
    gridKm: 1,
    radiusM: 2500,
    networkSizeMode: "required_network_size",
    useExclusionMasks: true,
    sourceContextRadiusKm: 25,
    windSectorToleranceDeg: 22.5,
  };
}

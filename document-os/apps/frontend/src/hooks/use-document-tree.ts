import type { DocumentDetail } from "@documentos/shared-types";
import { buildSectionTree, flattenTree } from "@documentos/utils";
import { useMemo } from "react";

/** Derives the section tree + flattened view from a DocumentDetail. */
export function useDocumentTree(document: DocumentDetail | undefined) {
  const tree = useMemo(() => buildSectionTree(document?.sections ?? []), [document?.sections]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  return { tree, flat };
}

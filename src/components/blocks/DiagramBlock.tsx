/* eslint-disable @next/next/no-img-element -- data-URI SVGs; next/image adds nothing here */
import type { BlockOf } from "@/lib/course/schema";
import { svgDataUri, themedSvg } from "@/lib/widget/runtime";

/**
 * A Claude-drawn SVG, shown as an <img> so nothing inside it can run. Its colours are CSS
 * variables, so we bake a dark and a light copy and show the one matching the theme.
 */
export function DiagramBlock({ block }: { block: BlockOf<"diagram"> }) {
  return (
    <figure className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
      <img src={svgDataUri(themedSvg(block.svg, "dark"))} alt={block.alt} className="mx-auto block w-full max-w-[680px] light:hidden" />
      <img src={svgDataUri(themedSvg(block.svg, "light"))} alt={block.alt} className="mx-auto hidden w-full max-w-[680px] light:block" />
      {block.caption && <figcaption className="mt-3 text-center text-sm text-muted">{block.caption}</figcaption>}
    </figure>
  );
}

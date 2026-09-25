/** Slow-drifting blurred colour blobs behind everything. Motion stops under reduced-motion (see globals.css). */
export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob blob-teal" />
      <div className="blob blob-violet" />
      <div className="blob blob-peach" />
    </div>
  );
}

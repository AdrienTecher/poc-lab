// Painter order for a diorama that contains one DOM actor it cannot re-order.
//
// Nuage is a positioned element sitting between two SVG layers, not a node
// inside them, so anything nearer the camera than he is has to be drawn in the
// layer in front of him and anything further away in the layer behind. Depth in
// a 2:1 dimetric projection is just gx + gy, so each piece declares how to read
// its own, and this decides where it lives.
//
// It was hand-written for exactly one piece before this: the cabbage, moved by
// four call sites, with a comment warning that a fourth actor would break it
// silently. Adding a piece is now `add(node, () => depth)` and nothing else.

export const depthLayers = (back, front) => {
  const pieces = [];
  let signature = "";

  /** Register a piece. `depthOf` is read on every sort, so a piece that moves —
   *  aboard a boat, up a hill — reports where it is now. */
  const add = (node, depthOf, id = String(pieces.length)) => {
    pieces.push({ node, depthOf, id });
    return node;
  };

  /** Re-file every piece around the actor. Cheap to call each frame: it only
   *  touches the DOM when the order actually changed. */
  const sort = (actorDepth) => {
    const ranked = pieces
      .map((p) => ({ ...p, depth: p.depthOf(), behind: p.depthOf() < actorDepth }))
      .sort((a, b) => a.depth - b.depth);
    const next = ranked.map((p) => `${p.id}${p.behind ? "<" : ">"}`).join(",");
    if (next === signature) return;
    signature = next;
    // appendChild moves the node, and moving the focused node blurs it — so a
    // player tabbed onto the wolf does not lose him when the boat drifts past
    const focused = document.activeElement;
    for (const p of ranked) (p.behind ? back : front).appendChild(p.node);
    if (focused && focused !== document.activeElement && focused.isConnected) focused.focus?.();
  };

  const reset = () => { signature = ""; };

  return { add, sort, reset };
};

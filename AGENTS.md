# Leaflet Lite design guidance

## Working rules

- Do not write tests, run tests, compile, or otherwise attempt to build the project. Tests will become worthwhile after the structure and API have stabilized.
- Do not inspect Git history.
- Make focused changes that preserve the architectural goals below. Do not retain Leaflet APIs or abstractions merely for compatibility.

## Purpose and priorities

Leaflet Lite is a heavily rewritten fork of LeafletJS intended to improve:

1. Code clarity.
2. Modularity and tree-shaking.
3. Runtime performance, including both memory use and computation.
4. A small, comprehensible API suited to modern applications.

Assume consumers use a modern bundler such as Rollup, Rolldown, esbuild, or Vite. Optional capabilities should therefore be independently importable and side-effect-free rather than permanently attached to central classes.

The library is a foundation for interactive graphical map experiences, not a complete application UI toolkit. Its primary use case is real-world geographic maps, but simple two-dimensional coordinate systems remain valuable for image maps, game worlds, diagrams, and similar applications. Preserve that capability unless doing so substantially complicates the core abstractions.

## API design

### Prefer one canonical representation

Leaflet accepted coordinates as arrays, plain objects, or class instances and repeatedly normalized them. It also exposed many aliases for equivalent operations. That convenience came at a substantial cost in code size, readability, type clarity, and runtime work.

Leaflet Lite should instead:

- Prefer one representation for each concept.
- Avoid conservative normalization throughout internal code.
- Avoid aliases that perform the same operation.
- Make invalid combinations difficult through clear names and types rather than accepting many ambiguous input shapes.
- Eventually use `(x, y)` ordering consistently, including `(longitude, latitude)` for geographic coordinates, matching GeoJSON rather than Leaflet's `(latitude, longitude)` convention.

Do not introduce convenience overloads without weighing their permanent complexity against their actual value.

### Keep optional functionality tree-shakable

Functionality that is not fundamental to every map should normally be a standalone exported function or a separate module, not a method added to `Map`. Adding optional helpers to `Map` forces them into the central class and makes them harder for bundlers to omit.

Prefer:

```ts
import {someOptionalHelper} from 'leaflet-lite/...';
```

Over:

```ts
map.someOptionalHelper();
```

Standalone helpers should avoid importing or initializing unrelated map machinery.

## Terminology and core abstractions

Leaflet used “layer” for almost every graphical object. Leaflet Lite uses a narrower distinction:

- A **layer** fills or conceptually spans the map viewport, such as a `TileLayer` or `CanvasRenderer`.
- An **element** is an individual object positioned within a layer, such as `Node` or `Area`.

`Node` and `Area` are the primary abstractions for positioning arbitrary DOM elements in map coordinates:

- `Node` anchors an element at a point.
- `Area` positions and sizes an element over bounds.

They should not care whether the DOM element is an image, video, custom component, or another element type.

Image and video overlays should share positioning machinery rather than duplicate it according to media type.

## Application UI and map controls

Map controls do not belong in the core library.

Most consuming applications already have a component framework or design system with its own:

- Buttons and icons.
- Menus, popovers, and drawers.
- Focus and keyboard behavior.
- Accessibility conventions.
- Responsive layout.
- Animation and interaction state.
- Internationalization.

A CSS-customizable built-in control is not sufficiently adaptable when a design system requires different DOM structure or JavaScript behavior. Zoom buttons, layer selectors, scale displays, geolocation buttons, attribution displays, and similar controls generally make only simple calls into the map API and should be implemented by the consuming application.

Consequently:

- Do not maintain a `Control` base class in the core.
- Do not add permanent control-container or four-corner DOM scaffolding to every map.
- Do not prescribe control markup or CSS.
- Ensure the public map state and operations are sufficient for application UI to call without private fields.
- Put useful UI recipes in examples or documentation instead of the runtime library.

This differs intentionally from upstream Leaflet, which aims to be a complete drop-in map widget.

### Scale displays

Users may be unfamiliar with projections, coordinate systems, and the relationship between screen pixels and map distance. Scale-bar guidance is therefore valuable, but its UI does not belong in the core.

Provide at least a documented standalone example showing how to:

1. Choose two container points separated by a desired pixel width.
2. Convert them to map coordinates.
3. Ask the active coordinate system for their distance.
4. Select a visually pleasant rounded distance.
5. Convert that rounded distance back into a rendered line width.
6. Format units in application UI.

If scale calculation is exposed as library functionality, it must be a standalone, side-effect-free helper rather than a `Map` method. Keep the calculation neutral about presentation and units. Earth CRSs may return meters, while simple Cartesian CRSs may return game units, image units, or other arbitrary units. Metric/imperial formatting, labels, locale, and DOM rendering belong to the application.

The “nice scale” rounding policy is small enough to remain example code unless repeated use demonstrates that a shared helper meaningfully reduces complexity.

### Attribution

Attribution requirements should be explained prominently in documentation and examples, but attribution collection and presentation do not belong in the runtime library.

Do not add an attribution aggregator merely to concatenate provider strings. Real applications may need to account for:

- Data already aggregated from several upstream providers.
- Provider-specific legal wording.
- Internationalized provider names and surrounding text.
- Conditional or product-specific attribution.
- Application-specific layout and linking requirements.

The consuming application is responsible for knowing its data sources and presenting legally required attribution.

## DOM architecture

Keep the map DOM as flat and simple as practical. Every persistent DOM node must justify itself through a distinct responsibility such as clipping, shared transforms, stacking, rendering, or lifecycle grouping.

### Map container

A map instance has one application-provided container element. The container should:

- Establish the viewport dimensions.
- Use `overflow: hidden` as the principal clipping boundary.
- Be observed with `ResizeObserver` so coordinate state and renderers update when its size changes.
- Avoid unrelated permanent children such as built-in control corners.

Intermediate map nodes should normally leave overflow visible. Clipping at multiple nested levels complicates transforms and can hide children whose containing block intentionally has little or no layout size.

### Moving map content

It is useful to have one shared map-content root beneath the outer container. Panning should translate that root so all geographic content moves together:

- Tile layers.
- Vector renderers.
- Nodes and areas.
- Popups or application elements that deliberately participate in map coordinates.

Do not reposition every child on every pointer-move frame when one ancestor transform can move the retained scene. Rebase/reset very large accumulated translations when necessary to avoid browser transform precision limits.

Application UI should normally be outside this moving map-content root so it remains stationary.

Avoid recreating Leaflet's large fixed pane hierarchy unless distinct stacking or transform behavior requires it. Prefer DOM order, explicit layer containers, and the smallest number of stacking contexts that satisfy the rendering model.

### Tile-layer hierarchy

A retained DOM tile renderer may use a hierarchy conceptually like:

```text
map container                 clipping viewport
└── moving map-content root   shared pan translation
    └── tile-layer container  per-layer opacity/order/lifecycle
        └── zoom-level group  shared zoom translation and scale
            └── image tiles   static positions within the tile grid
```

A grouping element is not necessarily a geometric bounding box. Tile-layer and zoom-level containers may have little or no meaningful layout size. Absolutely positioned tile images may paint outside them because intermediate overflow remains visible; the outer map container performs the actual clipping.

Each grouping node should have a clear purpose:

- The map-content root moves all geographic content during a pan.
- The tile-layer container groups one source and can own opacity, ordering, and disposal.
- A zoom-level group provides a common coordinate origin and lets all tiles at one integer zoom be translated/scaled together.
- Individual images receive a position when inserted and normally keep that position while their ancestors move.

During a zoom transition, old and new zoom-level groups may coexist temporarily. Transform the group rather than individually rescaling every image. Remove obsolete groups when replacement content is ready.

Do not dump tiles from unrelated tile layers directly into one shared pane. Per-layer grouping keeps lifecycle, opacity, ordering, and source state independent.

## Tile-grid abstraction

Separate tile-grid scheduling from image URL production when the boundary remains clear:

- Grid scheduling decides which tile coordinates are needed, retained, or removed and where their elements belong.
- A raster tile source turns a tile coordinate into an image request and handles image-specific loading behavior.

This distinction can support URL-backed images, generated canvas tiles, vector tiles, or other tiled elements. It also makes the image-specific implementation easier to reason about. Do not merge the concepts merely to remove one prototype layer; the runtime cost of that abstraction is negligible compared with network, decoding, DOM, and rendering work.

If arbitrary tiled renderers are not part of the supported public API, the scheduler may be an internal abstraction rather than a public class. Preserve the separation of responsibilities either way.

## Rendering and performance strategy

### Raster tiles

The default raster-tile strategy should favor retained image elements and compositor transforms:

- Traditional map tiles are normally 256 × 256 CSS pixels.
- Position a tile when it enters the grid.
- Pan by transforming a shared ancestor.
- Zoom by translating/scaling a zoom-level group.
- Add and remove tiles only as the required grid changes.
- Let the browser own image fetching, decoding, and retained compositing.

Do not replace this with a Canvas 2D implementation that clears and redraws dozens of images on every animation frame merely to reduce DOM-node count. Typical maps have only tens of visible tiles, and simple absolutely positioned images are a favorable DOM workload.

A tile buffer should primarily avoid churn and preserve recently visible content during small pans, reversals, and inertia. Be explicit about whether a buffer retains old tiles or proactively prefetches new ones; these are different policies. Upstream Leaflet's `keepBuffer` is chiefly retention, not directional prefetching.

### Canvas renderers

Canvas is appropriate for vector paths and procedurally generated content, but independent content with different invalidation patterns should normally use independent rendering surfaces.

Do not combine raster tiles and frequently changing vectors into one Canvas 2D surface by default. Immediate-mode canvas rendering would force small vector changes to redraw the raster background, and tile loads could force unrelated vectors to redraw. A separate raster surface and vector surface cost very little in DOM while preserving independent invalidation.

If a canvas-backed tile renderer is added, it should retain its rendered surface, move it with a transform during interaction, and redraw only when tile-grid changes require it. It should not repaint the full raster scene at 60 frames per second.

If the product eventually requires one unified high-performance raster/vector scene, WebGL or WebGPU is a more appropriate architecture than repeatedly flattening everything through Canvas 2D.

### Optimize the dominant work

Do not remove clean abstractions based on assumed micro-costs. Prototype lookup and one polymorphic tile-creation call are negligible compared with:

- Network latency.
- Image decoding.
- Pixel memory.
- DOM insertion/removal.
- Canvas rasterization.
- GPU upload and compositing.

Prefer architectural changes that reduce repeated work, allocations, invalidation, or retained memory in measured hot paths.

## Event boundaries and application overlays

Prefer attaching map interaction listeners to a dedicated map interaction/content surface rather than indiscriminately treating every event bubbling through the outer application container as a map gesture. Application UI placed as a sibling of that surface should naturally fall outside the map's event path.

Simply checking whether an event originated somewhere under the outer map container is insufficient when application controls are also overlaid inside that container. The meaningful boundary is the map-owned interaction subtree, not the outer element alone.

Where consuming UI must overlap or live inside the listened subtree, a small event-suppression helper may be useful. If provided, it must be:

- A standalone, tree-shakable DOM utility.
- Uncoupled from `Map` and other map machinery.
- Explicit about which pointer, click, context-menu, wheel, and keyboard events it suppresses.
- Disposable so listeners can be removed cleanly.

Do not reintroduce a control framework solely to solve event propagation. Prefer a clear interaction boundary first and a generic standalone helper for exceptional layouts.

## Documentation responsibilities

Because consumers may be comfortable with application development but unfamiliar with mapping concepts, documentation and examples must explain the non-obvious parts of the model, including:

- Geographic versus simple Cartesian coordinate systems.
- Projection and screen/container coordinate conversions.
- Longitude/latitude ordering.
- How to calculate and render a scale indicator.
- Common map-data attribution obligations.
- The retained tile DOM and transform hierarchy.
- How application UI should call map APIs and avoid becoming part of map gestures.

Examples should teach composition with ordinary application UI rather than imply that the library owns the application's visual language.

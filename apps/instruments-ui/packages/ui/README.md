# Instruments UI

## Usage

Import the shared theme once at the application entry point. Each component
imports its own compiled CSS automatically.

```tsx
import "@instruments/ui/theme.css";
import { Button } from "@instruments/ui/button";

<Button variant="secondary">Continue</Button>;
```

`styles.css` remains a compatibility alias for the shared theme only. It no
longer collects component styles. Consumers need a bundler that handles CSS
imports, such as Vite; direct Node execution of the component bundles does not
load CSS.

## Structure

- `src/theme.css`: Tailwind reset, font faces, and shared tokens only.
- `src/tokens/`: primitive colors, semantic aliases, theme values and type tokens.
- `src/components/<name>/`: component TSX and focused CSS.
- `src/artwork/<name>/`: decorative brand artwork TSX and CSS.
- Public `src/*.tsx` entry points keep package imports stable.

Use stable class names in TSX. Write Tailwind utilities with `@apply` in each
component stylesheet, under `@layer components`. Start each stylesheet with
`@reference "../../theme.css"` to access tokens without emitting another reset
or font definitions. Keep exact artwork geometry in plain CSS where necessary.

## Adding a component

1. Add its TSX and CSS together in `src/components/<name>/` or `src/artwork/<name>/`.
2. Import `./<name>.css` from the implementation. No shared CSS import list needs
   updating: the CSS build discovers component and artwork styles recursively.
3. Add a public re-export, tsdown entry and package export following `./button`.
4. Add a Storybook story. Its theme comes from the shared toolbar; story-only
   layout styles belong beside the story in the docs app.
5. Run the package build, typecheck and lint, then build Storybook.

The CSS build preserves source-relative paths under `dist`. The tsdown plugin
preserves matching CSS imports in ESM and CJS bundles, including shared chunks.
The package marks CSS as side-effectful so consumer bundlers retain it.

Run the UI package's `dev` script alongside Storybook. JavaScript and CSS watch
processes update `dist`. The CSS watcher rebuilds on CSS/TS/TSX changes, including
new component styles and shared token edits. Restart the build after adding or
replacing font assets.

## Themes

Dark is the default. Set `data-theme="light"` or `data-theme="dark"` on a container;
`.light` and `.dark` also work. Nested containers can select their own theme.
Semantic aliases use `@theme inline` to resolve colors on the styled element.
Apply the theme to portal containers too when they render outside that tree.

## Assets

Rodin and NewRodin fonts are bundled locally in six weights each. The CSS build copies them to `dist/fonts` and uses `font-display: swap`.
The button signal still references the temporary Figma export documented in its
CSS. It needs a permanent asset before publishing.

## Provider sign-in buttons

`ProviderButton` is independent of the standard action button. It uses fixed
provider brand colors, a 54px height, rounded corners, and full container width.
The application owns authentication; pass a click handler for each provider.

```tsx
import { ProviderButton } from "@instruments/ui/provider-button";

<ProviderButton provider="google" onClick={signInWithGoogle} />;
<ProviderButton provider="apple" onClick={signInWithApple} />;
```

Use `disabled` to block interaction and `label` for localized text. Supply
`iconSrc` with a permanent provider logo before publishing: the Google fallback
is a temporary Figma URL, and the Apple fallback uses Figma's SF Pro private-use
glyph, which requires an Apple-compatible font. Icons are decorative; the label
provides the button's accessible name.


## Typography

Import `Typography` from `@instruments/ui/typography`. Each variant matches a
Figma text style, including font family, weight, size, line height and tracking.
`typographyTags` exports the default semantic mapping. Use `as` to match the
heading hierarchy or context without changing appearance.

```tsx
<Typography variant="display">Beats</Typography>
<Typography as="h2" variant="title">Your library</Typography>
<Typography variant="body">Find your rhythm.</Typography>
<Typography as="label" htmlFor="email" variant="label">Email</Typography>
```

| Style | Default tag |
| --- | --- |
| Display, Title | h1 |
| Subtitle, Sign in | h2 |
| Heading | h3 |
| Body, Body Large, Body Small, Eyebrow | p |
| Label | label |
| Caption, Caption Tracked, Micro, Micro Tracked | small |
| Controls and Artwork styles | span |

The equivalent CSS classes are `beats-type-<variant>`, for example
`beats-type-body-large`. Default tag mappings apply through `Typography`; native
HTML elements are not globally restyled. Use `as="figcaption"` for figure
captions, and associate form labels with inputs via `htmlFor`.

Tailwind family utilities are `font-rodin`, `font-newrodin`, and `font-sans`
(Rodin). The original OpenType files are preserved without subsetting; browsers
load only the faces used on a page. Figma AUTO line heights use `normal`.

## Brand artwork

Decorative compositions and brand marks live in `src/artwork/` and are exported
under `@instruments/ui/artwork/*`. They are distinct from interactive controls in
`src/components/`. Storybook groups these as **Brand / Artwork**, **Controls**,
and **Foundations**.

```tsx
import { RecordSignalLabel } from "@instruments/ui/artwork/record-signal-label";

<RecordSignalLabel /> // 172px, decorative by default
<RecordSignalLabel size={48} />
```

The record signal label is a scalable CSS ellipse using the accent color. It
has no button behavior, focus target, or recording state. Supply `label` only
when it conveys meaning; then it exposes an accessible image role.

The complete vinyl composition is `RecordArtwork`, under **Brand / Artwork /
Record** in Storybook. It includes the disc, seven grooves, signal label,
spindle, keyline, and NewRodin lettering from Figma 136:17.

```tsx
import { RecordArtwork } from "@instruments/ui/artwork/record";

<RecordArtwork /> // 540px, scales down to its container
<RecordArtwork size={270} />
```

The host layout controls any overlap or clipping behind a split panel. The
artwork itself remains square and inherits the surrounding Beats theme.

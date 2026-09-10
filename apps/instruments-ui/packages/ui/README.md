# Instruments UI

## Usage

Import the compiled stylesheet once in your application entry point. JavaScript
entry points do not import CSS, so consumers control when global styles load.

```tsx
import "@instruments/ui/styles.css";
import { Button, type ButtonVariant } from "@instruments/ui/button";

<Button variant="secondary">Continue</Button>;
```

The stylesheet includes Tailwind's reset and package utilities. Avoid importing it
multiple times or processing the package's component CSS independently.

## Structure

- `src/button.tsx`: public entry point; keeps `@instruments/ui/button` stable.
- `src/components/button/`: implementation and colocated component styles.
- `src/tokens/primitives.css`: Figma palette values.
- `src/tokens/semantic.css`: semantic Tailwind color aliases.
- `src/tokens/themes.css`: light/dark values for those aliases.
- `src/tokens/typography.css`: shared font configuration.
- `src/styles.css`: CSS entry point and explicit import order.

Component rules belong in `@layer components`, use the `beats-` class prefix, and
consume semantic colors. Tailwind utilities passed through `className` can then
override component defaults. Use native interaction selectors for hover, active,
focus-visible, and disabled states. Keep story layout rules in the docs app.

## Themes

Dark is the default. Set `data-theme="light"` or `data-theme="dark"` on a container;
`.light` and `.dark` also work. Nested containers can select their own theme.
Semantic Tailwind aliases use `@theme inline` so utilities resolve colors on the
styled element rather than capturing the root theme.

```tsx
<div data-theme="light">
  <Button>Continue</Button>
</div>
```

Storybook's Theme toolbar applies the same container contract. A host application
should apply its theme to portal containers too when rendering outside that tree.

## Adding a component

1. Add `src/components/<name>/<name>.tsx` and `<name>.css`.
2. Import the CSS from `src/styles.css` after the token imports.
3. Add a public `src/<name>.tsx` re-export, a tsdown entry, and a matching package
   export following `./button`.
4. Add a story in `apps/docs/stories`; use the shared preview for theme and layout.
5. Run the UI package's `build`, `typecheck`, and `lint` scripts, and build the
   docs app to verify consumption through the public package exports.

Run the UI package's `dev` script alongside Storybook when editing components.
It watches the JavaScript entries and CSS imports and updates `dist`, which is
what Storybook and other consumers import. No additional CSS loader is required.

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

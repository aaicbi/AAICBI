# Light mode design

- **Page**: a light neutral gray (`brand-sand` 240 240 238), with the doodle wallpaper at 30% strength (`public/wallpaper-pattern.svg`).
- **Cards**: a flat warm off-white (`card-gradient-from` and `-to`, both 250 249 246) with a thin soft border (`brand-gray` 226 224 218). Very little contrast against the page. Dark mode is unchanged.
- **Filled buttons and chips** (`bg-brand-action`, hover `bg-brand-actionHover`): a greenish black (11 43 38) with white text. In dark mode the same token is the bright teal it always was.
- **Secondary buttons**: white with a greenish-black outline and text (`Button` variant `secondary`, and the hand-written outline pills).
- **Links and accents** (`text-brand-teal`, rings, outlines) keep the mid green, so a link still looks different from body text.
- The logo keeps its own green.
- The colour values live in `src/app/globals.css` and are mirrored in `src/lib/designTokens.ts`, where `tests/designTokens.test.ts` checks that they match and that every text and background pair meets WCAG AA (4.5 to 1).

## Wallpaper strength
The doodle wallpaper is set to 30% (the `opacity` on the first line of `public/wallpaper-pattern.svg`; the dark-mode copy is unchanged). 19% and 42% were compared on the live preview and 30% was chosen: clearly visible on the gray page without competing with the content.

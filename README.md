# the-vps-app

Web app of the-vps for all roles (student, teacher, parent, admin). React,
Vite, TypeScript and Mantine. The build is static files, served by nginx.

## Work on it

    npm ci
    npm run dev       # http://localhost:5173
    npm run build     # type check, then dist/

## Release

A merge to `main` builds the image and releases it to dev
(https://dev.app.vision.ac.pk). The footer of the menu shows the release
(the commit). A merge commit of `main` into `production` releases the same
image to prod. Each pull request builds the image once as a check.

## Design

- Material 3 Expressive, on top of Mantine, used with restraint. There is no
  official React library for it, so the tokens are in `src/theme.ts` and at the
  top of `src/app.css` (`--md-*`, the M3 color roles, from the Fidelity scheme
  of `@material/material-color-utilities` with the seed `#2b4c9b`).
- Shape: 8, 12, 16, 28 and 48 px, and pills for buttons, menu items and the
  search. A button morphs to a smaller radius when pressed (`--md-spring`).
  Cards are tonal, with no border. No surface is pure white or a bright tint:
  use the `--md-surface-*` and `--md-*-container` tokens, which have low chroma.
- One typeface: Google Sans Flex, self-hosted, medium weight for figures and
  titles, with tabular figures for numbers and dates.
- The one strong element is the search ("Search or go to", like GitLab). Press
  `/` or Ctrl+K on any page. It finds pages, and students by name, father
  name, guardian, admission number or phone (`0300...` and `+92300...` both
  match). A student result opens the Students page with that row marked.
  Keep the rest quiet: white panels on a tinted page.
- The search sits in a sticky top bar above the page, centered, as in GitLab.
  The page is centered in the space next to the menu.
- The menu holds the school name (a link to the Dashboard), the pages, the
  signed-in user, sign-out and the release. On a phone it opens from the top
  bar, which also has a search button.
- Every state names the next step: an empty list offers "Register student", a
  failed list offers "Reload page".
- The Dashboard is a bento grid of tonal cards. Its one strong element is the
  fees hero with the wavy progress ring. Connected button groups change the
  charts, and the stat icons sit in a cookie shape that morphs on hover. The
  charts are plain HTML, CSS and SVG, with no chart library. The chart colors
  in `--chart-*` passed the color-blind check. The API has no history, so the
  page shows no change from last week.
- `src/app.css` is one global file. Before you add a class, search the file
  for the name: a name that is already in use (for example `.entry` of the
  form fieldsets) also gives its padding and grid to the new element.
- Print from a Mantine `Modal` cuts off the content. The receipt is a portal
  copy in `document.body` (`.print-receipt`, see `StudentFees.tsx`), and
  `@media print` hides every other child of `body`.

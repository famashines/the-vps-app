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

- Paper `#fcfdff` (page), sheet `#ffffff` (panels), wash `#f3f6fb` (menu,
  table head, form footer), ink `#1c2541`, royal ink `#2b4c9b` (actions, the
  active menu item, admission numbers), ruling `#d5e0f2` (lines and panel
  borders), danger `#b42318` (errors only), slate `#5d6784` (second-level
  text). Amber `#fdf3e3` marks work to do, for example a student with no class.
- One typeface: Atkinson Hyperlegible Next, self-hosted, with tabular figures
  for numbers and dates.
- The one strong element is the search ("Search or go to", like GitLab). Press
  `/` or Ctrl+K on any page. It finds pages, and students by name, father
  name, guardian, admission number or phone (`0300...` and `+92300...` both
  match). A student result opens the Students page with that row marked.
  Keep the rest quiet: white panels with one thin border.
- The search sits in a sticky top bar above the page, centered, as in GitLab.
  The page is centered in the space next to the menu.
- The menu holds the school name (a link to the Dashboard), the pages, the
  signed-in user, sign-out and the release. On a phone it opens from the top
  bar, which also has a search button.
- Every state names the next step: an empty list offers "Register student", a
  failed list offers "Reload page".
- The Dashboard shows the current school year: how many students are in a
  class, and how many still need one, with a link to enroll them. Then the
  five most recent registrations. Parts that are not built yet are listed
  under "Coming next", with no numbers.
- `src/app.css` is one global file. Before you add a class, search the file
  for the name: a name that is already in use (for example `.entry` of the
  form fieldsets) also gives its padding and grid to the new element.
- Print from a Mantine `Modal` cuts off the content. The receipt is a portal
  copy in `document.body` (`.print-receipt`, see `StudentFees.tsx`), and
  `@media print` hides every other child of `body`.

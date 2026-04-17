# UX Review Method

This repo should not rely on "page loaded and nothing exploded" as a UX pass.

Use this flow whenever reviewing a page with heavy customization, floating menus, drag behavior, or mobile overlays.

## Required review states

For each major page (`client-details`, `calendar`, `branding`, `form-creator`, `send reminder`), review:

1. Default state
2. One state with a menu, popover, modal, or editor open
3. One scrolled state after the user has moved around inside that page
4. One "keep using it after opening something" state

## Required mobile checks

For mobile, do not stop at the first screenshot. Always check:

1. Tap a real editable area, not just the page background
2. Open the matching editor/popover/modal
3. Verify the open editor is readable without microscopic controls
4. Verify important fields deeper in the editor are still visible or quickly reachable
5. Scroll inside the active surface the user would naturally scroll
6. Keep interacting after the scroll to confirm the page still feels usable
7. Confirm no floating panel blocks the main content too aggressively

## What counts as a failed UX state

Treat any of these as a test failure, even if the page is technically functional:

1. The editor is visible but too small to comfortably read
2. A tiny inner scroll area appears inside another scroll area
3. The user must guess that a panel is scrollable
4. The page only works if zoom changes
5. The primary content is pushed too far down by floating chrome
6. A tap opens controls, but the controls are clipped or mostly off-screen
7. Important actions become hidden after a modal/editor opens

## Current tooling expectation

The headed visual walkthrough should capture at least:

1. `start`
2. `editor` or `menu-open`
3. `scrolled` or `interacted`

For pages with mobile editors, add a targeted Playwright assertion that checks the editor is not just present, but large enough and readable enough to use.

## Mindset

Review the page like an impatient real user:

1. Tap the obvious thing
2. Try to edit immediately
3. Scroll without precision
4. Keep going after the first overlay opens
5. Notice what feels cramped, hidden, or annoying

If the flow would frustrate a real user in under 10 seconds, it needs another pass.

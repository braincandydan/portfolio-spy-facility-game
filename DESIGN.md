---
name: Field Operative Portfolio
description: A résumé you play as a late-90s console spy mission, with a plain declassified printout beside it.
colors:
  signal-amber: "#ffb000"
  phosphor-teal: "#2fd4c6"
  alarm-red: "#ff5a52"
  warning-orange: "#ff8f52"
  void-black: "#0a0b0d"
  boot-black: "#07080a"
  console-panel: "#111418"
  console-panel-deep: "#0d0f12"
  scene-slate: "#1a1d22"
  readout-white: "#e8ebf0"
  console-text: "#c9cdd4"
  dim-label: "#6b7079"
  dim-label-light: "#8a8f97"
  hairline: "#2b2e34"
  hairline-soft: "#24272d"
  hairline-deep: "#16191d"
  paper-white: "#ffffff"
  ink: "#1d2024"
  ink-muted: "#5b616b"
  paper-rule: "#d9dde2"
  print-teal: "#0d7f76"
typography:
  display:
    fontFamily: "Oswald, sans-serif"
    fontSize: "clamp(40px, 7vw, 86px)"
    fontWeight: 700
    lineHeight: 0.95
  headline:
    fontFamily: "Oswald, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.03em"
  title:
    fontFamily: "Oswald, sans-serif"
    fontSize: "18px"
    fontWeight: 400
  body:
    fontFamily: "Share Tech Mono, monospace"
    fontSize: "13px"
    lineHeight: 1.7
  label:
    fontFamily: "Share Tech Mono, monospace"
    fontSize: "11px"
    letterSpacing: "0.12em"
  resume-heading:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.1
  resume-body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  resume-section-label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    letterSpacing: "0.12em"
rounded:
  none: "0px"
  focus: "2px"
  stick: "8px"
  watch-screen: "16px"
  watch-bezel: "26px"
  round: "50%"
spacing:
  hud-inset: "26px"
  hud-inset-phone: "14px"
  panel-pad: "26px"
  gap: "14px"
  row: "9px"
  resume-gutter: "16px"
components:
  button-solid:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.void-black}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-teal}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  panel:
    backgroundColor: "{colors.console-panel-deep}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.none}"
    width: "min(880px, 94vw)"
  card-crate:
    backgroundColor: "{colors.console-panel}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.none}"
    padding: "16px"
  card-dossier:
    backgroundColor: "{colors.console-panel}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
  hud-prompt:
    backgroundColor: "rgba(10,11,13,.78)"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.none}"
    padding: "10px 18px"
  chip-skill:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-teal}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  watch-tab:
    backgroundColor: "transparent"
    textColor: "{colors.dim-label}"
    padding: "9px 18px"
  watch-tab-active:
    backgroundColor: "rgba(47,212,198,.1)"
    textColor: "{colors.readout-white}"
    padding: "9px 18px"
---

# Design System: Field Operative Portfolio

## Overview

**Creative North Star: "The N64 Cartridge"**

The portfolio is a late-90s console game first. It boots like a cartridge ("click to insert cartridge"), renders a chunky, pixelated 3D facility through a CRT (scanlines, vignette, a slow phosphor sweep), and talks to the player through a GoldenEye-style HUD: a bottom-centre analog stick, round face buttons, corner readouts, a crosshair and a scrolling ticker. The nostalgia is the point. Every interface element should feel like it shipped on that cartridge: square, tracked, monospaced, lit from within, sitting over a dark scene.

Density is low and deliberate. The 3D scene owns the screen; interface sits at the edges (corner readouts, ticker, controller) or in modal overlays (the wristwatch, content panels, dialogue). Overlays dim the scene rather than replacing it, so the player never forgets they are inside the facility.

The plain résumé (`resume.html` and `public/resume.pdf`) is the one deliberate exception: the declassified printout from the mission. It is quiet, paper-like and system-fonted, borrowing only a teal accent rule from the game. It must never adopt the CRT, glow or mono styling, because its readers are recruiters, applicant-tracking systems and printers.

**Key Characteristics:**
- Near-black console surfaces under a pixelated 3D scene, with CRT scanlines and vignette on top.
- Two signal colours, amber and teal, glowing against near-black; red and orange only for alarms and destructive actions.
- Oswald for big readouts and headings; Share Tech Mono for everything the console "prints".
- Square corners and 1px hairlines everywhere; roundness only on physical hardware (the watch, the controller).
- Glow means "live": prompts, active controls and focus get a soft coloured halo; static content does not.

## Colors

A two-signal phosphor palette (amber and teal) on a ladder of near-blacks, plus a separate paper palette for the printout.

### Primary
- **Signal Amber** (`signal-amber`): the brightest voice on screen. Today it marks the solid primary button, the intel count, the objective-guide arrow, toasts, section titles inside the watch, the fire button and the "Recruiter? Skip the mission" link.
- **Phosphor Teal** (`phosphor-teal`): the console's working colour. Today it carries links, panel titles, the crosshair, outline buttons, the analog stick, skill chips, tech-stack lines and the keyboard focus ring.

### Secondary
- **Alarm Red** (`alarm-red`): locked doors and lock banners only.
- **Warning Orange** (`warning-orange`): destructive actions only (the reset button in settings).

### Neutral
- **Void Black** (`void-black`): page background behind everything.
- **Boot Black** (`boot-black`): the title screen and the base of overlay scrims (used at 72–82% opacity over the scene).
- **Console Panel** (`console-panel`) and **Console Panel Deep** (`console-panel-deep`): panel headers, cards and panel bodies.
- **Scene Slate** (`scene-slate`): the 3D canvas background before the scene paints.
- **Readout White** (`readout-white`): headings, names and primary values.
- **Console Text** (`console-text`): default body text.
- **Dim Label** (`dim-label`) and **Dim Label Light** (`dim-label-light`): labels, hints, secondary metadata.
- **Hairline**, **Hairline Soft**, **Hairline Deep** (`hairline`, `hairline-soft`, `hairline-deep`): the three border strengths, from card outlines down to row dividers inside the watch.

### Printout (résumé page and PDF)
- **Paper White** (`paper-white`), **Ink** (`ink`), **Ink Muted** (`ink-muted`), **Paper Rule** (`paper-rule`): the light, print-first page.
- **Print Teal** (`print-teal`): the only accent on paper: the job title, links and the case-study rules. On screen in dark mode the page swaps to the console near-blacks with phosphor teal.

### Named Rules
**The Glow-Means-Live Rule.** A coloured `box-shadow` or `text-shadow` halo appears only on things that are interactive, active or alerting right now: the interaction prompt, a pressed stick, the focus ring, toasts. Static text and cards never glow.

**The Paper-Stays-Paper Rule.** Nothing from the console palette except one teal accent reaches the printout. No near-black backgrounds, glows or amber on `resume.html` in light mode or in the PDF.

**Open decision: amber vs teal roles.** The current split above is observed, not yet a rule. Until it is decided, keep each existing element's colour, and don't introduce new meanings for either.

## Typography

**Display Font:** Oswald (with sans-serif)
**Body and Label Font:** Share Tech Mono (with monospace)
**Printout Font:** the system UI stack (system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif)

**Character:** Oswald is the stencilled crate lettering and the big HUD numerals; Share Tech Mono is the terminal printing everything else. Together they read as a 90s game's front end. The printout uses system fonts on purpose: fast, neutral and safe for applicant-tracking systems.

### Hierarchy
- **Display** (700, `clamp(40px, 7vw, 86px)`, 0.95): the decrypting name on the title screen only.
- **Headline** (600, 30px, 1): panel headings ("RECOVERED CRAFT — PROJECT FILES") and the sector readout. The pause title runs larger at 44px.
- **Title** (400, 18px): card and dossier names; HUD intel count at 26px uses the same family at 700.
- **Body** (Share Tech Mono, 13px, 1.7 in the watch; 12px in cards and descriptions).
- **Label** (Share Tech Mono, 10–12px, tracked 0.08–0.2em, uppercase): HUD labels, tab names, panel titles, code lines such as "CRAFT 01 · OPERATION SUPPLY LINE".
- **Printout:** name 34px/700 (22pt in print), section labels 13px tracked 0.12em uppercase in Ink Muted, body 15px/1.5 (10pt in print).

### Named Rules
**The Console-Prints-Mono Rule.** Anything the facility "says" (labels, readouts, descriptions, prompts, buttons) is Share Tech Mono. Oswald is only for big numbers, names and headings.

**The Tracked-Caps Rule.** Labels and buttons are uppercase with 0.08–0.2em letter-spacing. Sentence case is for running text only.

## Layout

The 3D viewport fills the window (`position: fixed; inset: 0`). The HUD is an edge frame: readouts pinned 26px from the corners (14px at 640px and below), the objective guide top-centre, the ticker along the bottom, and the controller (stick bottom-centre, face buttons bottom-right) in the lower third. The centre stays clear for the crosshair and the interaction prompt (just below centre).

Overlays are centred modals over a dimmed scrim: content panels up to 880px wide and 88vh tall with a fixed header and a scrolling body (26px padding); the wristwatch up to 640px wide with a 150px tab rail (110px on phones). At 640px and below, panels dock to the bottom of the screen.

Card grids use `repeat(auto-fill, minmax(240px, 1fr))` with 14px gaps; dossiers use a 300px minimum. The single responsive breakpoint is 640px.

The printout is a single centred column (860px max, 16px gutters). Case studies sit in a two-column grid that collapses to one; the PDF is US Letter with 0.5in margins and must stay at two pages or fewer.

## Elevation & Depth

Depth comes from the scene, not from stacked surfaces. Interface surfaces are flat near-black planes separated by hairlines; overlays are distinguished by scrims (72–82% Boot Black) and a single soft teal halo around the content panel. The only true physical depth is the wristwatch: a gradient metal bezel, a heavy drop shadow and an inset screen shadow, because it is an object, not a screen.

### Shadow Vocabulary
- **Live halo, teal** (`box-shadow: 0 0 14px rgba(47,212,198,.25)`): the interaction prompt and active stick.
- **Panel halo** (`box-shadow: 0 0 50px rgba(47,212,198,.15)`): the content panel against the scrim.
- **Alert halo, amber** (`box-shadow: 0 0 20px rgba(255,176,0,.3)`): toasts.
- **Alarm halo, red** (`box-shadow: 0 0 14px rgba(255,90,82,.3)`): lock banners.
- **HUD legibility shadow** (`text-shadow` 2px black outline plus `0 0 6px rgba(0,0,0,.8)`): all HUD text, plus a 55% Void Black backing on corner readouts, so readouts stay legible over bright scenery.
- **Watch hardware** (`box-shadow: 0 24px 60px rgba(0,0,0,.7), inset 0 2px 4px rgba(255,255,255,.12)`): the watch bezel only.

### Named Rules
**The Flat-Console Rule.** Screens and panels are flat. Drop shadows belong to physical objects (the watch); everything else gets depth from scrims and halos.

## Shapes

Hard-edged and precise. Panels, cards, buttons, chips, prompts, toasts and the HUD guide have square corners and 1px borders. A dossier card adds a 3px amber left edge; the active watch tab and the printout's case studies use a 3px left rule in teal.

Roundness is reserved for hardware: the watch bezel (26px), the watch screen (16px), the straps, the analog-stick housing (8px), and the circular face buttons and stick knob. The focus ring takes a 2px radius.

## Components

### Buttons
- **Shape:** square (0px), 1px border, uppercase tracked mono at 12px.
- **Solid (primary):** Signal Amber fill with Void Black text, 8px 16px. Used for the single most important action in a view (e.g. "Download PDF").
- **Outline (secondary):** transparent with a Phosphor Teal border and text, same padding.
- **Watch actions** (warp, toggle): teal outline, 4px 12px; hover inverts to an amber fill with dark text.
- **Destructive:** Warning Orange outline (settings reset).
- **Focus:** a 2px Phosphor Teal outline offset by 2px, keyboard focus only.

### Cards / Containers
- **Content panel:** Console Panel Deep body, Console Panel header with a teal tracked title and a square "× [ESC]" close button; 1px Hairline border and the panel halo.
- **Crate (side project) card:** Console Panel fill, 1px Hairline border, 16px padding, a 110px striped thumbnail placeholder, then an amber "CRAFT 0X · CODENAME" line, an Oswald name, a mono description, a teal tech line and outline link buttons. Hover lifts the border to teal.
- **Dossier (classified operation) card:** like the crate card but with a 3px amber left edge and a Problem / Built / Outcome definition list with tiny teal labels.

### Chips
- **Skill chip:** square, 1px Hairline Soft border, teal 11px mono text, 3px 8px; grouped under an uppercase group name.

### Navigation
- **Wristwatch tabs:** a vertical rail of tracked mono labels with a 3px left border; the active tab gets a teal border, a 10% teal wash and Readout White text.
- **Objective guide:** a top-centre bordered strip showing the next objective, an amber arrow and a teal distance.

### Signature Components
- **Title screen:** a decrypting Oswald name with a blinking teal cursor, a wide-tracked teal "P O R T F O L I O" subtitle, a gradient hairline, a pulsing teal-bordered "insert cartridge" call to action, a controls line and the amber recruiter skip link.
- **HUD prompt:** a pulsing teal-bordered box just below centre ("[E] ACCESS …"), the main way the player interacts.
- **N64 controller:** a square stick housing with an octagonal gate and a round teal knob, round face buttons (amber for fire and swap, teal for interact and watch).
- **Wristwatch:** a metal-bezelled watch with straps and a crown, holding a scanlined screen with tabs for nav, intel, dossier, comms and system settings.

## Do's and Don'ts

### Do:
- **Do** keep every new interface element square-cornered with a 1px hairline border and tracked uppercase mono labels.
- **Do** reserve glow for live, interactive or alerting elements, as in the Glow-Means-Live Rule.
- **Do** keep HUD text legible over the 3D scene with the black text-shadow outline and a translucent Void Black backing.
- **Do** keep the 3D scene visible behind overlays (a scrim, never an opaque page) except on the title screen and the arcade.
- **Do** honour `prefers-reduced-motion` for every new pulse, flicker or sweep.
- **Do** keep the printout plain: system fonts, paper colours, one teal accent.

### Don't:
- **Don't** add rounded corners, soft cards or pill buttons to console surfaces; roundness belongs to hardware only.
- **Don't** introduce new accent colours, or use red or orange for anything except alarms and destructive actions.
- **Don't** set body text in Oswald or headings in a third typeface.
- **Don't** bring CRT effects, glows, mono type or near-black backgrounds onto the light-mode résumé page or the PDF.
- **Don't** smooth out the pixelated rendering or modernise the HUD; the late-90s cartridge feel is the identity.

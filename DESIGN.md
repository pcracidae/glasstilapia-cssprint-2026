# DESIGN.md — Tala design rules

The source of truth for how Tala looks. Every screen follows the **Overview**
and **Transactions** tabs in the
[Figma board](https://www.figma.com/design/RRDms6sXCXS35tC1wo9gMB): a warm
off-white page, full-width white rows, one hero card per screen, and
monospaced peso amounts.

When you build a screen in `frontend/`, match these values. If you change a
rule, change it in Figma too and add a line to the Decisions log in
`CLAUDE.md`.

## Principles

1. **Rows, not boxes.** Content sits in full-width white strips with a
   hairline divider, like a ledger page. Lists, form fields and messages all
   use the same strip.
2. **One hero card per screen.** A gradient card with a 16px radius and a
   soft shadow carries the one number that matters. Everything else stays
   flat.
3. **Color means money direction.** Green is money in, red is money out or
   overdue, dark blue is credit and "You owe", teal is the action color.
   Neutral grey means voided or zero.
4. **Numbers are mono, words are Inter.** Every peso figure is Roboto Mono so
   columns line up. All other text is Inter.

## Tokens

The phone frame is 402px wide. The side margin is always **20px**.

| Token | Value | Use |
| --- | --- | --- |
| `page` | `#FAFAF7` | Screen background |
| `surface` | `#FFFFFF` | Rows, form strips, sheets |
| `divider` | `#E5E5E0` | Row hairlines, disabled button |
| `text` | `#1C1C1C` | Titles and body |
| `text-muted` | `#5F6368` | Meta lines, group headers |
| `teal` | `#0F766E` | Primary action, links, selected chip, brand |
| `blue` | `#0369A1` | Credit (Contacts FAB, highlighted task) |
| `green` | `#15803D` | Money in, "Good", Verified |
| `red` | `#B91C1C` | Money out, overdue, destructive button |
| `grey` | `#9AA0A6` | Voided or zero amounts |
| `streak` | `#EF4444` | Streak pill |

Fonts: **Inter** (Regular, Medium, Semi Bold, Bold) and **Roboto Mono**
(SemiBold, Bold).

## Rules

| Part | Rule |
| --- | --- |
| Page | Background `page`. Content runs edge to edge; text keeps a 20px margin. |
| Screen title | Inter Semi Bold 24, `text`. Home uses the store name at Semi Bold 20 with the date at Medium 14 `text-muted`. |
| Back / Cancel link | Inter Regular 16, `teal`, top left. Sheets add a 40×5 grabber in the middle. |
| List group header | Inter Medium 14, UPPERCASE, `text-muted`, padding 16 top / 8 bottom. Optional right side: a teal action (Sort, See all) or a colored total (Profit). Overview's "Latest" and "What's next" stay sentence case Semi Bold 16 as home headings. |
| Row | `surface`, 1px `divider` bottom, padding 8 / 20, gap 12, about 64px tall. Title Inter Regular 16; meta Inter Regular 12 `text-muted`. Optional 32px tier glyph or 40px profile photo on the left, 20px chevron on the right. |
| Badge | Pill (radius 999), padding 2 / 8, Inter Semi Bold 12, text color on a 12% tint of the same color. Used for trust tiers, Customer/Supplier, loan status, Partner. |
| Amounts | Roboto Mono: SemiBold 16 in rows, Bold 32 in hero cards. `green` in, `red` out or overdue, `grey` voided or zero (struck through when voided). |
| Hero card | One per screen. Gradient fill, radius 16, soft shadow, padding 20 / 20 / 16 / 20. Label Medium 14 at 75%, headline Bold 32, caption 14. Watermark icon at 6–8% in the bottom-right corner. |
| Form field | Label Inter Medium 14 `text`, sentence case, 20px margin. Input is a full-width `surface` strip with top and bottom hairlines, padding 20. Focused: 2px `teal` hairlines. |
| Choice | Segmented bar: light grey track, selected segment white and raised, others greyed out. Option chips: pills, `teal` fill when selected. |
| Checkbox | Square, 16px. Done tasks fade to grey. |
| Buttons | Primary: `teal`, radius 12, 52px tall, full width minus margins. Destructive: `red`, same shape. Disabled: `divider`. FAB: 56px circle, flat, `teal` (`blue` on Contacts). |
| Avatars | Contacts show a round profile photo: 40px in rows, 56px on a contact's page, 28–32px in cards and fields. |
| Icons | Line icons, 20–22px in rows and the tab bar. |

## Exceptions

- **Sign in** (Sign up, SMS code, Create PIN, Unlock) keeps its own look:
  Inter Bold 28 titles, Medium 14 back links, and rounded 12px input and
  digit boxes.

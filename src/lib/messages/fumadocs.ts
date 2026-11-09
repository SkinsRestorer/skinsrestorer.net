import type { Translations } from "fumadocs-ui/i18n";
import type { Locale } from "../i18n";
import { translate, type MessageKey } from ".";

// Fumadocs qualifies message keys with their UI context.
const keys = {
  "Ask AI(AI chat button)": "common.askAi",
  "Back to Home(404 not found page)": "common.backHome",
  "Choose a language(language switcher)": "common.chooseLanguage",
  "Choose a language(language switcher)(aria-label)": "common.chooseLanguage",
  "Close Banner(banner)(aria-label)": "common.closeBanner",
  "Close Search(search dialog)(aria-label)": "common.closeSearch",
  "Close Sidebar(aria-label)": "common.closeSidebar",
  "Close Sidebar(sidebar)(aria-label)": "common.closeSidebar",
  "Collapse Sidebar(sidebar)(aria-label)": "common.collapseSidebar",
  "Copied Text(code block)(aria-label)": "common.copiedText",
  "Copy Anchor Link(heading anchor)(aria-label)": "common.copyAnchorLink",
  "Copy Link(accordion)(aria-label)": "common.copyLink",
  "Copy Markdown(page actions)": "common.copyMarkdown",
  "Copy Text(code block)(aria-label)": "common.copyText",
  "Dark(theme switcher)(aria-label)": "common.dark",
  "Default(type table)": "common.default",
  "Edit on GitHub(edit page)": "common.editGithub",
  "Hide Sidebar(sidebar)": "common.hideSidebar",
  "Last updated on(page footer)": "common.lastUpdated",
  "Layout Tab(layout tab trigger)": "common.layoutTab",
  "Light(theme switcher)(aria-label)": "common.light",
  "Next Page(pagination)": "common.nextPage",
  "No Headings(table of contents)": "common.noHeadings",
  "No results found(search dialog)": "common.noResultsFound",
  "On this page(table of contents)": "common.page",
  "Open Search(search trigger)(aria-label)": "common.openSearch",
  "Open Sidebar(aria-label)": "common.openSidebar",
  "Open Sidebar(sidebar)(aria-label)": "common.openSidebar",
  "Open in ChatGPT(page actions)": "docs.openChatgpt",
  "Open in Claude(page actions)": "docs.openClaude",
  "Open in Cursor(page actions)": "common.openInCursor",
  "Open in GitHub(page actions)": "docs.openGithub",
  "Open in Scira AI(page actions)": "docs.openSciraAi",
  "Open(page actions)": "studio.open",
  "Page Not Found(404 not found page)": "common.pageNotFound",
  "Parameters(type table)": "common.parameters",
  "Previous Page(pagination)": "common.previousPage",
  "Prop(type table)": "common.prop",
  "Read {url}, I want to ask questions about it.(page actions)":
    "common.readUrlIWantAskQuestionsAbout",
  "Returns(type table)": "common.returns",
  "Search(search dialog)": "gallery.search",
  "Search(search trigger)": "gallery.search",
  "Show Sidebar(sidebar)": "common.showSidebar",
  "System(theme switcher)(aria-label)": "common.system",
  "Table of Contents(inline table of contents)": "common.tableContents",
  "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)":
    "common.pageYouLookingMightHaveBeenRemoved",
  "Toggle Menu(home layout header)(aria-label)": "common.toggleMenu",
  "Toggle Theme(theme switcher)(aria-label)": "common.toggleTheme",
  "Type(type table)": "common.type",
  "View as Markdown(page actions)": "common.viewMarkdown",
} satisfies Partial<Record<keyof Translations, MessageKey>>;

export function fumadocsMessages(locale: Locale): Partial<Translations> {
  return Object.fromEntries(
    Object.entries(keys).map(([externalKey, key]) => [
      externalKey,
      translate(locale, key),
    ]),
  );
}

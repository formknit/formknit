import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Formknit',
  description: 'Open-source form engine for React: define a form once, render it, validate it on the server, and edit it visually.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Fields', link: '/guide/fields' },
      { text: 'Formulas', link: '/guide/expressions' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Defining forms', link: '/guide/defining-forms' },
          { text: 'Field types', link: '/guide/fields' },
        ],
      },
      {
        text: 'Logic',
        items: [
          { text: 'Formulas and rules', link: '/guide/expressions' },
          { text: 'Validation and the server', link: '/guide/validation' },
          { text: 'Lookups, uploads and drafts', link: '/guide/data' },
        ],
      },
      {
        text: 'Look and feel',
        items: [
          { text: 'Styling', link: '/guide/styling' },
          { text: 'UI library adapters', link: '/guide/adapters' },
          { text: 'Translations', link: '/guide/i18n' },
        ],
      },
      {
        text: 'Extending',
        items: [
          { text: 'Custom field types', link: '/guide/custom-fields' },
          { text: 'Rich text editor', link: '/guide/rich-text' },
          { text: 'Visual builder', link: '/guide/builder' },
          { text: 'Command line', link: '/guide/cli' },
        ],
      },
    ],
    search: { provider: 'local' },
    outline: [2, 3],
  },
})

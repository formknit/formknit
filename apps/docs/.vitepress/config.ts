import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/formknit/formknit'

export default defineConfig({
  title: 'Formknit',
  description: 'Open-source form engine for React: define a form once, render it, validate it on the server, and edit it visually.',
  // Served from https://formknit.github.io/formknit/. Set DOCS_BASE=/ to serve from a domain's root.
  base: process.env.DOCS_BASE ?? '/formknit/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#4f46e5' }]],
  themeConfig: {
    nav: [
      { text: 'Docs', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Platform', link: '/platform/overview', activeMatch: '/platform/' },
      { text: 'API reference', link: '/reference/core', activeMatch: '/reference/' },
      {
        text: '0.1',
        items: [
          { text: 'Release notes', link: '/guide/release-notes' },
          { text: 'Contributing', link: '/guide/contributing' },
          { text: 'npm', link: 'https://www.npmjs.com/org/formknit' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Prologue',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Release notes', link: '/guide/release-notes' },
            { text: 'Contributing', link: '/guide/contributing' },
          ],
        },
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Your first form', link: '/guide/quickstart' },
            { text: 'How it works', link: '/guide/concepts' },
          ],
        },
        {
          text: 'Defining Forms',
          items: [
            { text: 'Defining forms', link: '/guide/defining-forms' },
            { text: 'Field types', link: '/guide/fields' },
            { text: 'Layout and pages', link: '/guide/layout' },
            { text: 'Repeating groups', link: '/guide/repeaters' },
            { text: 'Conditional logic', link: '/guide/conditional-logic' },
            { text: 'Schema reference', link: '/guide/schema' },
          ],
        },
        {
          text: 'Formulas & Validation',
          items: [
            { text: 'Formulas', link: '/guide/expressions' },
            { text: 'Function reference', link: '/guide/functions' },
            { text: 'Validation', link: '/guide/validation' },
            { text: 'Validating on the server', link: '/guide/server' },
          ],
        },
        {
          text: 'Rendering in React',
          items: [
            { text: 'The Form component', link: '/guide/form-component' },
            { text: 'Hooks and headless forms', link: '/guide/hooks' },
            { text: 'Lookups, uploads and drafts', link: '/guide/data' },
            { text: 'Styling', link: '/guide/styling' },
            { text: 'Translations', link: '/guide/i18n' },
          ],
        },
        {
          text: 'UI Libraries',
          items: [
            { text: 'Adapters', link: '/guide/adapters' },
            { text: 'Material UI', link: '/guide/adapter-mui' },
            { text: 'shadcn/ui', link: '/guide/adapter-shadcn' },
            { text: 'Writing an adapter', link: '/guide/writing-adapters' },
          ],
        },
        {
          text: 'Visual Builder',
          items: [
            { text: 'Embedding the builder', link: '/guide/builder' },
            { text: 'Extending the builder', link: '/guide/builder-extending' },
          ],
        },
        {
          text: 'Extending',
          items: [
            { text: 'Rich text editor', link: '/guide/rich-text' },
            { text: 'Custom field types', link: '/guide/custom-fields' },
            { text: 'Custom functions', link: '/guide/custom-functions' },
            { text: 'Command line', link: '/guide/cli' },
          ],
        },
      ],
      '/platform/': [
        {
          text: 'Self-Hosted Platform',
          items: [
            { text: 'Overview', link: '/platform/overview' },
            { text: 'Installation', link: '/platform/installation' },
            { text: 'Configuration', link: '/platform/configuration' },
            { text: 'Database', link: '/platform/database' },
            { text: 'Email', link: '/platform/email' },
          ],
        },
        {
          text: 'Using the Platform',
          items: [
            { text: 'Forms and publishing', link: '/platform/forms' },
            { text: 'Submissions and review', link: '/platform/submissions' },
            { text: 'Teams and roles', link: '/platform/teams' },
            { text: 'Lookups between forms', link: '/platform/lookups' },
          ],
        },
        {
          text: 'Integrations',
          items: [
            { text: 'Webhooks', link: '/platform/webhooks' },
            { text: 'REST API', link: '/platform/api' },
          ],
        },
        {
          text: 'Operations',
          items: [
            { text: 'Security', link: '/platform/security' },
            { text: 'Backups and upgrades', link: '/platform/maintenance' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: '@formknit/core', link: '/reference/core' },
            { text: '@formknit/react', link: '/reference/react' },
            { text: '@formknit/builder', link: '/reference/builder' },
            { text: '@formknit/richtext', link: '/reference/richtext' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/apps/docs/:path`, text: 'Edit this page on GitHub' },
    footer: { message: 'Released under the MIT licence.', copyright: 'Copyright © Shishir Rai and Formknit contributors' },
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'On this page' },
  },
})

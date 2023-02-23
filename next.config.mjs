const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    staticImage: true,
    latex: true,
    flexsearch: {
        codeblocks: false
    },
    defaultShowCopyCode: true
})

module.exports = withNextra({
    reactStrictMode: true,
    redirects: async () => {
        return [
            {
                source: '/discord',
                destination: process.env.NEXT_PUBLIC_DISCORD_LINK,
                permanent: false,
            },
        ]
    }
})

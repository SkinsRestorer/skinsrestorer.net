import nextra from 'nextra'

const withNextra = nextra({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    staticImage: true,
    latex: true,
    defaultShowCopyCode: true
})

export default withNextra({
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

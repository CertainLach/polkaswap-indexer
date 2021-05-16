module.exports = {
    async rewrites() {
        return [
            {
                source: '/graphql',
                destination: process.env.BACKEND,
            }
        ]
    }
}
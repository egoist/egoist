import fs from 'fs'
import axios from 'axios'
import enquirer from 'enquirer'
import replaceSection from 'replace-section'

async function main() {
  const { token } = process.env.GITHUB_TOKEN
    ? { token: process.env.GITHUB_TOKEN }
    : await enquirer.prompt<{ token: string }>([
        {
          type: 'input',
          message: 'Paste GitHub Personal Access Token',
          name: 'token',
          required: true,
        },
      ])
  const { data } = await axios.post(
    `https://api.github.com/graphql
    `,
    {
      query: `query { 
            viewer { 
              login
              sponsorshipsAsMaintainer(first: 100) {
                totalCount
                nodes {
                  tier {
                    monthlyPriceInDollars
                  }
                  sponsorEntity {
                    ... on User {
                      login
                      avatarUrl
                    }
                    ... on Organization {
                      login
                      avatarUrl
                    }
                  }
                }
              }
            }
          }`,
    },
    {
      headers: {
        Authorization: `bearer ${token}`,
      },
    },
  )
  const totalCount = data.data.viewer.sponsorshipsAsMaintainer.totalCount
  const sponsors = data.data.viewer.sponsorshipsAsMaintainer.nodes
    .map((node) => {
      return {
        monthlyPriceInDollars: node.tier.monthlyPriceInDollars,
        username: node.sponsorEntity.login,
        avatar: node.sponsorEntity.avatarUrl,
        private: node.privacyLevel === 'PRIVATE',
      }
    })
    .filter((node) => {
      return node.monthlyPriceInDollars >= 10 && !node.private
    })
    .sort((a, b) => {
      return a.monthlyPriceInDollars > b.monthlyPriceInDollars ? -1 : 1
    })

  const code = sponsors
    .map((sponsor) => {
      return `<a title="${sponsor.username}" href="https://github.com/${sponsor.username}"><img src="${sponsor.avatar}" width="60" alt="profile picture of ${sponsor.username}"></a>`
    })
    .join(' ')

  const readme = await fs.promises.readFile('README.md', 'utf8')
  await fs.promises.writeFile(
    'README.md',
    replaceSection({
      input: readme,
      startWith: '<!-- replace-sponsors -->',
      endWith: '<!-- replace-sponsors -->',
      replaceWith: `<!-- replace-sponsors -->
${code}

...[and ${totalCount - sponsors.length} more](https://egoist.dev/thanks)
      <!-- replace-sponsors -->`,
    }),
    'utf-8',
  )
}

main()

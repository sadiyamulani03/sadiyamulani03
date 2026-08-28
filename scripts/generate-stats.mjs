import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GH_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || 'sadiyamulani03';

const GRAPHQL_QUERY = `
query($username: String!) {
  user(login: $username) {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      nodes {
        stargazerCount
        forkCount
        primaryLanguage { name color }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node { name color }
          }
        }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 1) {
                totalCount
              }
            }
          }
        }
        issues(states: [OPEN, CLOSED]) { totalCount }
        pullRequests(states: [OPEN, CLOSED, MERGED]) { totalCount }
      }
      totalCount
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
    }
    followers { totalCount }
    following { totalCount }
  }
}
`;

async function fetchGitHubData() {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Stats-Generator'
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { username: USERNAME }
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data.user;
}

function aggregateLanguages(repos) {
  const langMap = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const lang = edge.node.name;
      const size = edge.size;
      langMap.set(lang, (langMap.get(lang) || 0) + size);
    }
  }
  return Array.from(langMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function generateStatsSVG(data) {
  const repos = data.repositories.nodes;
  const totalStars = repos.reduce((sum, r) => sum + r.stargazerCount, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forkCount, 0);
  const totalCommits = repos.reduce((sum, r) => sum + (r.defaultBranchRef?.target?.history?.totalCount || 0), 0);
  const totalIssues = repos.reduce((sum, r) => sum + r.issues.totalCount, 0);
  const totalPRs = repos.reduce((sum, r) => sum + r.pullRequests.totalCount, 0);
  const totalContrib = data.contributionsCollection?.totalCommitContributions || 0;
  const followers = data.followers?.totalCount || 0;
  const following = data.following?.totalCount || 0;

  const bgColor = '#0d1117';
  const textColor = '#e8e2ff';
  const accentColor = '#9D50FF';
  const iconColor = '#FF61D2';
  const borderColor = '#30363d';

  return `<svg width="495" height="195" viewBox="0 0 495 195" xmlns="http://www.w3.org/2000/svg">
  <rect width="495" height="195" fill="${bgColor}" rx="8"/>
  <rect x="10" y="10" width="475" height="175" fill="${bgColor}" stroke="${borderColor}" stroke-width="1" rx="6"/>
  <text x="247" y="35" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="bold" fill="${accentColor}" text-anchor="middle">GitHub Profile Stats</text>
  <line x1="20" y1="42" x2="475" y2="42" stroke="${borderColor}" stroke-width="1"/>
  
  <g font-family="Segoe UI, Ubuntu, sans-serif" font-size="12" fill="${textColor}">
    <circle cx="30" cy="65" r="6" fill="${iconColor}"/>
    <text x="45" y="69">Total Stars: <tspan font-weight="bold" fill="${accentColor}">${totalStars}</tspan></text>
    
    <circle cx="30" cy="88" r="6" fill="${iconColor}"/>
    <text x="45" y="92">Total Forks: <tspan font-weight="bold" fill="${accentColor}">${totalForks}</tspan></text>
    
    <circle cx="30" cy="111" r="6" fill="${iconColor}"/>
    <text x="45" y="115">Total Commits: <tspan font-weight="bold" fill="${accentColor}">${totalCommits.toLocaleString()}</tspan></text>
    
    <circle cx="30" cy="134" r="6" fill="${iconColor}"/>
    <text x="45" y="138">Total Issues: <tspan font-weight="bold" fill="${accentColor}">${totalIssues}</tspan></text>
    
    <circle cx="30" cy="157" r="6" fill="${iconColor}"/>
    <text x="45" y="161">Total PRs: <tspan font-weight="bold" fill="${accentColor}">${totalPRs}</tspan></text>
    
    <circle cx="280" cy="65" r="6" fill="${iconColor}"/>
    <text x="295" y="69">Total Repos: <tspan font-weight="bold" fill="${accentColor}">${data.repositories.totalCount}</tspan></text>
    
    <circle cx="280" cy="88" r="6" fill="${iconColor}"/>
    <text x="295" y="92">Contributions (Year): <tspan font-weight="bold" fill="${accentColor}">${totalContrib.toLocaleString()}</tspan></text>
    
    <circle cx="280" cy="111" r="6" fill="${iconColor}"/>
    <text x="295" y="115">Followers: <tspan font-weight="bold" fill="${accentColor}">${followers}</tspan></text>
    
    <circle cx="280" cy="134" r="6" fill="${iconColor}"/>
    <text x="295" y="138">Following: <tspan font-weight="bold" fill="${accentColor}">${following}</tspan></text>
    
    <circle cx="280" cy="157" r="6" fill="${iconColor}"/>
    <text x="295" y="161">Updated: <tspan font-weight="bold" fill="${accentColor}">${new Date().toISOString().split('T')[0]}</tspan></text>
  </g>
</svg>`;
}

function generateLanguagesSVG(langs) {
  const bgColor = '#0d1117';
  const textColor = '#e8e2ff';
  const accentColor = '#9D50FF';
  const borderColor = '#30363d';

  const total = langs.reduce((sum, [, size]) => sum + size, 0);
  const maxSize = Math.max(...langs.map(([, s]) => s));
  
  const bars = langs.map(([name, size], i) => {
    const pct = ((size / total) * 100).toFixed(1);
    const barWidth = Math.max(20, (size / maxSize) * 300);
    const y = 45 + i * 22;
    return `
    <text x="20" y="${y + 10}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" fill="${textColor}">${name}</text>
    <text x="120" y="${y + 10}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="11" fill="${accentColor}" text-anchor="end">${pct}%</text>
    <rect x="130" y="${y - 6}" width="${barWidth}" height="12" fill="${accentColor}" rx="3" opacity="0.8"/>
    <rect x="130" y="${y - 6}" width="${barWidth}" height="12" fill="url(#grad)" rx="3"/>
    `;
  }).join('');

  return `<svg width="495" height="${45 + langs.length * 22}" viewBox="0 0 495 ${45 + langs.length * 22}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF61D2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#9D50FF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="495" height="${45 + langs.length * 22}" fill="${bgColor}" rx="8"/>
  <rect x="10" y="10" width="475" height="${25 + langs.length * 22}" fill="${bgColor}" stroke="${borderColor}" stroke-width="1" rx="6"/>
  <text x="247" y="35" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="bold" fill="${accentColor}" text-anchor="middle">Most Used Languages</text>
  <line x1="20" y1="42" x2="475" y2="42" stroke="${borderColor}" stroke-width="1"/>
  ${bars}
</svg>`;
}

async function main() {
  try {
    console.log('Fetching GitHub data...');
    const userData = await fetchGitHubData();
    
    console.log('Generating SVGs...');
    const statsSvg = generateStatsSVG(userData);
    const langs = aggregateLanguages(userData.repositories.nodes);
    const langsSvg = generateLanguagesSVG(langs);
    
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    writeFileSync(join(distDir, 'profile-stats.svg'), statsSvg);
    writeFileSync(join(distDir, 'top-languages.svg'), langsSvg);
    
    console.log('Stats SVGs generated successfully!');
    console.log(`Total repos: ${userData.repositories.totalCount}`);
    console.log(`Total stars: ${userData.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0)}`);
    console.log(`Top languages: ${langs.map(([n]) => n).join(', ')}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

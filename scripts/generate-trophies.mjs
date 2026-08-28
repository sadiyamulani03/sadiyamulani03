import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GH_TOKEN;
const USERNAME = 'sadiyamulani03';

const QUERY = `
query($user: String!) {
  user(login: $user) {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes { stargazerCount, forkCount, issues { totalCount }, pullRequests { totalCount } }
    }
    followers { totalCount }
    contributionsCollection { contributionCalendar { totalContributions } }
  }
}`;

async function fetchData() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { user: USERNAME } })
  });
  return (await res.json()).data.user;
}

function trophySVG(data) {
  const repos = data.repositories;
  const totalStars = repos.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = repos.nodes.reduce((s, r) => s + r.forkCount, 0);
  const totalIssues = repos.nodes.reduce((s, r) => s + r.issues.totalCount, 0);
  const totalPRs = repos.nodes.reduce((s, r) => s + r.pullRequests.totalCount, 0);
  const totalCommits = data.contributionsCollection?.contributionCalendar?.totalContributions || 0;
  const followers = data.followers.totalCount;
  
  const trophies = [
    { label: 'Repositories', value: repos.totalCount, icon: '🏆' },
    { label: 'Total Stars', value: totalStars, icon: '⭐' },
    { label: 'Total Forks', value: totalForks, icon: '🍴' },
    { label: 'Followers', value: followers, icon: '👥' },
    { label: 'Total Commits', value: totalCommits.toLocaleString(), icon: '🔥' },
    { label: 'Total PRs', value: totalPRs, icon: '📝' },
    { label: 'Total Issues', value: totalIssues, icon: '🐛' },
    { label: 'Years on GitHub', value: new Date().getFullYear() - 2023, icon: '📅' }
  ];

  const bg = '#282c34', text = '#abb2bf', accent = '#61afef', border = '#3e4451';
  const cols = 4, rows = 2, w = 120, h = 90, gap = 15, margin = 20;
  const svgW = margin * 2 + cols * w + (cols - 1) * gap;
  const svgH = margin * 2 + rows * h + (rows - 1) * gap + 40;

  let cards = '';
  trophies.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = margin + col * (w + gap);
    const y = margin + 40 + row * (h + gap);
    cards += `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${bg}" stroke="${border}"/>
      <text x="${x + w/2}" y="${y + 25}" text-anchor="middle" font-size="24" fill="${accent}">${t.icon}</text>
      <text x="${x + w/2}" y="${y + 50}" text-anchor="middle" font-size="16" font-weight="bold" fill="${text}">${t.value}</text>
      <text x="${x + w/2}" y="${y + 72}" text-anchor="middle" font-size="11" fill="${accent}">${t.label}</text>
    `;
  });

  return `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bg}" rx="10"/>
    <text x="${svgW/2}" y="28" text-anchor="middle" font-size="18" font-weight="bold" fill="${accent}">GitHub Trophies</text>
    ${cards}
  </svg>`;
}

async function main() {
  const data = await fetchData();
  const svg = trophySVG(data);
  const dir = join(process.cwd(), 'dist');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'trophies.svg'), svg);
  console.log('trophies.svg generated');
}
main();

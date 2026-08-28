import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GH_TOKEN;
const USERNAME = 'sadiyamulani03';

const QUERY = `
query($user: String!) {
  user(login: $user) {
    contributionsCollection(from: "2025-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z") {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date, contributionCount, color } }
      }
    }
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

function activitySVG(data) {
  const cal = data.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks;
  const maxCount = Math.max(...weeks.flatMap(w => w.contributionDays.map(d => d.contributionCount)), 1);
  
  const cellSize = 12, gap = 2, margin = 30, labelW = 30;
  const svgW = margin + labelW + weeks.length * (cellSize + gap);
  const svgH = margin * 2 + 7 * (cellSize + gap);
  
  const bg = '#0d1117', zero = '#161b22';
  
  let rects = '';
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const x = margin + labelW + wi * (cellSize + gap);
      const y = margin + di * (cellSize + gap);
      const count = day.contributionCount;
      let fill = zero;
      if (count > 0) {
        const intensity = Math.min(count / maxCount, 1);
        const r = Math.round(157 + intensity * (255 - 157));
        const g = Math.round(80 + intensity * (97 - 80));
        const b = Math.round(255);
        fill = `rgb(${r},${g},${b})`;
      }
      rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}" data-date="${day.date}" data-count="${count}"/>`;
    });
  });
  
  let labels = '';
  dayLabels.forEach((d, i) => {
    labels += `<text x="${margin - 5}" y="${margin + i * (cellSize + gap) + cellSize/2 + 4}" text-anchor="end" font-size="9" fill="#8b949e">${d}</text>`;
  });
  
  return `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bg}"/>
    ${labels}
    ${rects}
    <text x="${svgW/2}" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="#9D50FF">Contribution Activity</text>
  </svg>`;
}

async function main() {
  const data = await fetchData();
  const svg = activitySVG(data);
  const dir = join(process.cwd(), 'dist');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'activity-graph.svg'), svg);
  console.log('activity-graph.svg generated');
}
main();

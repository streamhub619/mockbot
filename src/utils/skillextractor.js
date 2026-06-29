// ─── Skill Extractor ─────────────────────────────────────────────────────────
// Rule-based skill extraction from raw resume / job description text.
// Sprint 3 will layer AI-based extraction on top of this as a fallback.

const SKILL_PATTERNS = {
  language: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'csharp', 'c plus plus',
    'go', 'golang', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab',
    'bash', 'shell', 'perl', 'dart',
  ],
  framework: [
    'react', 'reactjs', 'react.js', 'vue', 'vuejs', 'vue.js', 'angular', 'angularjs',
    'node', 'nodejs', 'node.js', 'express', 'expressjs', 'express.js',
    'django', 'flask', 'fastapi', 'spring', 'springboot', 'spring boot',
    'laravel', 'rails', 'ruby on rails', 'next', 'nextjs', 'next.js',
    'nuxt', 'svelte', 'nestjs', 'nest.js', 'asp.net', 'dotnet', '.net',
  ],
  database: [
    'postgresql', 'postgres', 'mysql', 'mongodb', 'mongo', 'redis', 'sqlite',
    'cassandra', 'elasticsearch', 'dynamodb', 'firestore', 'oracle', 'mssql',
    'sql server', 'mariadb', 'supabase',
  ],
  tool: [
    'git', 'github', 'gitlab', 'bitbucket', 'docker', 'kubernetes', 'k8s',
    'jenkins', 'github actions', 'circleci', 'travis', 'ansible', 'terraform',
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud',
    'linux', 'ubuntu', 'nginx', 'apache', 'webpack', 'vite', 'babel',
    'jira', 'confluence', 'postman', 'figma',
  ],
  concept: [
    'rest', 'restful', 'rest api', 'graphql', 'grpc', 'websocket',
    'microservices', 'micro-services', 'serverless', 'monolith',
    'ci/cd', 'cicd', 'devops', 'tdd', 'test driven', 'bdd', 'agile', 'scrum',
    'oop', 'object oriented', 'functional programming', 'mvc', 'mvvm',
    'design patterns', 'solid', 'dry', 'clean code',
    'data structures', 'algorithms', 'system design',
  ],
  soft_skill: [
    'communication', 'teamwork', 'team player', 'leadership', 'problem solving',
    'problem-solving', 'time management', 'collaboration', 'adaptability',
    'critical thinking', 'attention to detail',
  ],
};

// Canonical display names for matched pattern → stored skill name
const CANONICAL = {
  'reactjs': 'React', 'react.js': 'React',
  'vuejs': 'Vue.js', 'vue.js': 'Vue.js',
  'nodejs': 'Node.js', 'node': 'Node.js', 'node.js': 'Node.js',
  'expressjs': 'Express.js', 'express.js': 'Express.js', 'express': 'Express.js',
  'postgres': 'PostgreSQL',
  'mongo': 'MongoDB',
  'k8s': 'Kubernetes',
  'aws': 'AWS', 'amazon web services': 'AWS',
  'gcp': 'GCP', 'google cloud': 'GCP',
  'restful': 'REST API', 'rest': 'REST API', 'rest api': 'REST API',
  'oop': 'OOP', 'object oriented': 'OOP',
  'cicd': 'CI/CD', 'ci/cd': 'CI/CD',
  'tdd': 'TDD', 'test driven': 'TDD',
  'springboot': 'Spring Boot', 'spring boot': 'Spring Boot',
  'golang': 'Go',
  'csharp': 'C#', 'c plus plus': 'C++',
  'next': 'Next.js', 'nextjs': 'Next.js', 'next.js': 'Next.js',
  'problem-solving': 'Problem Solving',
  'micro-services': 'Microservices',
  'team player': 'Teamwork',
  'dotnet': '.NET', 'asp.net': '.NET',
};

/**
 * Extract skills from a block of text.
 * @param {string} text  Raw resume or job description content
 * @returns {{ name: string, category: string }[]}
 */
function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();
  const found  = new Map(); // name → category

  for (const [category, patterns] of Object.entries(SKILL_PATTERNS)) {
    for (const pattern of patterns) {
      // word-boundary match so 'go' doesn't match inside 'django'
      const regex = new RegExp(`(?<![a-z])${escapeRegex(pattern)}(?![a-z])`, 'i');
      if (regex.test(lower)) {
        const canonical = CANONICAL[pattern.toLowerCase()] || toTitleCase(pattern);
        if (!found.has(canonical)) {
          found.set(canonical, category);
        }
      }
    }
  }

  return Array.from(found.entries()).map(([name, category]) => ({ name, category }));
}

/**
 * Compute the intersection of two skill arrays (by name, case-insensitive).
 * @param {string[]} resumeSkills   Skill names from resume
 * @param {string[]} jdSkills       Skill names from job description
 * @returns {string[]} Matched skill names
 */
function matchSkills(resumeSkills, jdSkills) {
  const jdSet = new Set(jdSkills.map((s) => s.toLowerCase()));
  return resumeSkills.filter((s) => jdSet.has(s.toLowerCase()));
}

// Helpers
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { extractSkills, matchSkills };
 